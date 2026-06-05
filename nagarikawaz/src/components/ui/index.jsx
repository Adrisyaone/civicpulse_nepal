import React from 'react'
import { cn } from '../../utils/helpers'
import { CATEGORIES, SEVERITIES, STATUSES, ROLES } from '../../utils/constants'
import { useLang } from '../../context/LangContext'

export function Spinner({ size = 'md', className = '' }) {
  const s = { sm: 'w-4 h-4 border-2', md: 'w-6 h-6 border-2', lg: 'w-10 h-10 border-2', xl: 'w-16 h-16 border-[3px]' }[size]
  return <div className={cn('animate-spin rounded-full border-slate-700 border-t-brand-500', s, className)} />
}

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-[#060e08] flex flex-col items-center justify-center gap-4 z-[9999]">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-[3px] border-brand-900 border-t-brand-500 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-nepal-red text-xl font-bold">न</div>
      </div>
      <div className="text-center">
        <p className="font-display font-bold text-brand-400 text-lg">नागरिक आवाज</p>
        <p className="text-slate-600 text-xs mt-1">लोड हुँदैछ…</p>
      </div>
    </div>
  )
}

export function ShimmerCard({ h = 'h-24', className = '' }) {
  return <div className={cn('shimmer rounded-xl border border-slate-800', h, className)} />
}

export function CategoryBadge({ category }) {
  const { lang } = useLang()
  const c = CATEGORIES[category] || CATEGORIES.other
  return (
    <span className={cn('badge border', c.bg, c.text, c.border)}>
      <span className="text-xs">{c.icon}</span>
      {lang === 'ne' ? c.np : c.en}
    </span>
  )
}

export function SeverityBadge({ severity }) {
  const { lang } = useLang()
  const s = SEVERITIES[severity] || SEVERITIES.medium
  return (
    <span className={cn('badge border', s.bg, s.text, s.border)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', s.dot)} />
      {lang === 'ne' ? s.np : s.en}
    </span>
  )
}

export function StatusBadge({ status }) {
  const { lang } = useLang()
  const s = STATUSES[status] || STATUSES.darta
  return <span className={cn('badge', s.bg, s.text)}>{lang === 'ne' ? s.np : s.en}</span>
}

export function RoleBadge({ role }) {
  const { lang } = useLang()
  const r = ROLES[role] || ROLES.nagarik
  return <span className={cn('badge', r.bg, r.color)}>{lang === 'ne' ? r.np : r.en}</span>
}

export function ProgressBar({ value = 0, color = 'bg-brand-500', className = '' }) {
  return (
    <div className={cn('w-full bg-slate-800 rounded-full h-2 overflow-hidden', className)}>
      <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export function EmptyState({ icon = '📋', titleKey, title, action }) {
  const { tr } = useLang()
  return (
    <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="font-display font-semibold text-lg text-slate-200 mb-2">{titleKey ? tr(titleKey) : title}</h3>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export class ErrorBoundary extends React.Component {
  state = { err: null }
  static getDerivedStateFromError(e) { return { err: e } }
  componentDidCatch(e, info) { console.error('[ErrorBoundary]', e, info) }
  render() {
    if (this.state.err) return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-[#060e08]">
        <div className="card p-8 max-w-md text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="font-display text-xl font-bold text-red-400 mb-2">केही गडबड भयो</h2>
          <p className="text-slate-500 text-sm mb-6">{this.state.err.message}</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>पुनः लोड / Reload</button>
        </div>
      </div>
    )
    return this.props.children
  }
}

export function StatCard({ labelKey, value, icon, color = 'text-brand-400', loading }) {
  const { tr } = useLang()
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <span className="text-slate-500 text-xs uppercase tracking-wider">{tr(labelKey)}</span>
        <span className="text-xl">{icon}</span>
      </div>
      {loading
        ? <div className="shimmer h-8 w-20 rounded mt-1" />
        : <div className={cn('font-display text-3xl font-bold mt-1', color)}>{value ?? '—'}</div>
      }
    </div>
  )
}

export function Modal({ open, onClose, titleKey, title, children, width = 'max-w-lg' }) {
  const { tr } = useLang()
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/72 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative card w-full animate-slide-up rounded-b-none sm:rounded-xl', width)}>
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="font-display font-semibold text-lg text-white">{titleKey ? tr(titleKey) : title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-white text-2xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function WardTag({ palika, wardNo, district }) {
  if (!palika) return null
  return (
    <span className="badge bg-brand-900/50 text-brand-400 border border-brand-800/40 font-mono text-xs">
      📍 {palika}{wardNo ? ` W-${wardNo}` : ''}{district ? `, ${district}` : ''}
    </span>
  )
}
