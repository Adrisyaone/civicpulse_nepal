import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import { useNavigate } from 'react-router-dom'
import { useReports, useGeolocation } from '../../hooks'
import { createMarkerIcon, cn } from '../../utils/helpers'
import { CATEGORIES, MAP_DEFAULTS } from '../../utils/constants'
import { Spinner } from '../ui'
import { useLang } from '../../context/LangContext'

const TILE_LAYERS = {
  osm:  { label: '🗺️ Street',    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',                                           attr: '© OpenStreetMap contributors' },
  sat:  { label: '🛰️ Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: '© Esri' },
  topo: { label: '⛰️ Topo',      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',                                            attr: '© OpenTopoMap' },
  dark: { label: '🌙 Dark',      url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',                                attr: '© CartoDB' },
  none: { label: '⬜ Blank',     url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',                         attr: '© CartoDB' },
}

export default function MapView({ filters = {} }) {
  const mapRef     = useRef(null)
  const mapInst    = useRef(null)
  const clusterRef = useRef(null)
  const tileRef    = useRef(null)
  const boundsRef  = useRef(null)
  const navigate   = useNavigate()
  const { lang }   = useLang()
  const { location, getLocation } = useGeolocation()
  const { data: reports, isLoading } = useReports(filters, { refetchInterval: 60000 })
  const [mapType,    setMapType]    = useState('osm')
  const [showBounds, setShowBounds] = useState(false)
  const [showMenu,   setShowMenu]   = useState(false)

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapInst.current) return
    const map = L.map(mapRef.current, {
      center:  MAP_DEFAULTS.center,
      zoom:    MAP_DEFAULTS.zoom,
      minZoom: MAP_DEFAULTS.minZoom,
      maxZoom: MAP_DEFAULTS.maxZoom,
      zoomControl: false,
    })
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    tileRef.current = L.tileLayer(TILE_LAYERS.osm.url, { attribution: TILE_LAYERS.osm.attr, maxZoom: 19 })
    tileRef.current.addTo(map)

    const cluster = L.markerClusterGroup({ maxClusterRadius: 60, disableClusteringAtZoom: 15, spiderfyOnMaxZoom: true })
    map.addLayer(cluster)
    clusterRef.current = cluster
    mapInst.current    = map

    return () => { map.remove(); mapInst.current = null }
  }, [])

  // ── Swap tile layer ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInst.current
    if (!map || !tileRef.current) return
    map.removeLayer(tileRef.current)
    const cfg = TILE_LAYERS[mapType]
    tileRef.current = L.tileLayer(cfg.url, { attribution: cfg.attr, maxZoom: 19 })
    tileRef.current.addTo(map)
    tileRef.current.bringToBack()
  }, [mapType])

  // ── District boundary overlay ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapInst.current
    if (!map) return
    if (boundsRef.current) { map.removeLayer(boundsRef.current); boundsRef.current = null }
    if (!showBounds) return
    fetch('/nepal-districts.geojson')
      .then((r) => r.json())
      .then((gj) => {
        boundsRef.current = L.geoJSON(gj, {
          style: { color: '#60a5fa', weight: 1.5, fillOpacity: 0.04, opacity: 0.7 },
          onEachFeature: (feat, layer) => {
            layer.bindTooltip(feat.properties.name, { permanent: false, sticky: true, className: 'map-tooltip' })
          },
        }).addTo(map)
      })
      .catch(() => {})
  }, [showBounds])

  // ── Markers — click navigates directly to report ──────────────────────────
  useEffect(() => {
    if (!clusterRef.current) return
    clusterRef.current.clearLayers()
    if (!reports?.length) return
    reports.forEach((r) => {
      if (!r.lat || !r.lng) return
      const m = L.marker([parseFloat(r.lat), parseFloat(r.lng)], {
        icon: createMarkerIcon(r.category, r.severity),
      })
      m.on('click', () => navigate('/report/' + r.id))
      clusterRef.current.addLayer(m)
    })
  }, [reports, navigate])

  // ── Fly to user location ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapInst.current || !location) return
    mapInst.current.flyTo([location.lat, location.lng], 14, { duration: 1 })
  }, [location])

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      {isLoading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 glass px-4 py-2 rounded-full pointer-events-none flex items-center gap-2"
          style={{ zIndex: 800 }}>
          <Spinner size="sm" />
          <span className="text-xs text-slate-300">{lang === 'ne' ? 'लोड हुँदैछ…' : 'Loading…'}</span>
        </div>
      )}

      {/* Issue count bubble — bottom-right, below zoom controls */}
      <div className="absolute bottom-28 right-3 glass rounded-xl px-3 py-2 pointer-events-none" style={{ zIndex: 800 }}>
        <div className="font-mono text-brand-400 font-bold text-lg leading-none">{reports?.length ?? 0}</div>
        <div className="text-xs text-slate-500">{lang === 'ne' ? 'रिपोर्ट' : 'issues'}</div>
      </div>

      {/* Controls — z-index 800 sits above Leaflet's isolated panes */}
      <div className="absolute top-4 right-4 flex flex-col gap-2" style={{ zIndex: 800 }}>
        {/* My location */}
        <button onClick={getLocation} title="My location"
          className="glass w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/10 text-brand-400 transition-all text-base shadow">
          📍
        </button>

        {/* Layer picker */}
        <div className="relative">
          <button onClick={() => setShowMenu((s) => !s)} title="Map layers"
            className={cn(
              'glass w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/10 transition-all text-base shadow',
              showMenu ? 'bg-brand-900/40 text-brand-400' : 'text-slate-300'
            )}>
            🗾
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0" style={{ zIndex: 799 }} onClick={() => setShowMenu(false)} />
              <div className="absolute right-10 top-0 glass rounded-xl shadow-2xl overflow-hidden w-44" style={{ zIndex: 801 }}>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest px-3 pt-2.5 pb-1">Base Map</p>
                {Object.entries(TILE_LAYERS).map(([k, v]) => (
                  <button key={k} onClick={() => { setMapType(k); setShowMenu(false) }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm transition-all hover:bg-white/10 flex items-center gap-2',
                      mapType === k ? 'text-brand-400 bg-brand-900/30 font-medium' : 'text-slate-300'
                    )}>
                    {mapType === k && <span className="text-brand-500 text-xs">✓</span>}
                    {v.label}
                  </button>
                ))}
                <div className="border-t border-slate-700/50 px-3 py-2.5">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Overlay</p>
                  <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
                    <input type="checkbox" checked={showBounds} onChange={(e) => setShowBounds(e.target.checked)}
                      className="accent-brand-500 w-3.5 h-3.5" />
                    District Boundaries
                  </label>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Category legend — bottom-right desktop only, above count bubble */}
      <div className="absolute bottom-44 right-3 glass rounded-xl p-3 hidden lg:block" style={{ zIndex: 800 }}>
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Category</p>
        {Object.entries(CATEGORIES).slice(0, 7).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 mb-1">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: v.color }} />
            <span className="text-xs text-slate-400">{lang === 'ne' ? v.np : v.en}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
