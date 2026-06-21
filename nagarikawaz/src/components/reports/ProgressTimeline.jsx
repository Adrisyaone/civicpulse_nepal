import React, { useState } from 'react'
import { useProgress, useAddProgress } from '../../hooks'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LangContext'
import { Spinner, StatusBadge } from '../ui'
import { formatDate, cn } from '../../utils/helpers'
import { STATUSES, DEPARTMENTS } from '../../utils/constants'

export default function ProgressTimeline({ reportId }) {
  const { isOfficer, profile, user } = useAuth()
  const { lang, tr } = useLang()
  const { data: updates, isLoading } = useProgress(reportId)
  const addProgress = useAddProgress()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ status: '', note: '', department: '' })

  const myName = profile?.name || profile?.name_np || profile?.name_en || user?.email || 'Officer'

  async function handleSubmit(e) {
    e.preventDefault()
    await addProgress.mutateAsync({ reportId, officer: myName, ...form })
    setForm({ status: '', note: '', department: '' })
    setOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="section-title">
          {lang === 'ne' ? 'प्रगति विवरण' : 'Progress Timeline'}
          {updates?.length > 0 && <span className="text-slate-500 font-mono ml-1">({updates.length})</span>}
        </h3>
        {isOfficer && (
          <button onClick={() => setOpen(!open)} className="btn-primary py-1 px-3 text-xs">
            + {tr('addUpdate')}
          </button>
        )}
      </div>

      {isOfficer && open && (
        <form onSubmit={handleSubmit} className="card p-4 space-y-3 border-brand-800/40 animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{tr('status')}</label>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="input text-sm" required>
                <option value="">{tr('selectOpt')}</option>
                {Object.entries(STATUSES).map(([k, v]) => (
                  <option key={k} value={k}>{lang === 'ne' ? v.np : v.en}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{tr('department')}</label>
              <select value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                className="input text-sm">
                <option value="">{tr('selectOpt')}</option>
                {DEPARTMENTS.map((d) => <option key={d.en} value={d.en}>{lang === 'ne' ? d.np : d.en}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">{lang === 'ne' ? 'टिप्पणी' : 'Note'}</label>
            <textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              className="input text-sm resize-none" rows={3}
              placeholder={lang === 'ne' ? 'प्रगति विवरण लेख्नुहोस्…' : 'Describe the progress update…'} required />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn-ghost py-1.5 text-sm" onClick={() => setOpen(false)}>{tr('cancel')}</button>
            <button type="submit" disabled={addProgress.isPending} className="btn-primary py-1.5 text-sm">
              {addProgress.isPending ? <Spinner size="sm" /> : tr('save')}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : !updates?.length ? (
        <div className="text-center py-6 text-slate-600 text-sm">{tr('noUpdates')}</div>
      ) : (
        <div className="relative pl-6">
          <div className="absolute left-2 top-2 bottom-2 w-px bg-slate-800" />
          <div className="space-y-5">
            {updates.map((u, i) => {
              const note = u.note || u.note_np || u.note_en || ''
              return (
                <div key={u.id || i} className="relative">
                  <div className={cn('absolute -left-4 w-4 h-4 rounded-full border-2 border-[#060e08]',
                    i === 0 ? 'bg-brand-500' : 'bg-slate-700')} />
                  <div className="card p-3">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <StatusBadge status={u.status} />
                      {u.department && <span className="text-xs text-slate-500">· {u.department}</span>}
                    </div>
                    {note && <p className="text-sm text-slate-300 mb-2 leading-relaxed">{note}</p>}
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>{u.officer_name || u.officer}</span>
                      <span>{formatDate(u.created_at || u.timestamp)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
