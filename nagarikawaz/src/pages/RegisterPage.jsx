import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { usersApi } from '../services/api'
import { Spinner } from '../components/ui'
import toast from 'react-hot-toast'

const GENDERS = [
  { value: 'male',   ne: 'पुरुष',       en: 'Male'   },
  { value: 'female', ne: 'महिला',       en: 'Female' },
  { value: 'other',  ne: 'अन्य',        en: 'Other'  },
]

export default function RegisterPage() {
  const { signUpWithEmail, signInWithGoogle } = useAuth()
  const { lang, tr } = useLang()
  const navigate = useNavigate()
  const [f, setF] = useState({
    name_np: '', name_en: '', email: '', phone: '',
    gender: '', occupation: '', password: '', confirm: '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (f.password !== f.confirm) { toast.error(tr('pwMismatch')); return }
    if (f.password.length < 8)    { toast.error(tr('pwMin'));      return }
    setBusy(true)
    try {
      const { user } = await signUpWithEmail(f.email, f.password, f.name_en || f.name_np)
      // Save extended profile to GAS immediately
      if (user) {
        await usersApi.upsert({
          supabase_user_id: user.id,
          name_np:    f.name_np,
          name_en:    f.name_en,
          email:      f.email,
          phone:      f.phone,
          gender:     f.gender,
          occupation: f.occupation,
          role:       'nagarik',
        }).catch(() => {})
      }
      toast.success(tr('accountCreated'))
      navigate('/login')
    } catch (err) { toast.error(err.message || 'Registration failed') }
    finally { setBusy(false) }
  }

  async function handleGoogle() {
    setBusy(true)
    try { await signInWithGoogle() }
    catch (err) { toast.error(err.message); setBusy(false) }
  }

  const L = (ne, en) => lang === 'ne' ? ne : en

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #DC143C 50%, #003893 50%)' }}>न</div>
          <h1 className="font-display font-bold text-xl text-white">
            {L('नागरिक खाता खोल्नुहोस्', 'Create Citizen Account')}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {L('नागरिक आवाजमा स्वागत छ', 'Welcome to NagarikAwaz')}
          </p>
        </div>

        <div className="card p-6 space-y-4">
          {/* Google */}
          <button onClick={handleGoogle} disabled={busy} className="btn-ghost w-full justify-center py-2.5 gap-2">
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {L('Google मार्फत जारी', 'Continue with Google')}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-800"/>
            <span className="text-xs text-slate-600">{tr('or')}</span>
            <div className="flex-1 h-px bg-slate-800"/>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Names */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{tr('nameNp')}</label>
                <input value={f.name_np} onChange={(e) => set('name_np', e.target.value)}
                  className="input" placeholder="रामप्रसाद श्रेष्ठ" />
              </div>
              <div>
                <label className="label">{tr('nameEn')}</label>
                <input value={f.name_en} onChange={(e) => set('name_en', e.target.value)}
                  className="input" placeholder="Ram Prasad" />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="label">{tr('email')} <span className="text-red-400">*</span></label>
              <input type="email" value={f.email} onChange={(e) => set('email', e.target.value)}
                className="input" placeholder="tapai@example.com" required />
            </div>

            {/* Phone */}
            <div>
              <label className="label">{tr('phone')}</label>
              <input type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)}
                className="input" placeholder="98XXXXXXXX" />
            </div>

            {/* Gender + Occupation */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">{L('लिङ्ग', 'Gender')}</label>
                <select value={f.gender} onChange={(e) => set('gender', e.target.value)} className="input">
                  <option value="">{L('छान्नुहोस्', 'Select…')}</option>
                  {GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>{lang === 'ne' ? g.ne : g.en}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{L('पेशा', 'Occupation')}</label>
                <input value={f.occupation} onChange={(e) => set('occupation', e.target.value)}
                  className="input" placeholder={L('किसान, शिक्षक…', 'Farmer, Teacher…')} />
              </div>
            </div>

            {/* Passwords */}
            <div>
              <label className="label">{tr('password')} <span className="text-red-400">*</span></label>
              <input type="password" value={f.password} onChange={(e) => set('password', e.target.value)}
                className="input" placeholder="••••••••" required minLength={8} />
            </div>
            <div>
              <label className="label">{tr('confirmPw')} <span className="text-red-400">*</span></label>
              <input type="password" value={f.confirm} onChange={(e) => set('confirm', e.target.value)}
                className="input" placeholder="••••••••" required />
            </div>

            <button type="submit" disabled={busy} className="btn-nepal w-full justify-center py-2.5 mt-1">
              {busy ? <Spinner size="sm" /> : tr('createAccount')}
            </button>
          </form>

          <p className="text-center text-xs text-slate-600">
            {tr('haveAccount')} <Link to="/login" className="text-brand-400 hover:text-brand-300">{tr('signIn')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
