import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { RoleBadge, Spinner } from '../components/ui'
import { weeklyApi } from '../services/api'
import toast from 'react-hot-toast'

const SCHEDULE_KEY = 'weekly_report_schedule'

const DAYS = [
  { value: 'SUNDAY',    en: 'Sunday',    ne: 'आइतबार' },
  { value: 'MONDAY',    en: 'Monday',    ne: 'सोमबार' },
  { value: 'TUESDAY',   en: 'Tuesday',   ne: 'मंगलबार' },
  { value: 'WEDNESDAY', en: 'Wednesday', ne: 'बुधबार' },
  { value: 'THURSDAY',  en: 'Thursday',  ne: 'बिहिबार' },
  { value: 'FRIDAY',    en: 'Friday',    ne: 'शुक्रबार' },
  { value: 'SATURDAY',  en: 'Saturday',  ne: 'शनिबार' },
]

function fmtHour(h) {
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:00 ${ampm}`
}

export default function SettingsPage() {
  const { user, profile, signOut } = useAuth()
  const { lang, toggleLang, tr }   = useLang()
  const [saving, setSaving] = useState(false)

  const [schedule, setSchedule] = useState(() => {
    try {
      const s = localStorage.getItem(SCHEDULE_KEY)
      return s ? JSON.parse(s) : { day: 'SUNDAY', hour: 17 }
    } catch { return { day: 'SUNDAY', hour: 17 } }
  })
  const [savingSchedule, setSavingSchedule] = useState(false)

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    await new Promise((r) => setTimeout(r, 500))
    toast.success(tr('save') + ' ✓')
    setSaving(false)
  }

  async function handleScheduleSave(e) {
    e.preventDefault()
    setSavingSchedule(true)
    try {
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule))
      try { await weeklyApi.updateSchedule(schedule.day, schedule.hour) } catch {}
      toast.success(lang === 'ne' ? 'तालिका सेव भयो ✓' : 'Schedule saved ✓')
    } finally {
      setSavingSchedule(false)
    }
  }

  return (
    <div className="page-wrap max-w-xl">
      <h1 className="font-display font-bold text-2xl text-white mb-6">{tr('settings')}</h1>

      <div className="card p-5 mb-4">
        <h2 className="font-display font-semibold text-slate-300 text-sm mb-4">{tr('profile')}</h2>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-brand-800 flex items-center justify-center text-2xl font-bold text-brand-300">
            {((profile?.name_np || profile?.name_en || profile?.email || '?')[0] || '?').toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-white">{profile?.name_np || profile?.name_en || '—'}</p>
            <p className="text-sm text-slate-500">{user?.email}</p>
            {profile?.palika && <p className="text-xs text-brand-500 mt-0.5">{profile.palika}{profile.ward_no ? ` · ${lang === 'ne' ? 'वडा' : 'Ward'} ${profile.ward_no}` : ''}</p>}
            <div className="mt-1.5"><RoleBadge role={profile?.role} /></div>
          </div>
        </div>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="label">{tr('email')} (read-only)</label>
            <input value={user?.email || ''} readOnly className="input opacity-50 cursor-not-allowed" />
          </div>
          <div>
            <label className="label">{lang === 'ne' ? 'भाषा / Language' : 'Language / भाषा'}</label>
            <div className="flex gap-2">
              {[['ne','नेपाली'],['en','English']].map(([l,label]) => (
                <button key={l} type="button" onClick={() => lang !== l && toggleLang()}
                  className={`flex-1 py-2 rounded-lg text-sm border transition-all ${lang===l ? 'bg-brand-700 text-brand-200 border-brand-600' : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <Spinner size="sm" /> : tr('save')}
          </button>
        </form>
      </div>

      <div className="card p-5 mb-4" id="weekly-schedule">
        <h2 className="font-display font-semibold text-slate-300 text-sm mb-1">
          📊 {lang === 'ne' ? 'साप्ताहिक प्रतिवेदन तालिका' : 'Weekly Report Schedule'}
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          {lang === 'ne'
            ? 'साप्ताहिक प्रतिवेदन कुन दिन र समयमा निर्मित हुन्छ भनी चुन्नुहोस्।'
            : 'Choose the day and time when the weekly report is auto-generated.'}
        </p>
        <form onSubmit={handleScheduleSave} className="space-y-3">
          <div>
            <label className="label">{lang === 'ne' ? 'दिन' : 'Day'}</label>
            <select
              value={schedule.day}
              onChange={(e) => setSchedule(s => ({ ...s, day: e.target.value }))}
              className="input"
            >
              {DAYS.map(d => (
                <option key={d.value} value={d.value}>
                  {lang === 'ne' ? d.ne : d.en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{lang === 'ne' ? 'समय' : 'Time'}</label>
            <select
              value={schedule.hour}
              onChange={(e) => setSchedule(s => ({ ...s, hour: Number(e.target.value) }))}
              className="input"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{fmtHour(h)}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={savingSchedule} className="btn-primary">
            {savingSchedule ? <Spinner size="sm" /> : (lang === 'ne' ? 'सेव गर्नुहोस्' : 'Save Schedule')}
          </button>
        </form>
      </div>

      <div className="card p-5 border-red-900/30">
        <h2 className="font-display font-semibold text-red-400 text-sm mb-3">{tr('dangerZone')}</h2>
        <button onClick={signOut} className="btn-danger text-sm">🚪 {tr('signOut')}</button>
      </div>
    </div>
  )
}
