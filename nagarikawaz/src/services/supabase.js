import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL  || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// CRITICAL: never crash if env vars missing
let supabase

try {
  if (!url || !key || url === 'https://your-project.supabase.co') {
    console.warn('[NagarikAwaz] Supabase env vars not set — auth disabled')
    // Stub so the rest of the app imports safely
    supabase = {
      auth: {
        getSession:         async () => ({ data: { session: null }, error: null }),
        onAuthStateChange:  ()    => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithOAuth:    async () => ({ error: new Error('Auth not configured') }),
        signInWithPassword: async () => ({ data: null, error: new Error('Auth not configured') }),
        signUp:             async () => ({ data: null, error: new Error('Auth not configured') }),
        signInWithOtp:      async () => ({ error: new Error('Auth not configured') }),
        signOut:            async () => ({}),
      },
    }
  } else {
    supabase = createClient(url, key, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, flowType: 'pkce' },
    })
  }
} catch (err) {
  console.error('[NagarikAwaz] Supabase init failed:', err)
  supabase = {
    auth: {
      getSession:         async () => ({ data: { session: null }, error: null }),
      onAuthStateChange:  ()    => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithOAuth:    async () => ({}),
      signInWithPassword: async () => ({ data: null, error: err }),
      signUp:             async () => ({ data: null, error: err }),
      signInWithOtp:      async () => ({}),
      signOut:            async () => ({}),
    },
  }
}

export { supabase }
export default supabase
