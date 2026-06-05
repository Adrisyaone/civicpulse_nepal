import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CategoryBadge, SeverityBadge, StatusBadge, ProgressBar, WardTag } from '../ui'
import { timeAgo, truncate, statusToProgress, driveThumb, cn } from '../../utils/helpers'
import { useUpvoteReport } from '../../hooks'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LangContext'

export default function ReportCard({ report: r, compact = false }) {
  const navigate    = useNavigate()
  const { user }    = useAuth()
  const { lang, tr } = useLang()
  const upvote      = useUpvoteReport()
  const progress    = statusToProgress(r.status)
  const photoId     = r.photo_ids?.split(',')[0]
  const title       = lang === 'ne' ? (r.title_np || r.title_en) : (r.title_en || r.title_np)
  const desc        = lang === 'ne' ? (r.description_np || r.description_en) : (r.description_en || r.description_np)

  function handleUpvote(e) {
    e.stopPropagation()
    if (!user) { navigate('/login'); return }
    upvote.mutate(r.id)
  }

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="card-hover overflow-hidden" onClick={() => navigate(`/report/${r.id}`)}>
      {photoId && !compact && (
        <div className="h-36 overflow-hidden bg-slate-800">
          <img src={driveThumb(photoId, 400)} alt={title}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.parentElement.style.display = 'none' }} />
        </div>
      )}
      <div className="p-4">
        <div className="flex flex-wrap gap-1.5 mb-2">
          <CategoryBadge category={r.category} />
          <SeverityBadge severity={r.severity} />
          <StatusBadge   status={r.status} />
          {r.priority_score > 0 && (
            <span className={cn('badge', r.priority_score >= 80 ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400')}>
              ⚡ {r.priority_score}
            </span>
          )}
        </div>
        <h3 className="font-display font-semibold text-slate-100 text-sm mb-1.5 leading-snug">{title}</h3>
        <div className="mb-2"><WardTag palika={r.palika} wardNo={r.ward_no} district={r.district} /></div>
        {!compact && desc && (
          <p className="text-slate-500 text-xs mb-3 leading-relaxed">{truncate(desc, 90)}</p>
        )}
        {!compact && progress > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-slate-600 mb-1">
              <span>{tr('progress')}</span>
              <span className="font-mono">{progress}%</span>
            </div>
            <ProgressBar value={progress} />
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-slate-600 mt-1">
          <span>{timeAgo(r.created_at)}</span>
          <div className="flex items-center gap-3">
            {r.comments_count > 0 && <span>💬 {r.comments_count}</span>}
            <button onClick={handleUpvote} disabled={upvote.isPending}
              className="flex items-center gap-1 hover:text-brand-400 transition-colors disabled:opacity-50">
              👍 <span className="font-mono">{r.upvotes || 0}</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
