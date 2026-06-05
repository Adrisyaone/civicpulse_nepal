import React, { useState } from 'react'
import MapView from '../components/map/MapView'
import { CATEGORIES, PROVINCES, SEVERITIES } from '../utils/constants'
import { useLang } from '../context/LangContext'
import { cn } from '../utils/helpers'

export default function MapPage() {
  const { lang, tr } = useLang()
  const [filters,  setFilters]  = useState({})
  const [showF,    setShowF]    = useState(false)
  const active = Object.values(filters).filter(Boolean).length

  function toggle(k, v) { setFilters((f) => ({ ...f, [k]: f[k] === v ? '' : v })) }

  return (
    <div className="fixed inset-0" style={{ top: 'calc(53px + 40px)' }}>
      <style>{`@media(min-width:768px){.map-root{top:53px}}`}</style>
      <div className="map-root fixed inset-0" style={{ top: 'calc(53px + 40px)' }}>
        {/* Filter toggle */}
        <div className="absolute top-3 left-3 z-30 flex gap-2">
          <button onClick={() => setShowF(!showF)}
            className={cn('glass px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2',
              showF ? 'border-brand-600/50 text-brand-400' : 'text-slate-300 hover:text-white')}>
            🔍 {tr('filter')}
            {active > 0 && <span className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center font-mono" style={{ background: '#DC143C' }}>{active}</span>}
          </button>
        </div>

        {showF && (
          <>
            <div className="absolute inset-0 z-20" onClick={() => setShowF(false)} />
            <div className="absolute top-14 left-3 z-30 w-60 card p-4 shadow-xl max-h-[calc(100vh-160px)] overflow-y-auto animate-slide-up">
              <p className="label mb-2">{tr('category')}</p>
              <div className="space-y-1 mb-4">
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <button key={k} onClick={() => toggle('category', k)}
                    className={cn('w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left border transition-all',
                      filters.category === k ? `${v.bg} ${v.text} ${v.border}` : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50')}>
                    {v.icon} {lang === 'ne' ? v.np : v.en}
                  </button>
                ))}
              </div>
              <p className="label mb-2">{tr('severity')}</p>
              <div className="space-y-1 mb-4">
                {Object.entries(SEVERITIES).map(([k, v]) => (
                  <button key={k} onClick={() => toggle('severity', k)}
                    className={cn('w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left transition-all',
                      filters.severity === k ? `${v.bg} ${v.text}` : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50')}>
                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', v.dot)} />
                    {lang === 'ne' ? v.np : v.en}
                  </button>
                ))}
              </div>
              <p className="label mb-2">{tr('province')}</p>
              <div className="space-y-1">
                {PROVINCES.map((p) => (
                  <button key={p.id} onClick={() => toggle('province', p.name_en)}
                    className={cn('w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-left transition-all',
                      filters.province === p.name_en ? 'bg-brand-900/40 text-brand-400' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50')}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    {lang === 'ne' ? p.name_np.split(' ')[0] : p.name_en.split(' ')[0]}
                  </button>
                ))}
              </div>
              {active > 0 && (
                <button onClick={() => setFilters({})} className="text-xs text-red-400 hover:text-red-300 mt-3 w-full text-left">
                  ✕ {tr('clearFilters')}
                </button>
              )}
            </div>
          </>
        )}

        <MapView filters={filters} />
      </div>
    </div>
  )
}
