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
  // severity ring: critical = thick red border, high = orange, medium = none, low = none
  const ring = severity === 'critical'
    ? `<circle cx="16" cy="16" r="14.5" fill="none" stroke="${sev.color}" stroke-width="2.5" opacity=".9"/>`
    : severity === 'high'
    ? `<circle cx="16" cy="16" r="14.5" fill="none" stroke="${sev.color}" stroke-width="1.5" opacity=".7"/>`
    : ''
  const html = `<div style="position:relative;width:36px;height:46px;filter:drop-shadow(0 2px 5px rgba(0,0,0,.45))">
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="46" viewBox="0 0 36 46">
      <path d="M18 0C8.059 0 0 8.059 0 18c0 11.25 18 28 18 28S36 29.25 36 18C36 8.059 27.941 0 18 0z" fill="${cat.color}" opacity=".93"/>
      <circle cx="18" cy="18" r="11" fill="rgba(255,255,255,0.93)"/>
      ${ring}
    </svg>
    <span style="position:absolute;top:7px;left:0;right:0;text-align:center;font-size:13px;line-height:1;pointer-events:none">${cat.icon}</span>
  </div>`
  return L.divIcon({ html, className: '', iconSize: [36,46], iconAnchor: [18,46], popupAnchor: [0,-48] })
}

export function statusToProgress(status) {
  return Math.round(((STATUSES[status]?.step || 0) / 7) * 100)
}

export function driveThumb(id, size = 300) {
  if (!id) return ''
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`
}
export function driveView(id) {
  if (!id) return ''
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
