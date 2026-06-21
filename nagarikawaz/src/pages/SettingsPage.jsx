import React, { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { RoleBadge, Spinner } from '../components/ui'
import { usersApi, uploadPhoto } from '../services/api'
import { driveThumb } from '../utils/helpers'
import { PROVINCES } from '../utils/constants'
import toast from 'react-hot-toast'

const SHARE_URL  = typeof window !== 'undefined' ? window.location.origin : ''
const SHARE_TEXT = 'NagarikAwaz — आफ्नो समस्या रिपोर्ट गर्नुहोस्! Report local civic issues.'

function AvatarUploader({ src, onUploaded }) {
  const inputRef  = useRef(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const result = await uploadPhoto(file, 'avatar')
      if (result?.fileId) onUploaded(result.fileId)
    } catch (err) {
      toast.error(err?.message || 'Upload failed')
    } finally {
      setBusy(false)
      e.target.value = ''
    }
  }

  return (
    <div className="relative group cursor-pointer" onClick={() => !busy && inputRef.current?.click()}>
      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-brand-800 border-2 border-brand-700 flex items-center justify-center">
        {src ? (
          <img src={src} alt="avatar" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none' }} />
        ) : (
          <span className="text-3xl text-brand-300">👤</span>
        )}
      </div>
      <div className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        {busy ? <Spinner size="sm" /> : <span className="text-white text-xs font-medium">Change</span>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}

export default function SettingsPage() {
  const { user, profile, fetchProfile, signOut } = useAuth()
  const { lang, toggleLang } = useLang()

  const avatarSrc = (() => {
    const av = profile?.avatar_url
    if (av && av.startsWith('http')) return av
    if (av) return driveThumb(av, 200)
    return user?.user_metadata?.avatar_url || null
  })()

  const [name,     setName]     = useState(profile?.name     || '')
  const [phone,    setPhone]    = useState(profile?.phone    || '')
  const [province, setProvince] = useState(profile?.province || '')
  const [district, setDistrict] = useState(profile?.district || '')
  const [palika,   setPalika]   = useState(profile?.palika   || '')
  const [ward,     setWard]     = useState(profile?.ward_no  || '')
  const [avatarId, setAvatarId] = useState(profile?.avatar_url || '')
  const [saving,   setSaving]   = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await usersApi.upsert({
        supabase_uid: user.id,
        email:        user.email,
        name:         name.trim(),
        phone:        phone.trim(),
        avatar_url:   avatarId,
        province,
        district:     district.trim(),
        palika:       palika.trim(),
        ward_no:      ward,
      })
      await fetchProfile(user)
      toast.success(lang === 'ne' ? 'प्रोफाइल सेव भयो ✓' : 'Profile saved ✓')
    } catch {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  function openShare(url) { window.open(url, '_blank', 'noopener,width=600,height=500') }

  const shareOptions = [
    {
      label: 'Facebook',
      color: 'bg-blue-600 hover:bg-blue-700',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
      ),
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_URL)}`,
    },
    {
      label: 'WhatsApp',
      color: 'bg-green-600 hover:bg-green-700',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      ),
      url: `https://wa.me/?text=${encodeURIComponent(SHARE_TEXT + ' ' + SHARE_URL)}`,
    },
    {
      label: 'X / Twitter',
      color: 'bg-slate-800 hover:bg-slate-700',
      icon: (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      ),
      url: `https://twitter.com/intent/tweet?url=${encodeURIComponent(SHARE_URL)}&text=${encodeURIComponent(SHARE_TEXT)}`,
    },
    {
      label: 'Viber',
      color: 'bg-purple-600 hover:bg-purple-700',
      icon: '📲',
      url: `viber://forward?text=${encodeURIComponent(SHARE_TEXT + ' ' + SHARE_URL)}`,
    },
  ]

  async function copyLink() {
    try { await navigator.clipboard.writeText(SHARE_URL); toast.success('Link copied!') }
    catch { toast.error('Copy failed') }
  }

  return (
    <div className="page-wrap max-w-xl">
      <h1 className="font-display font-bold text-2xl text-white mb-6">
        {lang === 'ne' ? 'प्रोफाइल' : 'My Profile'}
      </h1>

      {/* ── Profile Info ── */}
      <form onSubmit={handleSave} className="space-y-4 mb-4">
        <div className="card p-5">
          <h2 className="font-display font-semibold text-slate-300 text-sm mb-4">
            {lang === 'ne' ? 'व्यक्तिगत जानकारी' : 'Personal Information'}
          </h2>

          <div className="flex items-start gap-4 mb-5">
            <AvatarUploader
              src={avatarSrc}
              onUploaded={(fileId) => setAvatarId(fileId)}
            />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-lg leading-tight truncate">{profile?.name || user?.email || '—'}</p>
              <p className="text-sm text-slate-500 truncate">{user?.email}</p>
              <div className="mt-1.5"><RoleBadge role={profile?.role} /></div>
              <p className="text-xs text-slate-600 mt-1">
                {lang === 'ne' ? 'तस्वीर बदल्न क्लिक गर्नुहोस्' : 'Click photo to change'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="label">{lang === 'ne' ? 'नाम' : 'Name'}</label>
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="input" placeholder={lang === 'ne' ? 'तपाईंको नाम…' : 'Your name…'} />
            </div>
            <div>
              <label className="label">{lang === 'ne' ? 'फोन' : 'Phone'}</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)}
                className="input" type="tel" placeholder="98XXXXXXXX" />
            </div>
            <div>
              <label className="label">{lang === 'ne' ? 'इमेल (परिवर्तन हुँदैन)' : 'Email (read-only)'}</label>
              <input value={user?.email || ''} readOnly className="input opacity-40 cursor-not-allowed" />
            </div>
          </div>
        </div>

        {/* ── Location ── */}
        <div className="card p-5">
          <h2 className="font-display font-semibold text-slate-300 text-sm mb-4">
            📍 {lang === 'ne' ? 'ठेगाना' : 'Location'}
          </h2>
          <div className="space-y-3">
            <div>
              <label className="label">{lang === 'ne' ? 'प्रदेश' : 'Province'}</label>
              <select value={province} onChange={(e) => setProvince(e.target.value)} className="input">
                <option value="">—</option>
                {PROVINCES.map((p) => <option key={p.id} value={p.name_en}>{lang === 'ne' ? p.name_np : p.name_en}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{lang === 'ne' ? 'जिल्ला' : 'District'}</label>
                <input value={district} onChange={(e) => setDistrict(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">{lang === 'ne' ? 'पालिका' : 'Palika'}</label>
                <input value={palika} onChange={(e) => setPalika(e.target.value)} className="input" />
              </div>
            </div>
            <div>
              <label className="label">{lang === 'ne' ? 'वडा नम्बर' : 'Ward No.'}</label>
              <input value={ward} onChange={(e) => setWard(e.target.value)} className="input w-24" type="number" min="1" max="35" />
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
          {saving ? <Spinner size="sm" /> : (lang === 'ne' ? '💾 सेव गर्नुहोस्' : '💾 Save Profile')}
        </button>
      </form>

      {/* ── Language ── */}
      <div className="card p-5 mb-4">
        <h2 className="font-display font-semibold text-slate-300 text-sm mb-3">
          🌐 {lang === 'ne' ? 'भाषा' : 'Language'}
        </h2>
        <div className="flex gap-2">
          {[['ne','नेपाली'],['en','English']].map(([l, label]) => (
            <button key={l} type="button" onClick={() => lang !== l && toggleLang()}
              className={`flex-1 py-2.5 rounded-lg text-sm border transition-all font-medium ${
                lang === l
                  ? 'bg-brand-700 text-brand-200 border-brand-600'
                  : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Share App ── */}
      <div className="card p-5 mb-4">
        <h2 className="font-display font-semibold text-slate-300 text-sm mb-1">
          🔗 {lang === 'ne' ? 'एप शेयर गर्नुहोस्' : 'Share this App'}
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          {lang === 'ne'
            ? 'आफ्नो समुदायमा यो एप शेयर गर्नुहोस् र अझ धेरै नागरिकलाई जोड्नुहोस्।'
            : 'Share with your community and help more citizens report issues.'}
        </p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {shareOptions.map((s) => (
            <button key={s.label} onClick={() => openShare(s.url)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-white text-sm font-medium transition-all ${s.color}`}>
              {typeof s.icon === 'string' ? <span>{s.icon}</span> : s.icon}
              {s.label}
            </button>
          ))}
        </div>
        <button onClick={copyLink}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-slate-700 text-slate-400 hover:border-brand-600 hover:text-brand-400 text-sm transition-all">
          📋 {lang === 'ne' ? 'लिङ्क कपी गर्नुहोस्' : 'Copy Link'}
          <span className="font-mono text-xs text-slate-600 ml-1">{SHARE_URL}</span>
        </button>
      </div>

      {/* ── Danger zone ── */}
      <div className="card p-5 border border-red-900/30">
        <h2 className="font-display font-semibold text-red-400 text-sm mb-3">
          {lang === 'ne' ? 'खाता' : 'Account'}
        </h2>
        <button onClick={signOut}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-700/50 text-red-400 hover:bg-red-500/10 text-sm transition-all">
          🚪 {lang === 'ne' ? 'साइन आउट' : 'Sign Out'}
        </button>
      </div>
    </div>
  )
}
