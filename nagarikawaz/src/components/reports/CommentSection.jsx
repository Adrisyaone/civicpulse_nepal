import React, { useState } from 'react'
import { useComments, useAddComment } from '../../hooks'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LangContext'
import { Spinner } from '../ui'
import { timeAgo, driveThumb } from '../../utils/helpers'
import { useNavigate } from 'react-router-dom'

function Avatar({ name, avatarUrl }) {
  const initial = (name || '?')[0].toUpperCase()
  return (
    <div className="w-7 h-7 rounded-full bg-brand-900 border border-brand-800 flex items-center justify-center text-xs font-bold text-brand-400 flex-shrink-0 mt-0.5 overflow-hidden">
      {avatarUrl ? (
        <img src={avatarUrl.startsWith('http') ? avatarUrl : driveThumb(avatarUrl, 60)}
          alt={initial} className="w-full h-full object-cover"
          onError={(e) => { e.target.style.display = 'none' }} />
      ) : initial}
    </div>
  )
}

export default function CommentSection({ reportId }) {
  const { user, profile } = useAuth()
  const { lang, tr }      = useLang()
  const navigate          = useNavigate()
  const { data: comments, isLoading } = useComments(reportId)
  const addComment = useAddComment()
  const [text, setText] = useState('')

  const myName = profile?.name || profile?.name_np || profile?.name_en || user?.email || ''

  async function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim()) return
    if (!user) { navigate('/login'); return }
    await addComment.mutateAsync({
      reportId,
      userId:    user.id,
      user_name: myName,
      text:      text.trim(),
    })
    setText('')
  }

  return (
    <div className="space-y-4">
      <h3 className="section-title">
        {tr('comment')}{comments?.length > 0 && <span className="text-slate-500 font-mono ml-1.5">({comments.length})</span>}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="flex gap-2 items-start">
          <Avatar name={myName} avatarUrl={profile?.avatar_url} />
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
            placeholder={user ? tr('addCommentPH') : tr('signInComment')}
            disabled={!user || addComment.isPending}
            className="input text-sm resize-none flex-1" maxLength={500} />
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={!text.trim() || addComment.isPending || !user}
            className="btn-primary text-sm py-1.5">
            {addComment.isPending ? <Spinner size="sm" /> : tr('addComment')}
          </button>
        </div>
      </form>

      {isLoading ? <div className="flex justify-center py-6"><Spinner /></div>
        : !comments?.length ? (
          <div className="text-center py-6 text-slate-600 text-sm">{tr('noComments')}</div>
        ) : (
          <div className="space-y-3">
            {comments.map((c, i) => {
              const commentText = c.text || c.comment_np || c.comment_en || ''
              return (
                <div key={c.id || i} className="flex gap-3">
                  <Avatar name={c.user_name} />
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-300">{c.user_name || 'Anonymous'}</span>
                      <span className="text-xs text-slate-600">{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{commentText}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )
      }
    </div>
  )
}
