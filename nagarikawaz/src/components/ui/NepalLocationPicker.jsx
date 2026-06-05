import React, { useState, useEffect, useMemo } from 'react'
import { useLang } from '../../context/LangContext'
import { PROVINCES } from '../../utils/constants'
import { cn } from '../../utils/helpers'

let _cache = null
async function loadHierarchy() {
  if (_cache) return _cache
  _cache = await fetch('/nepal_hierarchy.json').then(r => r.json())
  return _cache
}

const PALIKA_TYPE_LABEL = {
  mahanagarpalika:     { en:'Metro',    np:'महा.न.पा.' },
  upa_mahanagarpalika: { en:'Sub-Metro',np:'उप-म.न.पा.' },
  nagarpalika:         { en:'Mun.',     np:'न.पा.' },
  gaunpalika:          { en:'Rural',    np:'गा.पा.' },
}
const PALIKA_TYPE_COLOR = {
  mahanagarpalika:     'text-red-400',
  upa_mahanagarpalika: 'text-orange-400',
  nagarpalika:         'text-amber-400',
  gaunpalika:          'text-green-400',
}

export default function NepalLocationPicker({
  value = {},         // { province, district, palika, palika_type, ward_no, lat, lon }
  onChange,           // (newValue) => void
  required = false,
  showWard = true,
}) {
  const { lang } = useLang()
  const [hierarchy, setHierarchy] = useState(null)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    loadHierarchy().then(h => { setHierarchy(h); setLoading(false) })
  }, [])

  // Derive current province object
  const provObj = PROVINCES.find(p =>
    p.name_en === value.province || p.name_np === value.province || p.id === value.province
  )

  // Districts for selected province (from shapefile hierarchy)
  const districts = useMemo(() => {
    if (!hierarchy || !provObj) return []
    return Object.keys(hierarchy[provObj.id]?.districts || {}).sort()
  }, [hierarchy, provObj])

  // Palikas for selected district
  const palikas = useMemo(() => {
    if (!hierarchy || !provObj || !value.district) return []
    return (hierarchy[provObj.id]?.districts?.[value.district] || [])
      .sort((a, b) => a.n.localeCompare(b.n))
  }, [hierarchy, provObj, value.district])

  function setProvince(provName) {
    const p = PROVINCES.find(x => x.name_en === provName)
    onChange({ ...value, province: provName, province_id: p?.id || '', district: '', palika: '', palika_type: '', ward_no: '', lat: '', lon: '' })
  }

  function setDistrict(dist) {
    onChange({ ...value, district: dist, palika: '', palika_type: '', ward_no: '', lat: '', lon: '' })
  }

  function setPalika(palikaObj) {
    onChange({
      ...value,
      palika:      palikaObj.n,
      palika_np:   palikaObj.np,
      palika_type: palikaObj.t,
      lat:         palikaObj.lat,
      lon:         palikaObj.lon,
    })
  }

  const sel = cn('input text-sm', required && !value.palika ? 'border-red-700/50' : '')

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="shimmer h-10 rounded-lg" />)}
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Province */}
      <div>
        <label className="label">
          {lang === 'ne' ? 'प्रदेश' : 'Province'}{required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <select
          value={value.province || ''}
          onChange={e => setProvince(e.target.value)}
          className={cn('input text-sm', required && !value.province ? 'border-red-700/50' : '')}
        >
          <option value="">{lang === 'ne' ? 'प्रदेश छान्नुहोस्…' : 'Select Province…'}</option>
          {PROVINCES.map(p => (
            <option key={p.id} value={p.name_en}>
              {lang === 'ne' ? p.name_np : `${p.name_en} (P${p.id})`}
            </option>
          ))}
        </select>
      </div>

      {/* District */}
      <div>
        <label className="label">
          {lang === 'ne' ? 'जिल्ला' : 'District'}{required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <select
          value={value.district || ''}
          onChange={e => setDistrict(e.target.value)}
          disabled={!value.province}
          className={cn('input text-sm disabled:opacity-40', required && value.province && !value.district ? 'border-red-700/50' : '')}
        >
          <option value="">{value.province ? (lang==='ne'?'जिल्ला छान्नुहोस्…':'Select District…') : (lang==='ne'?'पहिले प्रदेश छान्नुहोस्':'Select Province first')}</option>
          {districts.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Palika — searchable */}
      <div>
        <label className="label">
          {lang === 'ne' ? 'पालिका' : 'Municipality / Palika'}{required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <PalikaSelect
          palikas={palikas}
          value={value.palika || ''}
          onChange={setPalika}
          disabled={!value.district}
          lang={lang}
          required={required}
        />
        {value.palika_type && (
          <p className={cn('text-xs mt-1', PALIKA_TYPE_COLOR[value.palika_type])}>
            {lang === 'ne'
              ? PALIKA_TYPE_LABEL[value.palika_type]?.np
              : PALIKA_TYPE_LABEL[value.palika_type]?.en}
            {value.lat && <span className="text-slate-600 ml-2">({parseFloat(value.lat).toFixed(4)}, {parseFloat(value.lon).toFixed(4)})</span>}
          </p>
        )}
      </div>

      {/* Ward number */}
      {showWard && (
        <div>
          <label className="label">
            {lang === 'ne' ? 'वडा नम्बर' : 'Ward Number'}{required && <span className="text-red-400 ml-1">*</span>}
          </label>
          <input
            type="number" min="1" max="35"
            value={value.ward_no || ''}
            onChange={e => onChange({ ...value, ward_no: e.target.value })}
            disabled={!value.palika}
            placeholder={lang === 'ne' ? '१ – ३५' : '1 – 35'}
            className="input text-sm disabled:opacity-40"
          />
        </div>
      )}
    </div>
  )
}

// Searchable palika dropdown
function PalikaSelect({ palikas, value, onChange, disabled, lang, required }) {
  const [search, setSearch] = useState('')
  const [open,   setOpen]   = useState(false)

  const filtered = useMemo(() => {
    if (!search) return palikas.slice(0, 60)
    const q = search.toLowerCase()
    return palikas.filter(p =>
      p.n.toLowerCase().includes(q) || p.np.includes(search)
    ).slice(0, 60)
  }, [palikas, search])

  const selectedLabel = value
    ? (palikas.find(p => p.n === value))
    : null

  useEffect(() => { if (!open) setSearch('') }, [open])

  if (disabled) return (
    <div className={cn('input text-sm opacity-40 cursor-not-allowed text-slate-500')}>
      {lang === 'ne' ? 'पहिले जिल्ला छान्नुहोस्' : 'Select District first'}
    </div>
  )

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className={cn('input text-sm flex items-center justify-between text-left w-full',
          open ? 'border-brand-600 ring-2 ring-brand-600/20' : '',
          required && !value ? 'border-red-700/50' : ''
        )}>
        <span className={cn('truncate', selectedLabel ? 'text-slate-100' : 'text-slate-500')}>
          {selectedLabel
            ? (lang === 'ne' ? selectedLabel.np : selectedLabel.n)
            : (lang === 'ne' ? 'पालिका छान्नुहोस्…' : 'Select Palika…')}
        </span>
        <span className="text-slate-600 ml-2 flex-shrink-0 text-xs">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full left-0 right-0 mt-1 card border-brand-800/40 shadow-2xl overflow-hidden">
            <div className="p-2 border-b border-slate-800">
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={lang === 'ne' ? 'पालिका खोज्नुहोस्…' : 'Search palika…'}
                className="input text-sm py-1.5"
              />
            </div>
            <div className="max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-sm">
                  {lang === 'ne' ? 'फेला परेन' : 'Not found'}
                </div>
              ) : filtered.map(p => (
                <button key={p.id} type="button"
                  onClick={() => { onChange(p); setOpen(false) }}
                  className={cn(
                    'w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-800/60 transition-colors',
                    value === p.n ? 'bg-brand-900/40' : ''
                  )}>
                  <div>
                    <span className={cn('text-sm', value === p.n ? 'text-brand-400 font-medium' : 'text-slate-200')}>
                      {lang === 'ne' ? p.np : p.n}
                    </span>
                    {lang === 'en' && p.np !== p.n && (
                      <span className="text-xs text-slate-500 ml-2">{p.np}</span>
                    )}
                  </div>
                  <span className={cn('text-xs flex-shrink-0 ml-2 font-medium', PALIKA_TYPE_COLOR[p.t])}>
                    {lang === 'ne' ? PALIKA_TYPE_LABEL[p.t]?.np : PALIKA_TYPE_LABEL[p.t]?.en}
                  </span>
                </button>
              ))}
              {filtered.length === 60 && (
                <div className="px-3 py-1.5 text-xs text-slate-600 border-t border-slate-800 text-center">
                  {lang === 'ne' ? 'थप खोज्नुहोस्' : 'Type to narrow results'}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
