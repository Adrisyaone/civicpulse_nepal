// ── Nepal Provinces ───────────────────────────────────────────────────────────
export const PROVINCES = [
  { id: '1', name_en: 'Koshi Province',         name_np: 'कोशी प्रदेश',         color: '#e74c3c' },
  { id: '2', name_en: 'Madhesh Province',        name_np: 'मधेश प्रदेश',         color: '#e67e22' },
  { id: '3', name_en: 'Bagmati Province',        name_np: 'बागमती प्रदेश',       color: '#27ae60' },
  { id: '4', name_en: 'Gandaki Province',        name_np: 'गण्डकी प्रदेश',       color: '#2980b9' },
  { id: '5', name_en: 'Lumbini Province',        name_np: 'लुम्बिनी प्रदेश',     color: '#8e44ad' },
  { id: '6', name_en: 'Karnali Province',        name_np: 'कर्णाली प्रदेश',      color: '#16a085' },
  { id: '7', name_en: 'Sudurpashchim Province',  name_np: 'सुदूरपश्चिम प्रदेश',  color: '#c0392b' },
]

export const PALIKA_TYPES = {
  mahanagarpalika:     { en: 'Metropolitan City',     np: 'महानगरपालिका' },
  upamahanagarpalika:  { en: 'Sub-Metropolitan City', np: 'उप-महानगरपालिका' },
  nagarpalika:         { en: 'Municipality',          np: 'नगरपालिका' },
  gaunpalika:          { en: 'Rural Municipality',    np: 'गाउँपालिका' },
}

