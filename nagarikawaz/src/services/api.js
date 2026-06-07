import axios from 'axios'
import { supabase } from './supabase'

const BASE = import.meta.env.VITE_SHEETS_API_URL || ''

const http = axios.create({ baseURL: BASE, timeout: 30000 })

http.interceptors.request.use(async (cfg) => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) cfg.params = { ...cfg.params, token: session.access_token }
  } catch {}
  return cfg
})

http.interceptors.response.use(
  (r) => r.data,
  (err) => Promise.reject(err?.response?.data || { error: err?.message || 'Network error' })
)

const q = (action, params = {}) => http.get('', { params: { action, ...params } })

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsApi = {
  list:   (p = {})       => q('getReports', p),
  get:    (id)           => q('getReport', { id }),
  create: (data)         => q('createReport', data),
  update: (id, data)     => q('updateReport', { id, ...data }),
  upvote: (id, userId)   => q('upvoteReport', { id, userId }),
  nearby: (lat, lng, r = 100) => q('getNearbyReports', { lat, lng, radius: r }),
  stats:  (p = {})       => q('getDashboardStats', p),
}

// ── Comments ──────────────────────────────────────────────────────────────────
export const commentsApi = {
  list:   (reportId) => q('getComments', { reportId }),
  create: (data)     => q('addComment', data),
}

// ── Progress ──────────────────────────────────────────────────────────────────
export const progressApi = {
  list:   (reportId) => q('getProgress', { reportId }),
  create: (data)     => q('addProgress', data),
}

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  list:       ()         => q('getUsers'),
  get:        (id)       => q('getUser', { id }),
  upsert:     (data)     => q('upsertUser', data),
  updateRole: (id, data) => q('updateUserRole', { id, ...data }),
}

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiApi = {
  generate: (data) => q('generateAIReport', data),
  list:     ()     => q('listAIReports'),
}

// ── Weekly Reports ────────────────────────────────────────────────────────────
export const weeklyApi = {
  list: () => q('getWeeklyReports'),
}

// ── Photo upload via Netlify proxy → Google Drive ────────────────────────────
// Direct GAS POST fails in browsers (302 redirect strips body + CORS).
// The Netlify function at /.netlify/functions/upload-photo proxies server-side.
export function uploadPhoto(file, reportId = 'temp') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const b64 = e.target.result.split(',')[1]
        if (!b64) throw new Error('Could not read file data')
        const res = await fetch('/.netlify/functions/upload-photo', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action:   'uploadPhoto',
            reportId,
            fileName: file.name,
            mimeType: file.type || 'image/jpeg',
            data:     b64,
          }),
        })
        let result
        try { result = await res.json() } catch { throw new Error(`Unexpected server response (${res.status})`) }
        if (result.error) throw new Error(result.error)
        if (!result.fileId) throw new Error('No fileId returned from Drive')
        resolve(result)
      } catch (err) { reject(err) }
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

export default http
