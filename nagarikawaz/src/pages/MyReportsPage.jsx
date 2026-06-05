import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useReports } from '../hooks'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import ReportCard from '../components/reports/ReportCard'
import { Spinner, EmptyState } from '../components/ui'
import { cn } from '../utils/helpers'

export default function MyReportsPage() {
  const { user, profile } = useAuth()
  const { lang, tr }      = useLang()
  const { data: all, isLoading } = useReports({})
  const [tab, setTab] = useState('open')

  const mine = (all || []).filter((r) =>
    r.submitter_email === user?.email ||
    r.submitted_by    === (profile?.name_np || profile?.name_en)
  )
  const tabs = {
    open:     mine.filter((r) => !['samaadhaan','banda'].includes(r.status)),
    resolved: mine.filter((r) =>  ['samaadhaan','banda'].includes(r.status)),
    all:      mine,
  }
  const tabLabels = { open: { ne:'खुला', en:'Open' }, resolved: { ne:'समाधान', en:'Resolved' }, all: { ne:'सबै', en:'All' } }

  return (
    <div className="page-wrap max-w-4xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">{tr('myReports')}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{mine.length} {tr('reports')}</p>
        </div>
        <Link to="/report/new" className="btn-nepal text-sm">➕ {tr('newReport')}</Link>
      </div>

      <div className="flex gap-1 mb-5 bg-slate-900 rounded-xl p-1 w-fit">
        {Object.entries(tabLabels).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={cn('px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
              tab === k ? 'bg-brand-700 text-brand-200' : 'text-slate-500 hover:text-slate-300')}>
            {lang === 'ne' ? l.ne : l.en}
            <span className="font-mono text-xs ml-1 opacity-60">{tabs[k].length}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : tabs[tab].length === 0 ? (
        <EmptyState icon="📋" title={lang === 'ne' ? 'कुनै रिपोर्ट छैन' : 'No reports'}
          action={<Link to="/report/new" className="btn-nepal text-sm">{lang === 'ne' ? 'समस्या रिपोर्ट' : 'Report an issue'}</Link>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>{tabs[tab].map((r) => <ReportCard key={r.id} report={r} />)}</AnimatePresence>
        </div>
      )}
    </div>
  )
}
