import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { weeklyApi } from '../services/api'
import { useLang } from '../context/LangContext'
import { useAuth } from '../context/AuthContext'
import { Spinner, EmptyState } from '../components/ui'
import { formatDate } from '../utils/helpers'
import toast from 'react-hot-toast'

const SCHEDULE_KEY = 'weekly_report_schedule'
const DAY_LABELS = {
  SUNDAY: { en: 'Sunday', ne: 'आइतबार' },
  MONDAY: { en: 'Monday', ne: 'सोमबार' },
  TUESDAY: { en: 'Tuesday', ne: 'मंगलबार' },
  WEDNESDAY: { en: 'Wednesday', ne: 'बुधबार' },
  THURSDAY: { en: 'Thursday', ne: 'बिहिबार' },
  FRIDAY: { en: 'Friday', ne: 'शुक्रबार' },
  SATURDAY: { en: 'Saturday', ne: 'शनिबार' },
}

function fmtHour(h) {
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:00 ${ampm}`
}

function getSchedule() {
  try {
    const s = JSON.parse(localStorage.getItem(SCHEDULE_KEY) || '{}')
    return { day: s.day || 'SUNDAY', hour: s.hour ?? 17 }
  } catch { return { day: 'SUNDAY', hour: 17 } }
}

export default function WeeklyReportsPage() {
  const { lang } = useLang()
  const { isAdmin, isLead } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [generating, setGenerating] = useState(false)
  const [genError,   setGenError]   = useState(null)

  const { data: reports, isLoading } = useQuery({
    queryKey: ['weekly-reports'],
    queryFn:  weeklyApi.list,
    staleTime: 300000,
  })

  const schedule = getSchedule()
  const dayLabel = DAY_LABELS[schedule.day] || DAY_LABELS.SUNDAY

  async function handleGenerate() {
    setGenerating(true)
    setGenError(null)
    try {
      await weeklyApi.generate()
      await queryClient.invalidateQueries({ queryKey: ['weekly-reports'] })
    } catch (err) {
      setGenError(err?.message || 'Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="xl" />
    </div>
  )

  const list = Array.isArray(reports) ? reports : []

  return (
    <div className="page-wrap">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-2xl text-white flex items-center gap-2">
              📊 {lang === 'ne' ? 'साप्ताहिक प्रतिवेदन' : 'Weekly Summary Reports'}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {lang === 'ne'
                ? `प्रत्येक ${dayLabel.ne} ${fmtHour(schedule.hour)} मा स्वतः निर्मित व्यापक प्रतिवेदन`
                : `Auto-generated every ${dayLabel.en} at ${fmtHour(schedule.hour)} — comprehensive analysis with maps, photos & AI insights`}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            {(isAdmin || isLead) && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="btn-nepal py-1.5 px-3 text-xs flex items-center gap-1.5 disabled:opacity-60"
              >
                {generating ? <Spinner size="sm" /> : '⚡'}
                {lang === 'ne' ? 'अहिले बनाउनुस्' : 'Generate Now'}
              </button>
            )}
            <button
              onClick={() => navigate('/settings#weekly-schedule')}
              className="btn-ghost py-1.5 px-3 text-xs flex items-center gap-1.5"
            >
              ⚙️ {lang === 'ne' ? 'तालिका' : 'Schedule'}
            </button>
          </div>
        </div>
        {genError && (
          <p className="mt-2 text-xs text-red-400">⚠️ {genError}</p>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon="📄"
          title={lang === 'ne' ? 'अहिलेसम्म कुनै प्रतिवेदन छैन' : 'No reports yet'}
          description={lang === 'ne'
            ? `पहिलो साप्ताहिक प्रतिवेदन आउँदो ${dayLabel.ne} निर्मित हुनेछ।`
            : `The first weekly report will be generated next ${dayLabel.en}. Admins can also trigger it manually from the Apps Script editor.`}
        />
      ) : (
        <div className="space-y-4">
          {list.map((r) => (
            <WeeklyReportCard
              key={r.id}
              report={r}
              lang={lang}
              isAdmin={isAdmin}
              onDelete={async (id) => {
                if (!window.confirm(lang === 'ne'
                  ? 'के तपाईं यो साप्ताहिक रिपोर्ट स्थायी रूपमा मेट्न चाहनुहुन्छ?'
                  : 'Permanently delete this weekly report?')) return
                try {
                  await weeklyApi.delete(id)
                  await queryClient.invalidateQueries({ queryKey: ['weekly-reports'] })
                  toast.success(lang === 'ne' ? 'रिपोर्ट मेटियो' : 'Report deleted')
                } catch (err) {
                  toast.error(err?.error || 'Delete failed')
                }
              }}
            />
          ))}
        </div>
      )}

      <div className="mt-8 card p-4 text-sm text-slate-500 space-y-1">
        <p className="font-medium text-slate-400">ℹ️ {lang === 'ne' ? 'कसरी काम गर्छ?' : 'How it works'}</p>
        <p>{lang === 'ne'
          ? `प्रत्येक ${dayLabel.ne} ${fmtHour(schedule.hour)} बजे Google Apps Script ले सबै रिपोर्टहरूको विश्लेषण गर्छ, नक्शा र तस्वीर सहित PDF बनाउँछ।`
          : `Every ${dayLabel.en} at ${fmtHour(schedule.hour)} Nepal time, Google Apps Script analyses all reports, generates a comprehensive Google Doc with maps & photos, exports it as PDF, and makes it publicly accessible.`
        }</p>
      </div>
    </div>
  )
}

function WeeklyReportCard({ report: r, lang, isAdmin, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const summary = r.summary || {}
  const periodStart = r.period_start ? new Date(r.period_start) : null
  const periodEnd   = r.period_end   ? new Date(r.period_end)   : null
  const fmtShort = (d) => d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''

  async function handleDelete() {
    setDeleting(true)
    try { await onDelete(r.id) } finally { setDeleting(false) }
  }

  return (
    <div className="card p-5 hover:border-brand-700/40 transition-all">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-display font-semibold text-white text-base">
            {periodStart && periodEnd
              ? `${fmtShort(periodStart)} — ${fmtShort(periodEnd)}`
              : r.title}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{formatDate(r.created_at)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="badge bg-brand-900/40 text-brand-400 border border-brand-700/30">
            📋 {r.report_count || 0} {lang === 'ne' ? 'रिपोर्ट' : 'reports'}
          </span>
          {isAdmin && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              title={lang === 'ne' ? 'मेट्नुहोस्' : 'Delete'}
              className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-50"
            >
              {deleting ? <Spinner size="sm" /> : '🗑️'}
            </button>
          )}
        </div>
      </div>

      {summary.executive_summary && (
        <p className="text-sm text-slate-400 leading-relaxed mb-3 line-clamp-3">
          {summary.executive_summary.split('|')[lang === 'ne' ? 1 : 0]?.trim() || summary.executive_summary}
        </p>
      )}

      {summary.key_findings?.length > 0 && (
        <ul className="space-y-1 mb-3">
          {summary.key_findings.slice(0, 3).map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
              <span className="text-brand-600 mt-0.5 shrink-0">•</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      {summary.trend && (
        <p className="text-xs text-slate-600 italic mb-3">
          📈 {lang === 'ne' ? 'प्रवृत्ति' : 'Trend'}: {summary.trend}
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-800">
        {r.doc_url && (
          <a href={r.doc_url} target="_blank" rel="noreferrer"
            className="btn-ghost py-1.5 px-3 text-xs flex items-center gap-1.5">
            📄 {lang === 'ne' ? 'पूर्ण प्रतिवेदन' : 'View Full Report'}
          </a>
        )}
        {r.pdf_url && (
          <a href={r.pdf_url} target="_blank" rel="noreferrer"
            className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5">
            📥 {lang === 'ne' ? 'PDF डाउनलोड' : 'Download PDF'}
          </a>
        )}
      </div>
    </div>
  )
}
