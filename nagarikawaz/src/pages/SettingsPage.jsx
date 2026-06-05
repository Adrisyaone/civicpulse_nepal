import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { RoleBadge, Spinner } from '../components/ui'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { user, profile, signOut } = useAuth()
  const { lang, toggleLang, tr }   = useLang()
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    await new Promise((r) => setTimeout(r, 500))
    toast.success(tr('save') + ' ✓')
    setSaving(false)
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
            {profile?.palika && <p className="text-xs text-brand-500 mt-0.5">{profile.palika}{profile.ward_no ? ` · वडा ${profile.ward_no}` : ''}</p>}
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

      <div className="card p-5 border-red-900/30">
        <h2 className="font-display font-semibold text-red-400 text-sm mb-3">{tr('dangerZone')}</h2>
        <button onClick={signOut} className="btn-danger text-sm">🚪 {tr('signOut')}</button>
      </div>
    </div>
  )
}
