import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useLang } from '../../context/LangContext'
import { PROVINCES } from '../../utils/constants'
import { cn } from '../../utils/helpers'

// Lazy-loaded palika list from shapefile
let _palikaCache = null
async function loadPalikas() {
  if (_palikaCache) return _palikaCache
  const res = await fetch('/nepal_palika_list.json')
  _palikaCache = await res.json()
  return _palikaCache
}

export default function PalikaPicker({ value, onChange, province, district, className = '' }) {
  const { lang } = useLang()
  const [palikas,  setPalikas]  = useState([])
  const [search,   setSearch]   = useState('')
  const [open,     setOpen]     = useState(false)
  const [loading,  setLoading]  = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    setLoading(true)
    loadPalikas().then((data) => { setPalikas(data); setLoading(false) })
  }, [])

  // Close on outside click
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = useMemo(() => {
    let list = palikas
    if (province) {
      const prov = PROVINCES.find((p) => p.name_en === province || p.name_np === province)
      if (prov) list = list.filter((p) => p.pn === prov.id)
    }
    if (district) list = list.filter((p) => p.d === district)
    if (search)   list = list.filter((p) =>
      p.n.toLowerCase().includes(search.toLowerCase()) ||
      p.np.includes(search) ||
      p.d.toLowerCase().includes(search.toLowerCase())
    )
    return list.slice(0, 80)
  }, [palikas, province, district, search])

  const selected = palikas.find((p) => p.n === value || p.np === value)
  const displayLabel = selected
    ? (lang === 'ne' ? selected.np : selected.n)
    : (lang === 'ne' ? 'पालिका छान्नुहोस्…' : 'Select Palika…')

  const typeColors = {
    mahanagarpalika:     'text-red-400',
    upa_mahanagarpalika: 'text-orange-400',
    nagarpalika:         'text-amber-400',
    gaunpalika:          'text-green-400',
  }
  const typeLabels = {
    mahanagarpalika:     { ne: 'महा', en: 'Metro' },
    upa_mahanagarpalika: { ne: 'उप-महा', en: 'Sub-Metro' },
    nagarpalika:         { ne: 'न.पा.', en: 'Municipality' },
    gaunpalika:          { ne: 'गा.पा.', en: 'Rural' },
  }

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full text-left input flex items-center justify-between',
          open ? 'border-brand-600 ring-2 ring-brand-600/20' : ''
        )}
      >
        <span className={cn(selected ? 'text-slate-100' : 'text-slate-500', 'text-sm truncate')}>
          {displayLabel}
        </span>
        <span className="text-slate-600 ml-2 flex-shrink-0">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 card shadow-2xl border-brand-800/40 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-slate-800">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === 'ne' ? 'पालिका खोज्नुहोस्…' : 'Search palika…'}
              className="input text-sm py-1.5"
            />
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-56">
            {loading ? (
              <div className="text-center py-4 text-slate-500 text-sm">लोड हुँदैछ…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-4 text-slate-500 text-sm">
                {lang === 'ne' ? 'कुनै पालिका फेला परेन' : 'No palika found'}
              </div>
            ) : (
              filtered.map((p) => {
                const sel = p.n === value || p.np === value
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onChange(p)
                      setOpen(false)
                      setSearch('')
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-800/60 transition-colors',
                      sel ? 'bg-brand-900/40' : ''
                    )}
                  >
                    <div>
                      <span className={cn('text-sm', sel ? 'text-brand-400 font-medium' : 'text-slate-200')}>
                        {lang === 'ne' ? p.np : p.n}
                      </span>
                      <div className="text-xs text-slate-500">
                        {p.d} {p.pn && `· प्रदेश ${p.pn}`}
                      </div>
                    </div>
                    <span className={cn('text-xs font-medium flex-shrink-0 ml-2', typeColors[p.t])}>
                      {lang === 'ne' ? typeLabels[p.t]?.ne : typeLabels[p.t]?.en}
                    </span>
                  </button>
                )
              })
            )}
          </div>

          {filtered.length === 80 && (
            <div className="px-3 py-1.5 border-t border-slate-800 text-xs text-slate-600 text-center">
              {lang === 'ne' ? 'थप खोज्नुहोस्' : 'Refine search to see more'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
