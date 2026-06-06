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

// ── Photo upload (base64 via POST to avoid URL length limits) ─────────────────
export function uploadPhoto(file, reportId = 'temp') {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const body = JSON.stringify({
          action:   'uploadPhoto',
          reportId,
          fileName: file.name,
          mimeType: file.type,
          data:     e.target.result.split(',')[1],
        })
        const res = await fetch(BASE, {
          method:  'POST',
          body,
          headers: { 'Content-Type': 'text/plain' },
        })
        const result = await res.json()
        if (result.error) throw new Error(result.error)
        resolve(result)
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default http
