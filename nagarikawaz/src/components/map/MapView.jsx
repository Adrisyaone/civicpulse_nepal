import React, { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'
import { useNavigate } from 'react-router-dom'
import { useReports, useGeolocation } from '../../hooks'
import { createMarkerIcon, timeAgo, cn } from '../../utils/helpers'
import { CATEGORIES, MAP_DEFAULTS, PROVINCES } from '../../utils/constants'
import { CategoryBadge, SeverityBadge, StatusBadge, Spinner } from '../ui'
import { useLang } from '../../context/LangContext'

const TILE_LAYERS = {
  street:    { url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',    attr:'© OpenStreetMap', label:{en:'Street',np:'सडक'},       icon:'🗺️' },
  satellite: { url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr:'© Esri', label:{en:'Satellite',np:'स्याटेलाइट'}, icon:'🛰️' },
  topo:      { url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',      attr:'© OpenTopoMap',  label:{en:'Topo',np:'टोपो'},         icon:'⛰️' },
  hybrid:    { url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr:'© Esri', label:{en:'Hybrid',np:'हाइब्रिड'},     icon:'🌍', overlay:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' },
}

const PROV_COLORS = { '1':'#e74c3c','2':'#e67e22','3':'#27ae60','4':'#2980b9','5':'#8e44ad','6':'#16a085','7':'#c0392b' }

let _hierCache = null
async function loadHierarchy() {
  if (_hierCache) return _hierCache
  _hierCache = await fetch('/nepal_hierarchy.json').then(r=>r.json())
  return _hierCache
}

let _gjCache = null
async function loadGeoJSON() {
  if (_gjCache) return _gjCache
  _gjCache = await fetch('/nepal_palikas.geojson').then(r=>r.json())
  return _gjCache
}

export default function MapView({ filters = {} }) {
  const mapRef      = useRef(null)
  const mapInst     = useRef(null)
  const clusterRef  = useRef(null)
  const tileRef     = useRef(null)
  const overlayRef  = useRef(null)
  const gjLayerRef  = useRef(null)
  const navigate    = useNavigate()
  const { lang }    = useLang()
  const { location, getLocation } = useGeolocation()
  const { data: reports, isLoading } = useReports(filters)

  const [selected,   setSelected]   = useState(null)
  const [tileMode,   setTileMode]   = useState('street')
  const [mapLevel,   setMapLevel]   = useState('country')
  const [selProv,    setSelProv]    = useState(null)
  const [selDist,    setSelDist]    = useState(null)
  const [hierarchy,  setHierarchy]  = useState(null)
  const [gjLoading,  setGjLoading]  = useState(false)
  const [showLayers, setShowLayers] = useState(false)

  useEffect(() => {
    if (mapInst.current) return
    const map = L.map(mapRef.current, {
      center: MAP_DEFAULTS.center, zoom: MAP_DEFAULTS.zoom, minZoom: 5, maxZoom: 19, zoomControl: false,
    })
    L.control.zoom({ position: 'topright' }).addTo(map)
    tileRef.current = L.tileLayer(TILE_LAYERS.street.url, { attribution: TILE_LAYERS.street.attr, maxZoom:19 }).addTo(map)
    const cluster = L.markerClusterGroup({ maxClusterRadius:55, disableClusteringAtZoom:15, spiderfyOnMaxZoom:true })
    map.addLayer(cluster)
    clusterRef.current = cluster
    mapInst.current    = map
    return () => { map.remove(); mapInst.current = null }
  }, [])

  useEffect(() => {
    if (!clusterRef.current) return
    clusterRef.current.clearLayers()
    if (!reports?.length) return
    reports.forEach(r => {
      if (!r.lat || !r.lng) return
      const m = L.marker([parseFloat(r.lat), parseFloat(r.lng)], { icon: createMarkerIcon(r.category, r.severity) })
      m.on('click', () => setSelected(r))
      clusterRef.current.addLayer(m)
    })
  }, [reports])

  useEffect(() => {
    if (!mapInst.current || !location) return
    mapInst.current.flyTo([location.lat, location.lng], 14, { duration: 1 })
  }, [location])

  useEffect(() => { loadHierarchy().then(setHierarchy) }, [])

  const switchTile = useCallback((mode) => {
    const map = mapInst.current; if (!map) return
    if (tileRef.current)    { map.removeLayer(tileRef.current); tileRef.current = null }
    if (overlayRef.current) { map.removeLayer(overlayRef.current); overlayRef.current = null }
    const def = TILE_LAYERS[mode]
    tileRef.current = L.tileLayer(def.url, { attribution: def.attr, maxZoom: 19 }).addTo(map)
    if (mode === 'hybrid' && def.overlay) {
      overlayRef.current = L.tileLayer(def.overlay, { attribution:'© OSM', maxZoom:19, opacity:0.4 }).addTo(map)
    }
    setTileMode(mode); setShowLayers(false)
  }, [])

  const renderBoundaries = useCallback(async (level, provId, distName) => {
    const map = mapInst.current; if (!map) return
    if (gjLayerRef.current) { map.removeLayer(gjLayerRef.current); gjLayerRef.current = null }
    if (level === 'country') return
    setGjLoading(true)
    try {
      const gj = await loadGeoJSON()
      let feats = gj.features
      if (provId) feats = feats.filter(f => f.properties.province_no === provId)
      if (distName) feats = feats.filter(f => f.properties.district === distName)
      if (!feats.length) { setGjLoading(false); return }

      const layer = L.geoJSON({ type:'FeatureCollection', features: feats }, {
        style: f => {
          const c = PROV_COLORS[f.properties.province_no] || '#2d9265'
          return { fillColor:c, fillOpacity: distName ? 0.28 : 0.18, color:c, weight: distName ? 1.5 : 1, opacity:0.85 }
        },
        onEachFeature: (f, lyr) => {
          const p  = f.properties
          const nm = lang === 'ne' ? (p.name_np || p.name_en) : (p.name_en || p.name_np)
          lyr.bindTooltip(nm, { permanent:false, direction:'center', className:'gj-tooltip' })
          lyr.on('click', () => {
            if (level === 'province') drillTo('district', provId, p.district)
            else if (level === 'district') {
              const map2 = mapInst.current
              if (map2 && lyr.getBounds) map2.flyToBounds(lyr.getBounds(), { padding:[20,20], maxZoom:14, duration:0.7 })
            }
          })
        },
      }).addTo(map)

      gjLayerRef.current = layer
      const bounds = layer.getBounds()
      if (bounds.isValid()) map.flyToBounds(bounds, { padding:[28,28], duration:0.8, maxZoom: distName ? 13 : 9 })
    } catch(err) { console.error('GeoJSON error:', err) }
    setGjLoading(false)
  }, [lang])

  const drillTo = useCallback((level, provId, distName) => {
    setMapLevel(level); setSelProv(provId||null); setSelDist(distName||null)
    renderBoundaries(level, provId, distName)
  }, [renderBoundaries])

  const resetToCountry = () => {
    setMapLevel('country'); setSelProv(null); setSelDist(null)
    if (gjLayerRef.current && mapInst.current) { mapInst.current.removeLayer(gjLayerRef.current); gjLayerRef.current = null }
    if (mapInst.current) mapInst.current.flyTo(MAP_DEFAULTS.center, MAP_DEFAULTS.zoom, { duration:0.8 })
  }

  const tf = r => lang === 'ne' ? (r.title_np || r.title_en) : (r.title_en || r.title_np)

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />
      <style>{`.gj-tooltip{background:#0d1a0f!important;color:#e8f5ee!important;border:1px solid #1f7350!important;border-radius:6px!important;font-family:'Mukta',sans-serif!important;font-size:12px!important;padding:3px 8px!important;box-shadow:none!important}`}</style>

      {/* Loading */}
      {(isLoading || gjLoading) && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 glass px-4 py-2 rounded-full flex items-center gap-2">
          <Spinner size="sm" />
          <span className="text-xs text-slate-300">{gjLoading ? (lang==='ne'?'सिमाना लोड…':'Loading boundaries…') : (lang==='ne'?'लोड…':'Loading…')}</span>
        </div>
      )}

      {/* LEFT PANEL — drill down */}
      <div className="absolute top-3 left-3 z-30 flex flex-col gap-2">
        {/* Count */}
        <div className="glass rounded-xl px-3 py-2">
          <div className="font-mono text-brand-400 font-bold text-xl leading-none">{reports?.length ?? 0}</div>
          <div className="text-xs text-slate-500">{lang==='ne'?'रिपोर्ट':'issues'}</div>
        </div>

        {/* Level panel */}
        <div className="glass rounded-xl p-2 w-44">
          <p className="text-xs text-slate-500 px-1 mb-1 uppercase tracking-wide">{lang==='ne'?'तह':'Drill down'}</p>

          <button onClick={resetToCountry}
            className={cn('w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all',
              mapLevel==='country' ? 'bg-brand-600/20 text-brand-400 font-medium' : 'text-slate-400 hover:bg-white/5 hover:text-white')}>
            🇳🇵 {lang==='ne'?'सम्पूर्ण नेपाल':'All Nepal'}
          </button>

          <div className="mt-1 space-y-0.5">
            {PROVINCES.map(p => (
              <button key={p.id} onClick={() => drillTo('province', p.id, null)}
                className={cn('w-full text-left px-2 py-1 rounded-lg text-xs flex items-center gap-1.5 transition-all',
                  selProv===p.id ? 'bg-brand-600/15 text-brand-400 font-medium' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300')}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:PROV_COLORS[p.id]}} />
                <span className="truncate">{lang==='ne' ? p.name_np.replace(' प्रदेश','') : `P${p.id}`}</span>
              </button>
            ))}
          </div>

          {/* District sub-panel */}
          {selProv && hierarchy && (
            <div className="mt-1.5 pt-1.5 border-t border-slate-800/60">
              <p className="text-xs text-slate-600 px-1 mb-1">{lang==='ne'?'जिल्ला':'District'}</p>
              <div className="max-h-36 overflow-y-auto space-y-0.5 pr-0.5">
                {Object.keys(hierarchy[selProv]?.districts||{}).sort().map(dist => (
                  <button key={dist} onClick={() => drillTo('district', selProv, dist)}
                    className={cn('w-full text-left px-2 py-1 rounded text-xs transition-all',
                      selDist===dist ? 'bg-amber-500/20 text-amber-400 font-medium' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300')}>
                    {dist}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT CONTROLS */}
      <div className="absolute top-3 right-14 z-30 flex flex-col gap-2">
        {/* Layer switcher */}
        <div className="relative">
          <button onClick={() => setShowLayers(!showLayers)} title="Map layers"
            className="glass w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/10 text-brand-400 transition-all text-base">
            {TILE_LAYERS[tileMode].icon}
          </button>
          {showLayers && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setShowLayers(false)} />
              <div className="absolute right-0 top-full mt-1 z-30 glass rounded-xl p-2 w-36 animate-fade-in">
                <p className="text-xs text-slate-500 px-2 mb-1">{lang==='ne'?'नक्सा प्रकार':'Map type'}</p>
                {Object.entries(TILE_LAYERS).map(([key, def]) => (
                  <button key={key} onClick={() => switchTile(key)}
                    className={cn('w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-all',
                      tileMode===key ? 'bg-brand-600/20 text-brand-400 font-medium' : 'text-slate-400 hover:bg-white/5 hover:text-white')}>
                    <span>{def.icon}</span>
                    {lang==='ne' ? def.label.np : def.label.en}
                    {tileMode===key && <span className="ml-auto">✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <button onClick={getLocation} title="My location"
          className="glass w-9 h-9 rounded-lg flex items-center justify-center hover:bg-white/10 text-brand-400 transition-all text-base">📍</button>
        <button onClick={() => navigate('/report/new')} title="Report issue"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white transition-all text-base"
          style={{background:'#DC143C'}}>➕</button>
      </div>

      {/* BREADCRUMB */}
      {mapLevel !== 'country' && (
        <div className="absolute bottom-20 left-3 z-30 glass rounded-lg px-3 py-1.5 flex items-center gap-1 text-xs lg:hidden">
          <button onClick={resetToCountry} className="text-brand-400 hover:text-brand-300">🇳🇵</button>
          {selProv && <>
            <span className="text-slate-600">›</span>
            <button onClick={() => drillTo('province', selProv, null)}
              className={cn('hover:text-brand-300', selDist ? 'text-slate-400':'text-brand-400')}>
              P{selProv}
            </button>
          </>}
          {selDist && <><span className="text-slate-600">›</span><span className="text-amber-400">{selDist}</span></>}
        </div>
      )}

      {/* Province+category legend — desktop */}
      <div className="absolute bottom-4 left-3 z-30 glass rounded-xl p-2.5 hidden lg:block text-xs">
        <div className="grid grid-cols-2 gap-x-4">
          <div>
            <p className="text-slate-500 uppercase tracking-wide mb-1.5">Provinces</p>
            {PROVINCES.map(p => (
              <button key={p.id} onClick={() => drillTo('province', p.id, null)}
                className="flex items-center gap-1.5 mb-1 w-full hover:opacity-80">
                <div className="w-2.5 h-2.5 rounded-sm" style={{background:PROV_COLORS[p.id]}} />
                <span className="text-slate-400">{lang==='ne' ? p.name_np.split(' ')[0] : `P${p.id}`}</span>
              </button>
            ))}
          </div>
          <div>
            <p className="text-slate-500 uppercase tracking-wide mb-1.5">Categories</p>
            {Object.entries(CATEGORIES).slice(0,5).map(([k,v]) => (
              <div key={k} className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full" style={{background:v.color}} />
                <span className="text-slate-500">{lang==='ne'?v.np:v.en}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Report popup */}
      {selected && (
        <div className="absolute bottom-4 right-3 z-30 w-80 card shadow-2xl animate-slide-up">
          <div className="p-4">
            <button onClick={() => setSelected(null)}
              className="absolute top-3 right-3 text-slate-500 hover:text-white text-xl leading-none">×</button>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <CategoryBadge category={selected.category} />
              <SeverityBadge severity={selected.severity} />
              <StatusBadge   status={selected.status} />
            </div>
            <h3 className="font-display font-semibold text-white text-sm mb-1 pr-6 leading-snug">{tf(selected)}</h3>
            {(selected.palika||selected.district) && (
              <p className="text-xs text-brand-500 mb-2">
                📍 {selected.palika}{selected.ward_no?` W-${selected.ward_no}`:''}{selected.district?`, ${selected.district}`:''}
              </p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-600">{timeAgo(selected.created_at)}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">👍 {selected.upvotes||0}</span>
                <button onClick={() => { navigate(`/report/${selected.id}`); setSelected(null) }}
                  className="btn-primary py-1 px-3 text-xs">
                  {lang==='ne'?'हेर्नुहोस्':'View'} →
                </button>
              </div>
            </div>
          </div>
          {selected.photo_ids && (
            <div className="border-t border-slate-800">
              <img src={`https://drive.google.com/thumbnail?id=${selected.photo_ids.split(',')[0]}&sz=w280`}
                alt="report" className="w-full h-28 object-cover rounded-b-xl"
                onError={e=>e.target.style.display='none'} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
