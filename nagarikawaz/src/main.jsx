import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './styles/globals.css'

const qc = new QueryClient({
  defaultOptions: {
    queries:   { staleTime: 120000, retry: 2, refetchOnWindowFocus: false },
    mutations: { retry: 1 },
  },
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
