import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { Spinner } from '../components/ui'
import toast from 'react-hot-toast'

const GoogleIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

export default function LoginPage() {
  const { signInWithGoogle, signInWithEmail, sendMagicLink } = useAuth()
  const { lang, tr } = useLang()
  const navigate     = useNavigate()
  const [mode,  setMode]  = useState('email')
  const [email, setEmail] = useState('')
  const [pw,    setPw]    = useState('')
  const [busy,  setBusy]  = useState(false)

  async function handleForm(e) {
    e.preventDefault(); setBusy(true)
    try {
      if (mode === 'email') { await signInWithEmail(email, pw); navigate('/') }
      else { await sendMagicLink(email); toast.success(tr('magicSent')) }
    } catch (err) { toast.error(err.message || 'Failed') }
    finally { setBusy(false) }
  }

  async function handleGoogle() {
    setBusy(true)
    try { await signInWithGoogle() }
    catch (err) { toast.error(err.message || 'Google sign-in failed'); setBusy(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl font-bold text-white font-display"
            style={{ background: 'linear-gradient(135deg, #DC143C 50%, #003893 50%)' }}>न</div>
          <h1 className="font-display font-bold text-2xl text-white">{tr('appName')}</h1>
          <p className="text-slate-500 text-sm mt-1">{tr('signInSubtitle')}</p>
        </div>
        <div className="card p-6 space-y-4">
          <button onClick={handleGoogle} disabled={busy} className="btn-ghost w-full justify-center py-2.5">
            <GoogleIcon /> {tr('google')}
          </button>
          <div className="flex items-center gap-3"><div className="flex-1 h-px bg-slate-800"/><span className="text-xs text-slate-600">{tr('or')}</span><div className="flex-1 h-px bg-slate-800"/></div>
          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            {[['email', lang === 'ne' ? 'पासवर्ड' : 'Password'], ['magic', tr('magicLink')]].map(([m, l]) => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-1.5 text-xs font-medium transition-colors ${mode===m ? 'bg-brand-700 text-brand-200' : 'text-slate-500 hover:text-slate-300'}`}>{l}</button>
            ))}
          </div>
          <form onSubmit={handleForm} className="space-y-3">
            <div><label className="label">{tr('email')}</label>
              <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="input" placeholder="tapai@example.com" required /></div>
            {mode === 'email' && (
              <div><label className="label">{tr('password')}</label>
                <input type="password" value={pw} onChange={(e)=>setPw(e.target.value)} className="input" placeholder="••••••••" required /></div>
            )}
            <button type="submit" disabled={busy} className="btn-nepal w-full justify-center py-2.5">
              {busy ? <Spinner size="sm" /> : mode === 'email' ? tr('signIn') : tr('sendMagic')}
            </button>
          </form>
          <p className="text-center text-xs text-slate-600">
            {tr('noAccount')} <Link to="/register" className="text-brand-400 hover:text-brand-300">{tr('register')}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
