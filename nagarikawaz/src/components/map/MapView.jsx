import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import { useNavigate } from 'react-router-dom'
import { useReports, useGeolocation, useUpvoteReport, getLocalUpvoted } from '../../hooks'
import { createMarkerIcon, timeAgo, cn } from '../../utils/helpers'
import { CATEGORIES, MAP_DEFAULTS } from '../../utils/constants'
import { CategoryBadge, SeverityBadge, StatusBadge, Spinner } from '../ui'
import { useLang } from '../../context/LangContext'

export default function MapView({ filters = {} }) {
  const mapRef     = useRef(null)
  const mapInst    = useRef(null)
  const clusterRef = useRef(null)
  const navigate   = useNavigate()
  const { lang, tr } = useLang()
  const { location, getLocation } = useGeolocation()
  const { data: reports, isLoading } = useReports(filters, { refetchInterval: 60000 })
  const [selected,    setSelected]    = useState(null)
  const [mapType,     setMapType]     = useState('osm')
  const [showBounds,  setShowBounds]  = useState(false)
  const [upvotedIds,  setUpvotedIds]  = useState(() => getLocalUpvoted())
  const boundsRef = useRef(null)
  const upvote = useUpvoteReport()

  const TILE_LAYERS = {
    osm:   { label: '🗺️ Street',    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',         attr: '© OpenStreetMap' },
    sat:   { label: '🛰️ Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '© Esri' },
    topo:  { label: '⛰️ Topo',      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',             attr: '© OpenTopoMap' },
    dark:  { label: '🌙 Dark',      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attr: '© CartoDB' },
  }

  // ── Init map ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapInst.current) return
    const map = L.map(mapRef.current, {
      center:  MAP_DEFAULTS.center,
      zoom:    MAP_DEFAULTS.zoom,
      minZoom: MAP_DEFAULTS.minZoom,
      maxZoom: MAP_DEFAULTS.maxZoom,
    })

    const tl = L.tileLayer(TILE_LAYERS.osm.url, { attribution: TILE_LAYERS.osm.attr, maxZoom: 19 }).addTo(map)
    map._activeTile = tl

    const cluster = L.markerClusterGroup({ maxClusterRadius: 60, disableClusteringAtZoom: 15, spiderfyOnMaxZoom: true })
    map.addLayer(cluster)
    clusterRef.current = cluster
    mapInst.current    = map

    return () => { map.remove(); mapInst.current = null }
  }, [])

  // ── Swap tile layer when mapType changes ──────────────────────────────────────
  useEffect(() => {
    const map = mapInst.current
    if (!map) return
    if (map._activeTile) map.removeLayer(map._activeTile)
    const cfg = TILE_LAYERS[mapType]
    map._activeTile = L.tileLayer(cfg.url, { attribution: cfg.attr, maxZoom: 19 }).addTo(map)
  }, [mapType])

  // ── District boundary layer ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInst.current
    if (!map) return
    if (boundsRef.current) { map.removeLayer(boundsRef.current); boundsRef.current = null }
    if (!showBounds) return
    fetch('/nepal-districts.geojson')
      .then((r) => r.json())
      .then((gj) => {
        boundsRef.current = L.geoJSON(gj, {
          style: { color: '#94a3b8', weight: 1, fillOpacity: 0, opacity: 0.5 },
          onEachFeature: (feat, layer) => {
            layer.bindTooltip(feat.properties.name, { permanent: false, sticky: true, className: 'map-tooltip' })
          },
        }).addTo(map)
      })
      .catch(() => {})
  }, [showBounds])

  // ── Markers ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!clusterRef.current) return
    clusterRef.current.clearLayers()
    if (!reports?.length) return
    reports.forEach((r) => {
      if (!r.lat || !r.lng) return
      const m = L.marker([parseFloat(r.lat), parseFloat(r.lng)], { icon: createMarkerIcon(r.category, r.severity) })
      m.on('click', () => setSelected(r))
      clusterRef.current.addLayer(m)
    })
  }, [reports])

  // ── Fly to location ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapInst.current || !location) return
    mapInst.current.flyTo([location.lat, location.lng], 14, { duration: 1 })
  }, [location])

  const [showMapMenu, setShowMapMenu] = useState(false)

  const titleField = (r) => lang === 'ne' ? (r.title_np || r.title_en) : (r.title_en || r.title_np)
  const descField  = (r) => lang === 'ne' ? (r.description_np || r.description_en) : (r.description_en || r.description_np)

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      {isLoading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 glass px-4 py-2 rounded-full z-30 flex items-center gap-2">
          <Spinner size="sm" />
          <span className="text-xs text-slate-300">{tr('loading')}</span>
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-4 right-4 z-30 flex flex-col gap-2">
        <button onClick={getLocation} title="My location"
          className="glass w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/10 text-brand-400 transition-all text-base">📍</button>

        {/* Map type picker */}
        <div className="relative">
          <button onClick={() => setShowMapMenu((s) => !s)}
            title="Change map type"
            className="glass w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/10 text-brand-400 transition-all text-base">
            {TILE_LAYERS[mapType].label.split(' ')[0]}
          </button>
          {showMapMenu && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowMapMenu(false)} />
              <div className="absolute right-10 top-0 z-30 glass rounded-xl shadow-xl overflow-hidden min-w-[140px]">
                {Object.entries(TILE_LAYERS).map(([k, v]) => (
                  <button key={k} onClick={() => { setMapType(k); setShowMapMenu(false) }}
                    className={cn('w-full text-left px-3 py-2 text-sm transition-all hover:bg-white/10',
                      mapType === k ? 'text-brand-400 bg-brand-900/30' : 'text-slate-300')}>
                    {v.label}
                  </button>
                ))}
                <div className="border-t border-slate-700/50 px-3 py-2">
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input type="checkbox" checked={showBounds} onChange={(e) => setShowBounds(e.target.checked)}
                      className="accent-brand-500" />
                    🗾 Districts
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        <button onClick={() => navigate('/report/new')}
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-all text-white shadow-lg text-base"
          style={{ background: '#DC143C' }}>➕</button>
      </div>

      {/* Stats bubble */}
      <div className="absolute top-4 left-4 z-30 glass rounded-xl px-3 py-2">
        <div className="font-mono text-brand-400 font-bold text-lg leading-none">{reports?.length ?? 0}</div>
        <div className="text-xs text-slate-600">{lang === 'ne' ? 'रिपोर्ट' : 'issues'}</div>
      </div>

      {/* Legend (desktop) */}
      <div className="absolute bottom-20 left-3 z-30 glass rounded-xl p-3 hidden lg:block">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">श्रेणी</p>
        {Object.entries(CATEGORIES).slice(0, 6).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 mb-1">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: v.color }} />
            <span className="text-xs text-slate-400">{lang === 'ne' ? v.np : v.en}</span>
          </div>
        ))}
      </div>

      {/* Popup */}
      {selected && (
        <div className="absolute bottom-4 left-3 right-3 md:left-auto md:right-4 md:w-80 z-30 card shadow-2xl animate-slide-up">
          <div className="p-4">
            <button onClick={() => setSelected(null)}
              className="absolute top-3 right-3 text-slate-500 hover:text-white text-xl leading-none">×</button>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <CategoryBadge category={selected.category} />
              <SeverityBadge severity={selected.severity} />
              <StatusBadge   status={selected.status} />
            </div>
            <h3 className="font-display font-semibold text-white text-sm mb-1 pr-5 leading-snug">
              {titleField(selected)}
            </h3>
            {(selected.palika || selected.district) && (
              <p className="text-xs text-brand-500 mb-2">
                📍 {selected.palika || ''}{selected.ward_no ? ` ${lang === 'ne' ? 'वडा' : 'Ward'} ${selected.ward_no}` : ''}{selected.district ? `, ${selected.district}` : ''}
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600">{timeAgo(selected.created_at)}</span>
              <div className="flex items-center gap-3">
                <button
                  disabled={upvote.isPending || upvotedIds.has(String(selected.id))}
                  onClick={(e) => {
                    e.stopPropagation()
                    upvote.mutate(selected.id, {
                      onSuccess: (data) => {
                        if (data?.alreadyVoted) return
                        setUpvotedIds((s) => new Set([...s, String(selected.id)]))
                        setSelected((r) => ({ ...r, upvotes: String((Number(r.upvotes) || 0) + 1) }))
                      },
                    })
                  }}
                  className={cn(
                    'text-xs px-2 py-1 rounded-full border transition-all',
                    upvotedIds.has(String(selected.id))
                      ? 'border-brand-700 text-brand-400 bg-brand-900/30 cursor-default'
                      : 'border-slate-700 text-slate-400 hover:border-brand-600 hover:text-brand-400'
                  )}>
                  👍 {selected.upvotes || 0}
                </button>
                <button onClick={() => { navigate(`/report/${selected.id}`); setSelected(null) }}
                  className="btn-primary py-1 px-3 text-xs">
                  {tr('viewDetails')} →
                </button>
              </div>
            </div>
          </div>
          {selected.photo_ids && (
            <div className="border-t border-slate-800">
              <img
                src={`https://drive.google.com/thumbnail?id=${selected.photo_ids.split(',')[0]}&sz=w280`}
                alt="report"
                className="w-full h-28 object-cover rounded-b-xl"
                onError={(e) => { e.target.style.display = 'none' }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
