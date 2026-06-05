// AuthCallback
import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { LoadingScreen } from '../components/ui'

export default function AuthCallback() {
  const navigate = useNavigate()
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      navigate(session ? '/' : '/login', { replace: true })
    }).catch(() => navigate('/login', { replace: true }))
  }, [navigate])
  return <LoadingScreen />
}
