import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './styles/globals.css'

const CACHE_KEY = 'nw_query_cache'
const CACHE_TTL = 12 * 60 * 60 * 1000 // 12 hours

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 120000,
      gcTime: CACHE_TTL,
      retry: 2,
      refetchOnWindowFocus: false,
      networkMode: 'offlineFirst',
    },
    mutations: { retry: 1 },
  },
})

// Restore cached data from localStorage on startup so the app works offline immediately
try {
  const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
  Object.entries(saved).forEach(([key, { data, ts }]) => {
    if (Date.now() - ts < CACHE_TTL) {
      try { qc.setQueryData(JSON.parse(key), data) } catch {}
    }
  })
} catch {}

// Persist successful query results to localStorage
qc.getQueryCache().subscribe((event) => {
  if (event?.type === 'updated' && event.query.state.status === 'success') {
    try {
      const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
      saved[JSON.stringify(event.query.queryKey)] = { data: event.query.state.data, ts: Date.now() }
      // Keep cache under 4MB — evict oldest entries if needed
      const entries = Object.entries(saved).sort((a, b) => b[1].ts - a[1].ts).slice(0, 50)
      localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)))
    } catch {}
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#0d1a0f', color: '#e8f5ee',
              border: '1px solid #1f7350',
              fontFamily: 'Mukta, DM Sans, sans-serif', fontSize: '14px',
            },
            success: { iconTheme: { primary: '#2d9265', secondary: '#0d1a0f' } },
            error:   { iconTheme: { primary: '#DC143C', secondary: '#0d1a0f' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
