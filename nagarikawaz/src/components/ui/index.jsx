import React from 'react'
import { cn } from '../../utils/helpers'
import { CATEGORIES, SEVERITIES, STATUSES, ROLES } from '../../utils/constants'
import { useLang } from '../../context/LangContext'

export function Spinner({ size = 'md', className = '' }) {
  const s = { sm:'w-4 h-4 border-[1.5px]', md:'w-5 h-5 border-2', lg:'w-9 h-9 border-2', xl:'w-14 h-14 border-[3px]' }[size]
  return <div className={cn('animate-spin rounded-full border-slate-700 border-t-brand-400', s, className)} />
}

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 z-[9999]" style={{background:'#080f09'}}>
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-[3px] border-brand-900/50 border-t-brand-400 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-xl font-bold" style={{color:'#DC143C'}}>न</div>
      </div>
      <div className="text-center">
        <p className="font-display font-bold text-brand-400 text-base">नागरिक आवाज</p>
        <p className="text-slate-600 text-xs mt-0.5">NagarikAwaz</p>
      </div>
    </div>
  )
}

export function ShimmerCard({ h = 'h-24', className = '' }) {
  return <div className={cn('shimmer rounded-2xl', h, className)} />
}

export function CategoryBadge({ category }) {
  const { lang } = useLang()
  const c = CATEGORIES[category] || CATEGORIES.other
  return (
    <span className={cn('badge', c.bg, c.text, 'border', c.border)}>
      <span>{c.icon}</span>
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

export function ProgressBar({ value = 0, color = 'bg-brand-500' }) {
  return (
    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-700', color)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}

export function EmptyState({ icon = '📋', titleKey, title, message, action }) {
  const { tr } = useLang()
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="text-5xl mb-4 opacity-80">{icon}</div>
      <h3 className="font-display font-semibold text-lg text-slate-200 mb-1">
        {titleKey ? tr(titleKey) : title}
      </h3>
      {message && <p className="text-slate-500 text-sm max-w-xs mb-5">{message}</p>}
      {action && <div>{action}</div>}
    </div>
  )
}

export class ErrorBoundary extends React.Component {
  state = { err: null }
  static getDerivedStateFromError(e) { return { err: e } }
  componentDidCatch(e, info) { console.error('[ErrorBoundary]', e, info) }
  render() {
    if (this.state.err) return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{background:'#080f09'}}>
        <div className="card p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="font-display text-xl font-bold text-red-400 mb-2">Something went wrong</h2>
          <p className="text-slate-500 text-sm mb-6">{this.state.err.message}</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      </div>
    )
    return this.props.children
  }
}

export function StatCard({ labelKey, value, icon, color = 'text-brand-400', loading, subtitle }) {
  const { tr } = useLang()
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-2">
        <span className="text-slate-500 text-xs uppercase tracking-wider font-medium">{tr(labelKey)}</span>
        <span className="text-2xl opacity-80">{icon}</span>
      </div>
      {loading
        ? <div className="shimmer h-9 w-20 rounded-lg" />
        : <div className={cn('font-display text-3xl font-bold', color)}>{value ?? '—'}</div>
      }
      {subtitle && <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>}
    </div>
  )
}

export function Modal({ open, onClose, titleKey, title, children, width = 'max-w-lg' }) {
  const { tr } = useLang()
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative card-solid border border-slate-700/60 w-full animate-slide-up', 'rounded-t-2xl sm:rounded-2xl', width)}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-display font-semibold text-lg text-white">
            {titleKey ? tr(titleKey) : title}
          </h2>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-white hover:bg-white/10 transition-all text-xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function WardTag({ palika, wardNo, district }) {
  if (!palika && !district) return null
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-brand-950/70 text-brand-400 border border-brand-900/60">
      📍 {palika}{wardNo ? ` W-${wardNo}` : ''}{district ? `, ${district}` : ''}
    </span>
  )
}

export function Divider() {
  return <div className="border-t border-slate-800/60 my-4" />
}
