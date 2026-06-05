import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../services/supabase'
import { usersApi } from '../services/api'
import toast from 'react-hot-toast'

const Ctx = createContext(null)

const LEVELS = {
  nagarik: 0, samudaya_moderator: 1, wada_adhikrit: 2,
  palika_officer: 3, palika_pramukh: 4,
  jilla_samanwayak: 5, pradesh_adhikrit: 6, admin: 7,
}

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (sbUser) => {
    if (!sbUser) { setProfile(null); return }
    try {
      const data = await usersApi.get(sbUser.id)
      if (data && !data.error) { setProfile(data); return }
      throw new Error('no profile')
    } catch {
      try {
        const np = await usersApi.upsert({
          supabase_user_id: sbUser.id,
          name_en: sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || '',
          name_np: '',
          email:   sbUser.email || '',
          phone:   '',
          role:    'nagarik',
        })
        setProfile(np && !np.error ? np : { role: 'nagarik', email: sbUser.email })
      } catch {
        setProfile({ role: 'nagarik', email: sbUser.email, supabase_user_id: sbUser.id })
      }
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return
        setUser(session?.user ?? null)
        if (session?.user) await fetchProfile(session.user)
      } catch (err) {
        console.error('[Auth init]', err)
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    let sub
    try {
      const { data } = supabase.auth.onAuthStateChange((_e, session) => {
        setUser(session?.user ?? null)
        if (session?.user) fetchProfile(session.user)
        else setProfile(null)
      })
      sub = data.subscription
    } catch {}

    return () => { mounted = false; try { sub?.unsubscribe() } catch {} }
  }, [fetchProfile])

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) throw error
  }

  async function signInWithEmail(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signUpWithEmail(email, password, name) {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
    if (error) throw error
    return data
  }

  async function sendMagicLink(email) {
    const { error } = await supabase.auth.signInWithOtp({
      email, options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) throw error
  }

  async function signOut() {
    try { await supabase.auth.signOut() } catch {}
    setUser(null); setProfile(null)
    toast.success('Signed out')
  }

  const role  = profile?.role || 'nagarik'
  const level = LEVELS[role] ?? 0
  const hasPermission  = (min) => level >= (LEVELS[min] ?? 0)
  const isOfficer  = level >= LEVELS.wada_adhikrit
  const isLead     = level >= LEVELS.palika_pramukh
  const isAdmin    = role === 'admin'

  return (
    <Ctx.Provider value={{
      user, profile, loading,
      role, level, hasPermission, isOfficer, isLead, isAdmin,
      signInWithGoogle, signInWithEmail, signUpWithEmail, sendMagicLink, signOut, fetchProfile,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth must be inside AuthProvider')
  return c
}
