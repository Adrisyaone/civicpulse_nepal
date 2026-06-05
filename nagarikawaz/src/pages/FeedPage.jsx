import React, { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useReports } from '../hooks'
import ReportCard from '../components/reports/ReportCard'
import { Spinner, EmptyState } from '../components/ui'
import { useLang } from '../context/LangContext'
import { CATEGORIES, PROVINCES, SEVERITIES } from '../utils/constants'
import { cn } from '../utils/helpers'

export default function FeedPage() {
  const { lang, tr } = useLang()
  const [filters,  setFilters]  = useState({})
  const [search,   setSearch]   = useState('')
  const [showF,    setShowF]    = useState(false)
  const { data: reports, isLoading } = useReports(filters)

  const filtered = (reports || []).filter((r) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (r.title_np||'').toLowerCase().includes(q) ||
           (r.title_en||'').toLowerCase().includes(q) ||
           (r.palika  ||'').toLowerCase().includes(q) ||
           (r.district||'').toLowerCase().includes(q)
  })

  function toggle(k, v) { setFilters((f) => ({ ...f, [k]: f[k] === v ? '' : v })) }
  const active = Object.values(filters).filter(Boolean).length

  const FilterPanel = () => (
    <div className="space-y-4">
      <div>
        <p className="label mb-2">{tr('category')}</p>
        <div className="space-y-1">
          {Object.entries(CATEGORIES).map(([k, v]) => (
            <button key={k} onClick={() => toggle('category', k)}
              className={cn('w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-left border transition-all',
                filters.category === k ? `${v.bg} ${v.text} ${v.border}` : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50')}>
              {v.icon} {lang === 'ne' ? v.np : v.en}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="label mb-2">{tr('province')}</p>
        <div className="space-y-1">
          {PROVINCES.map((p) => (
            <button key={p.id} onClick={() => toggle('province', p.name_en)}
              className={cn('w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-left transition-all',
                filters.province === p.name_en ? 'bg-brand-900/40 text-brand-400' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50')}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
              {lang === 'ne' ? p.name_np.split(' ')[0] : p.name_en.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>
      {active > 0 && (
        <button onClick={() => setFilters({})} className="text-xs text-red-400 hover:text-red-300">{tr('clearFilters')}</button>
      )}
    </div>
  )

  return (
    <div className="page-wrap">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">{tr('communityFeed')}</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {isLoading ? tr('loading') : `${filtered.length} ${tr('reports')}`}
          </p>
        </div>
        <div className="flex gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === 'ne' ? 'खोज्नुहोस्…' : 'Search…'}
            className="input text-sm w-40" />
          <button onClick={() => setShowF(!showF)}
            className={cn('btn-ghost text-sm', showF ? 'border-brand-600/50 text-brand-400' : '')}>
            🔍 {tr('filter')}
            {active > 0 && <span className="w-4 h-4 rounded-full text-white text-xs flex items-center justify-center ml-1 font-mono" style={{ background: '#DC143C' }}>{active}</span>}
          </button>
          <Link to="/report/new" className="btn-nepal text-sm">➕</Link>
        </div>
      </div>

      <div className="flex gap-5">
        {/* Sidebar */}
        {showF && (
          <aside className="hidden md:block w-52 flex-shrink-0">
            <div className="card p-4 sticky top-20"><FilterPanel /></div>
          </aside>
        )}

        {/* Mobile sheet */}
        {showF && (
          <div className="md:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-black/60" onClick={() => setShowF(false)} />
            <div className="absolute bottom-0 left-0 right-0 card rounded-b-none p-5 max-h-[75vh] overflow-y-auto animate-slide-up">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-white">{tr('filter')}</h3>
                <button onClick={() => setShowF(false)} className="text-slate-500 hover:text-white text-xl">×</button>
              </div>
              <FilterPanel />
              <button className="btn-nepal w-full justify-center mt-4" onClick={() => setShowF(false)}>{tr('submit')}</button>
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon="📋" titleKey="noReports"
              action={<button className="btn-ghost text-sm" onClick={() => { setFilters({}); setSearch('') }}>{tr('clearFilters')}</button>} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>{filtered.map((r) => <ReportCard key={r.id} report={r} />)}</AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