// ── Categories ────────────────────────────────────────────────────────────────
export const CATEGORIES = {
  road:        { en: 'Road Damage',         np: 'सडक क्षति',           icon: '🛣️', color: '#f59e0b', bg: 'bg-amber-500/20',  text: 'text-amber-400',  border: 'border-amber-500/30'  },
  water:       { en: 'Water Supply',        np: 'खानेपानी',             icon: '💧', color: '#3b82f6', bg: 'bg-blue-500/20',   text: 'text-blue-400',   border: 'border-blue-500/30'   },
  drainage:    { en: 'Drainage & Flooding', np: 'ढल तथा बाढी',         icon: '🌊', color: '#06b6d4', bg: 'bg-cyan-500/20',   text: 'text-cyan-400',   border: 'border-cyan-500/30'   },
  electricity: { en: 'Electricity',         np: 'विद्युत',              icon: '💡', color: '#eab308', bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  waste:       { en: 'Waste Management',    np: 'फोहोर व्यवस्थापन',   icon: '🗑️', color: '#84cc16', bg: 'bg-lime-500/20',   text: 'text-lime-400',   border: 'border-lime-500/30'   },
  health:      { en: 'Public Health',       np: 'सार्वजनिक स्वास्थ्य', icon: '🏥', color: '#ec4899', bg: 'bg-pink-500/20',   text: 'text-pink-400',   border: 'border-pink-500/30'   },
  bridge:      { en: 'Bridge & Trail',      np: 'पुल तथा बाटो',        icon: '🌉', color: '#8b5cf6', bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30' },
  landslide:   { en: 'Landslide Risk',      np: 'पहिरो जोखिम',         icon: '⛰️', color: '#ef4444', bg: 'bg-red-500/20',    text: 'text-red-400',    border: 'border-red-500/30'    },
  other:       { en: 'Other',               np: 'अन्य',                 icon: '📋', color: '#6b7280', bg: 'bg-gray-500/20',   text: 'text-gray-400',   border: 'border-gray-500/30'   },
}

// ── Severities ────────────────────────────────────────────────────────────────
export const SEVERITIES = {
  critical: { en: 'Critical', np: 'अति गम्भीर', color: '#ef4444', bg: 'bg-red-500/20',    text: 'text-red-400',    dot: 'bg-red-500',    border: 'border-red-500/30'    },
  high:     { en: 'High',     np: 'गम्भीर',     color: '#f97316', bg: 'bg-orange-500/20', text: 'text-orange-400', dot: 'bg-orange-500', border: 'border-orange-500/30' },
  medium:   { en: 'Medium',   np: 'मध्यम',      color: '#eab308', bg: 'bg-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-500', border: 'border-yellow-500/30' },
  low:      { en: 'Low',      np: 'सामान्य',    color: '#22c55e', bg: 'bg-green-500/20',  text: 'text-green-400',  dot: 'bg-green-500',  border: 'border-green-500/30'  },
}

// ── Statuses ───────────────────────────────────────────────────────────────────
export const STATUSES = {
  open:        { en: 'Open',        np: 'खुला',        step: 0, color:'#8b5cf6', bg:'bg-violet-500/20', text:'text-violet-400' },
  in_progress: { en: 'In Progress', np: 'प्रक्रियामा', step: 4, color:'#f97316', bg:'bg-orange-500/20', text:'text-orange-400' },
  resolved:    { en: 'Resolved',    np: 'समाधान',      step: 6, color:'#22c55e', bg:'bg-green-500/20',  text:'text-green-400'  },
  closed:      { en: 'Closed',      np: 'बन्द',         step: 7, color:'#6b7280', bg:'bg-gray-500/20',   text:'text-gray-400'   },
}

// ── Roles ─────────────────────────────────────────────────────────────────────
export const ROLES = {
  // Simplified roles (current system)
  citizen:   { en: 'Citizen',       np: 'नागरिक',   level: 0, color: 'text-slate-400',  bg: 'bg-slate-500/20'  },
  admin:     { en: 'Admin',         np: 'प्रशासक',  level: 7, color: 'text-red-400',    bg: 'bg-red-500/20'    },
  developer: { en: 'Developer',     np: 'डेभलपर',   level: 8, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  // Legacy roles (backward compatibility)
  nagarik:            { en: 'Citizen (legacy)',    np: 'नागरिक',              level: 0, color: 'text-slate-400',  bg: 'bg-slate-500/20'  },
  samudaya_moderator: { en: 'Community Moderator', np: 'समुदाय मध्यस्थकर्ता', level: 1, color: 'text-blue-400',   bg: 'bg-blue-500/20'   },
  wada_adhikrit:      { en: 'Ward Officer',        np: 'वडा अधिकृत',          level: 2, color: 'text-cyan-400',   bg: 'bg-cyan-500/20'   },
  palika_officer:     { en: 'Palika Officer',      np: 'पालिका अधिकारी',      level: 3, color: 'text-amber-400',  bg: 'bg-amber-500/20'  },
  palika_pramukh:     { en: 'Mayor / Adhyaksha',   np: 'पालिका प्रमुख',       level: 4, color: 'text-brand-400',  bg: 'bg-brand-500/20'  },
  jilla_samanwayak:   { en: 'District Coord.',     np: 'जिल्ला समन्वयक',      level: 5, color: 'text-violet-400', bg: 'bg-violet-500/20' },
  pradesh_adhikrit:   { en: 'Province Officer',    np: 'प्रदेश अधिकृत',       level: 6, color: 'text-pink-400',   bg: 'bg-pink-500/20'   },
}

// ── Departments ───────────────────────────────────────────────────────────────
export const DEPARTMENTS = [
  { en: 'Roads & Transport',          np: 'सडक तथा यातायात'         },
  { en: 'Water Supply & Sanitation',  np: 'खानेपानी तथा सरसफाई'    },
  { en: 'Electricity',                np: 'विद्युत'                   },
  { en: 'Urban Planning',             np: 'शहरी योजना'               },
  { en: 'Waste Management',           np: 'फोहोर व्यवस्थापन'        },
  { en: 'Disaster Management',        np: 'विपद् व्यवस्थापन'        },
  { en: 'Environment',                np: 'वातावरण'                   },
  { en: 'Public Health',              np: 'सार्वजनिक स्वास्थ्य'     },
]

// ── Map ───────────────────────────────────────────────────────────────────────
export const MAP_DEFAULTS = { center: [28.3949, 84.1240], zoom: 7, minZoom: 6, maxZoom: 19 }
