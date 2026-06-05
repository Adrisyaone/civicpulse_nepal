import { CATEGORIES, SEVERITIES, STATUSES } from './constants'
import L from 'leaflet'

export function timeAgo(d) {
  if (!d) return ''
  const s = Math.floor((Date.now() - new Date(d)) / 1000)
  if (s < 60)     return 'भर्खर'
  if (s < 3600)   return `${Math.floor(s/60)}m`
  if (s < 86400)  return `${Math.floor(s/3600)}h`
  if (s < 604800) return `${Math.floor(s/86400)}d`
  return new Date(d).toLocaleDateString('ne-NP', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDate(d) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('ne-NP', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return String(d) }
}

export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371e3
  const p1 = lat1*Math.PI/180, p2 = lat2*Math.PI/180
  const dp = (lat2-lat1)*Math.PI/180, dl = (lng2-lng1)*Math.PI/180
  const a = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export function createMarkerIcon(category, severity) {
  const cat = CATEGORIES[category] || CATEGORIES.other
  const sev = SEVERITIES[severity] || SEVERITIES.medium
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 8.75 14 24 14 24s14-15.25 14-24C28 6.268 21.732 0 14 0z" fill="${cat.color}" opacity=".92"/>
    <circle cx="14" cy="14" r="6.5" fill="white" opacity=".92"/>
    <circle cx="14" cy="14" r="4" fill="${sev.color}" opacity=".88"/>
  </svg>`
  return L.divIcon({ html: svg, className: '', iconSize: [28,38], iconAnchor: [14,38], popupAnchor: [0,-40] })
}

export function statusToProgress(status) {
  return Math.round(((STATUSES[status]?.step || 0) / 7) * 100)
}

export function driveThumb(id, size = 300) {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`
}
export function driveView(id) {
  return `https://drive.google.com/file/d/${id}/view`
}

export function truncate(str, len = 100) {
  if (!str) return ''
  return str.length <= len ? str : str.slice(0, len) + '…'
}

export function cn(...cls) { return cls.filter(Boolean).join(' ') }

export function priorityColor(score) {
  if (score >= 80) return 'text-red-400'
  if (score >= 60) return 'text-orange-400'
  if (score >= 40) return 'text-yellow-400'
  return 'text-green-400'
}

// bilingual field picker
export function tField(obj, fieldBase, lang) {
  if (!obj) return ''
  const np = obj[fieldBase + '_np']
  const en = obj[fieldBase + '_en']
  return lang === 'ne' ? (np || en || '') : (en || np || '')
}
