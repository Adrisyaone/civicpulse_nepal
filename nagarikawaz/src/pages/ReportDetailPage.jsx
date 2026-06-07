import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import { useReport, useUpdateReport, useUpvoteReport, getLocalUpvoted } from '../hooks'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { CategoryBadge, SeverityBadge, StatusBadge, ProgressBar, Spinner, EmptyState, Modal, WardTag } from '../components/ui'
import CommentSection   from '../components/reports/CommentSection'
import ProgressTimeline from '../components/reports/ProgressTimeline'
import { formatDate, statusToProgress, driveThumb, driveView, cn } from '../utils/helpers'
import { STATUSES, DEPARTMENTS } from '../utils/constants'
import toast from 'react-hot-toast'

const pin = L.divIcon({
  html: `<div style="width:22px;height:22px;background:#DC143C;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,.55)"></div>`,
  className: '', iconSize: [22,22], iconAnchor: [11,22],
})

export default function ReportDetailPage() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const { isOfficer } = useAuth()
  const { lang, tr }  = useLang()
  const { data: r, isLoading } = useReport(id)
  const update  = useUpdateReport()
  const upvote  = useUpvoteReport()

  const [tab,          setTab]       = useState('timeline')
  const [aModal,       setAModal]    = useState(false)
  const [alreadyVoted, setVoted]     = useState(false)
  const [localUpvotes, setLocalUpvotes] = useState(null)
  React.useEffect(() => { if (r?.id) setVoted(getLocalUpvoted().has(String(r.id))) }, [r?.id])
  const [aForm,   setAForm]  = useState({ department: '', status: '' })
  const [lbox,    setLbox]   = useState(null)

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Spinner size="xl" /></div>
  if (!r || r.error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <EmptyState icon="🔍" title={lang === 'ne' ? 'रिपोर्ट फेला परेन' : 'Report not found'}
        action={<button className="btn-primary" onClick={() => navigate('/')}>← {tr('backToMap')}</button>} />
    </div>
  )

  const title   = lang === 'ne' ? (r.title_np || r.title_en) : (r.title_en || r.title_np)
  const desc    = lang === 'ne' ? (r.description_np || r.description_en) : (r.description_en || r.description_np)
  const photos  = (r.photo_ids || '').split(',').filter(Boolean)
  const prog    = statusToProgress(r.status)
  const curStep = STATUSES[r.status]?.step ?? 0

  async function quickStatus(s) {
    await update.mutateAsync({ id: r.id, status: s })
    toast.success(`${STATUSES[s]?.np} / ${STATUSES[s]?.en}`)
  }

  return (
    <div className="page-wrap">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-slate-500 hover:text-slate-300 text-sm mb-4">← {tr('back')}</button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card p-5">
            <div className="flex flex-wrap gap-2 mb-3">
              <CategoryBadge category={r.category} />
              <SeverityBadge severity={r.severity} />
              <StatusBadge   status={r.status} />
              {r.priority_score > 0 && (
                <span className={cn('badge', r.priority_score >= 80 ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400')}>⚡ {r.priority_score}</span>
              )}
            </div>
            <h1 className="font-display font-bold text-xl text-white mb-2">{title}</h1>
            <div className="mb-3"><WardTag palika={r.palika} wardNo={r.ward_no} district={r.district} /></div>
            {desc && <p className="text-slate-400 text-sm leading-relaxed mb-4">{desc}</p>}
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>{tr('progress')}</span><span className="font-mono">{prog}%</span>
            </div>
            <ProgressBar value={prog} />
            <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
              {[
                [tr('reportedBy'),  r.submitted_by],
                [tr('submitted'),   formatDate(r.created_at)],
                [lang === 'ne' ? 'जिल्ला' : 'District', r.district || '—'],
                [tr('department'),  r.department || tr('unassigned')],
                r.updated_at  && [tr('updated'),  formatDate(r.updated_at)],
                r.resolved_at && [tr('resolved'), formatDate(r.resolved_at)],
              ].filter(Boolean).map(([k, v]) => (
                <div key={k}><span className="text-slate-600 block">{k}</span><span className="text-slate-300">{v}</span></div>
              ))}
            </div>
          </div>

          {photos.length > 0 && (
            <div className="card p-4">
              <h2 className="section-title mb-3">📸 {tr('photos')} <span className="text-slate-600 font-mono ml-1">({photos.length})</span></h2>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((fid) => (
                  <div key={fid} onClick={() => setLbox(fid)}
                    className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-brand-500 bg-slate-800">
                    <img src={driveThumb(fid, 300)} alt="photo" className="w-full h-full object-cover"
                      onError={(e) => { e.target.parentElement.style.display = 'none' }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {r.lat && r.lng && (
            <div className="card overflow-hidden">
              <div className="h-48">
                <MapContainer center={[parseFloat(r.lat), parseFloat(r.lng)]} zoom={15}
                  style={{ height: '100%', width: '100%' }} zoomControl={false} scrollWheelZoom={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[parseFloat(r.lat), parseFloat(r.lng)]} icon={pin} />
                </MapContainer>
              </div>
              {(r.address_np || r.address_en) && (
                <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-800">
                  📍 {lang === 'ne' ? (r.address_np || r.address_en) : (r.address_en || r.address_np)}
                </div>
              )}
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="flex border-b border-slate-800">
              {[
                { id: 'timeline', label: `📋 ${lang === 'ne' ? 'प्रगति' : 'Timeline'}` },
                { id: 'comments', label: `💬 ${lang === 'ne' ? 'टिप्पणी' : 'Comments'}${r.comments_count > 0 ? ` (${r.comments_count})` : ''}` },
              ].map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={cn('flex-1 py-3 text-sm font-medium transition-colors',
                    tab === t.id ? 'text-brand-400 border-b-2 border-brand-500 bg-brand-500/5' : 'text-slate-500 hover:text-slate-300')}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="p-5">
              {tab === 'timeline' && <ProgressTimeline reportId={id} />}
              {tab === 'comments' && <CommentSection   reportId={id} />}
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="section-title mb-3">{tr('engagement')}</h3>
            <div className="flex justify-around text-center">
              <div><div className="font-display font-bold text-2xl text-white">{localUpvotes ?? r.upvotes ?? 0}</div><div className="text-xs text-slate-500">{tr('upvote')}</div></div>
              <div className="w-px bg-slate-800" />
              <div><div className="font-display font-bold text-2xl text-white">{r.comments_count || 0}</div><div className="text-xs text-slate-500">{tr('comment')}</div></div>
            </div>
            <button
              onClick={() => {
                if (alreadyVoted) return
                setVoted(true)
                setLocalUpvotes((localUpvotes ?? Number(r.upvotes || 0)) + 1)
                upvote.mutate(r.id)
              }}
              disabled={alreadyVoted}
              className={cn('w-full justify-center mt-3 text-sm', alreadyVoted ? 'btn-ghost opacity-50 cursor-default' : 'btn-ghost')}>
              👍 {alreadyVoted ? (lang === 'ne' ? 'मत दिइसक्यो' : 'Already voted') : (lang === 'ne' ? 'समर्थन गर्नुहोस्' : 'Upvote')}
            </button>
          </div>

          {isOfficer && (
            <div className="card p-4 space-y-3">
              <h3 className="section-title">{tr('officerActions')}</h3>
              <button onClick={() => setAModal(true)} className="btn-primary w-full justify-center text-sm">
                🏢 {tr('assignDept')}
              </button>
              <div className="grid grid-cols-2 gap-2">
                {['jaacha','praapta','kaarwaahi_bhairaha','samaadhaan'].map((s) => (
                  <button key={s} onClick={() => quickStatus(s)}
                    disabled={r.status === s || update.isPending}
                    className={cn('text-xs py-1.5 px-2 rounded-lg border transition-all disabled:opacity-30',
                      STATUSES[s]?.bg, STATUSES[s]?.text, 'border-slate-700 hover:border-slate-500')}>
                    {lang === 'ne' ? STATUSES[s]?.np : STATUSES[s]?.en}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card p-4">
            <h3 className="section-title mb-3">{tr('statusSteps')}</h3>
            <div className="space-y-2">
              {Object.entries(STATUSES).map(([k, v]) => {
                const done = v.step <= curStep
                return (
                  <div key={k} className={cn('flex items-center gap-2 text-xs py-0.5', done ? 'opacity-100' : 'opacity-25')}>
                    <div className={cn('w-4 h-4 rounded-full flex items-center justify-center text-xs flex-shrink-0',
                      done ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-600')}>
                      {done ? '✓' : v.step}
                    </div>
                    <span className={done ? 'text-slate-300' : 'text-slate-600'}>
                      {v.np} <span className="text-slate-600">/ {v.en}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Assign modal */}
      <Modal open={aModal} onClose={() => setAModal(false)} titleKey="assignDept">
        <div className="p-5 space-y-4">
          <div>
            <label className="label">{tr('department')}</label>
            <select value={aForm.department} onChange={(e) => setAForm((f) => ({ ...f, department: e.target.value }))} className="input">
              <option value="">छान्नुहोस्…</option>
              {DEPARTMENTS.map((d) => <option key={d.en} value={d.en}>{d.np} / {d.en}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{tr('status')}</label>
            <select value={aForm.status} onChange={(e) => setAForm((f) => ({ ...f, status: e.target.value }))} className="input">
              <option value="">Current status</option>
              {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.np} / {v.en}</option>)}
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn-ghost" onClick={() => setAModal(false)}>{tr('cancel')}</button>
            <button className="btn-primary" disabled={update.isPending}
              onClick={async () => { await update.mutateAsync({ id: r.id, ...aForm }); setAModal(false) }}>
              {update.isPending ? <Spinner size="sm" /> : tr('save')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Lightbox */}
      {lbox && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" onClick={() => setLbox(null)}>
          <button className="absolute top-4 right-4 text-white text-3xl hover:text-slate-300">×</button>
          <img src={driveThumb(lbox, 1200)} alt="fullsize"
            className="max-w-full max-h-[90vh] rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
          <a href={driveView(lbox)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            className="absolute bottom-4 text-brand-400 text-sm hover:text-brand-300">{tr('openInDrive')} ↗</a>
        </div>
      )}
    </div>
  )
}
