import { supabase } from './supabase'

const BASE = import.meta.env.VITE_SHEETS_API_URL || ''

// Get auth token
async function getToken() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || null
  } catch { return null }
}

// GET — for read operations (no body, params only)
async function qGet(action, params = {}) {
  const token = await getToken()
  const url   = new URL(BASE)
  url.searchParams.set('action', action)
  if (token) url.searchParams.set('token', token)
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  })
  const res = await fetch(url.toString())
  if (!res.ok) throw { error: `HTTP ${res.status}` }
  const data = await res.json()
  if (data?.error) throw data
  return data
}

// POST — for all write operations to avoid URL length limits and data truncation
async function qPost(action, body = {}) {
  const token = await getToken()
  const url   = new URL(BASE)
  url.searchParams.set('action', action)
  if (token) url.searchParams.set('token', token)
  const res = await fetch(url.toString(), {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) throw { error: `HTTP ${res.status}` }
  const data = await res.json()
  if (data?.error) throw data
  return data
}

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsApi = {
  list:   (p = {})          => qGet('getReports', p),
  get:    (id)              => qGet('getReport', { id }),
  create: (data)            => qPost('createReport', data),
  update: (id, data)        => qPost('updateReport', { id, ...data }),
  upvote: (id, userId)      => qPost('upvoteReport', { id, userId }),
  nearby: (lat, lng, r=100) => qGet('getNearbyReports', { lat, lng, radius: r }),
  stats:  (p = {})          => qGet('getDashboardStats', p),
}

// ── Comments ──────────────────────────────────────────────────────────────────
export const commentsApi = {
  list:   (reportId) => qGet('getComments',  { reportId }),
  create: (data)     => qPost('addComment',  data),
}

// ── Progress ──────────────────────────────────────────────────────────────────
export const progressApi = {
  list:   (reportId) => qGet('getProgress',  { reportId }),
  create: (data)     => qPost('addProgress', data),
}

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersApi = {
  list:       ()         => qGet('getUsers'),
  get:        (id)       => qGet('getUser',        { id }),
  upsert:     (data)     => qPost('upsertUser',    data),
  updateRole: (id, data) => qPost('updateUserRole',{ id, ...data }),
}

// ── AI ────────────────────────────────────────────────────────────────────────
export const aiApi = {
  generate: (data) => qPost('generateAIReport', data),
  list:     ()     => qGet('listAIReports'),
}

export { qGet, qPost }

// ── Photo upload ──────────────────────────────────────────────────────────────
export async function uploadPhoto(file, reportId = 'temp') {
  if (!file || !file.type.startsWith('image/')) throw new Error('Only image files are supported')
  if (file.size > 10 * 1024 * 1024)              throw new Error('File too large — max 10 MB')

  const compressed = await compressImage(file, 1200, 0.82)
  const base64     = await fileToBase64(compressed)

  return qPost('uploadPhoto', {
    reportId,
    fileName: file.name.replace(/[^a-zA-Z0-9._-]/g, '_'),
    mimeType: compressed.type || file.type,
    data:     base64,
  })
}

async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = (e) => resolve(e.target.result.split(',')[1])
    reader.onerror = ()  => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

// Compress image to max width/height, keeping aspect ratio
function compressImage(file, maxPx, quality) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let { width: w, height: h } = img
      if (w <= maxPx && h <= maxPx) { resolve(file); return }

      const scale = Math.min(maxPx / w, maxPx / h)
      w = Math.round(w * scale)
      h = Math.round(h * scale)

      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)

      canvas.toBlob(
        (blob) => resolve(blob || file),
        file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        quality
      )
    }
    img.onerror = () => resolve(file)
    img.src = URL.createObjectURL(file)
  })
}

export default http
