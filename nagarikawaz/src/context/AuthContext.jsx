import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../services/supabase'
import { usersApi } from '../services/api'
import toast from 'react-hot-toast'

const Ctx = createContext(null)

const LEVELS = {
  // New simplified roles
  citizen: 0, admin: 7, developer: 8,
  // Legacy role names kept for backward compatibility
  nagarik: 0, samudaya_moderator: 1, wada_adhikrit: 2,
  palika_officer: 3, palika_pramukh: 4,
  jilla_samanwayak: 5, pradesh_adhikrit: 6,
}

const VIEW_AS_KEY = 'nw_view_as'

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  // null = use real role, 'nagarik' = citizen view override
  const [viewAs,  setViewAsState] = useState(() => localStorage.getItem(VIEW_AS_KEY) || null)

  const fetchProfile = useCallback(async (sbUser) => {
    if (!sbUser) { setProfile(null); return }
    try {
      const data = await usersApi.upsert({
        supabase_uid: sbUser.id,
        name:         sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || '',
        email:        sbUser.email || '',
        phone:        '',
      })
      if (data && !data.error) { setProfile(data); return }
      throw new Error('upsert returned error')
    } catch {
      setProfile({ role: 'nagarik', email: sbUser.email, google_uid: sbUser.id })
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
    // clear view-as on sign out
    localStorage.removeItem(VIEW_AS_KEY)
    setViewAsState(null)
    toast.success('Signed out')
  }

  function toggleViewAs() {
    const next = viewAs ? null : 'citizen'
    setViewAsState(next)
    if (next) localStorage.setItem(VIEW_AS_KEY, next)
    else localStorage.removeItem(VIEW_AS_KEY)
  }

  // True role — what the user actually is in the backend
  const actualRole  = profile?.role || 'nagarik'
  const actualLevel = LEVELS[actualRole] ?? 0
  // Only admin/developer can use view-as; ignore stored value if they were downgraded
  const canViewAs   = actualLevel >= LEVELS.admin

  // Effective role — used for ALL permission checks in the UI
  const role  = (viewAs && canViewAs) ? viewAs : actualRole
  const level = LEVELS[role] ?? 0

  const hasPermission = (min) => level >= (LEVELS[min] ?? 0)
  const isOfficer     = level >= LEVELS.admin
  const isLead        = level >= LEVELS.admin
  const isAdmin       = role === 'admin' || role === 'developer'

  return (
    <Ctx.Provider value={{
      user, profile, loading,
      role, level, hasPermission, isOfficer, isLead, isAdmin,
      actualRole, canViewAs, viewAs,
      toggleViewAs,
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
