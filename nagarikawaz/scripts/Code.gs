// ============================================================================
// NagarikAwaz v3.0 (नागरिक आवाज) — Drive-First National GovTech Platform
// Nepal Civic Infrastructure Intelligence System
// Deploy: Execute as "Me" | Access: "Anyone"
// ============================================================================
//
// SCRIPT PROPERTIES (set all before first deploy):
//   SPREADSHEET_ID        — Google Sheet used as metadata index ONLY
//   DRIVE_ROOT_FOLDER_ID  — Root NagarikAwaz folder in Drive
//   GEMINI_API_KEY        — Gemini 1.5 Flash key
//   SPARROW_TOKEN         — Sparrow SMS auth token (Nepal)
//   SPARROW_IDENTITY      — Sparrow SMS sender name (max 11 chars)
//   HMAC_SECRET           — 64-char random string for session signing
//   SITE_URL              — https://nagarikawaz.netlify.app
//   ADMIN_EMAIL           — Primary admin email for critical alerts
// ============================================================================

// =============================================================================
// SECTION 1 — CONFIGURATION & CONSTANTS
// =============================================================================

var PROPS        = PropertiesService.getScriptProperties()
var SCRIPT_CACHE = CacheService.getScriptCache()

function CFG() {
  return {
    SS_ID:         PROPS.getProperty('SPREADSHEET_ID'),
    ROOT_ID:       PROPS.getProperty('DRIVE_ROOT_FOLDER_ID'),
    GEMINI_KEY:    PROPS.getProperty('GEMINI_API_KEY'),
    SPARROW_TOKEN: PROPS.getProperty('SPARROW_TOKEN'),
    SPARROW_ID:    PROPS.getProperty('SPARROW_IDENTITY') || 'NagarikAwaz',
    HMAC_SECRET:   PROPS.getProperty('HMAC_SECRET')      || 'CHANGE_ME_use_64_random_chars',
    SITE_URL:      PROPS.getProperty('SITE_URL')         || 'https://nagarikawaz.netlify.app',
    ADMIN_EMAIL:   PROPS.getProperty('ADMIN_EMAIL')      || '',
    SESSION_TTL:   3600,   // 1 hour in seconds
    CACHE_TTL:     300,    // 5 minutes
    MAX_RETRIES:   3,
    VERSION:       '3.0.0',
  }
}

// Index-only sheet names — NO full report data lives here
var IDX = {
  REPORTS:  'idx_reports',
  USERS:    'idx_users',
  SESSIONS: 'idx_sessions',
  DEPTS:    'idx_departments',
  CACHE:    'cache_analytics',
  AUDIT:    'log_audit',
}

var IDX_HEADERS = {
  idx_reports:     ['id','folder_id','json_file_id','province','district','palika','ward_no',
                    'category','severity','status','priority_score','lat','lng',
                    'submitted_by','created_at','updated_at'],
  idx_users:       ['id','google_uid','email','role','province','palika','dept_id','folder_id','created_at'],
  idx_sessions:    ['token_hash','user_id','role','expires_at'],
  idx_departments: ['id','name_en','name_np','categories','province','palika','lead_email','lead_phone','officer_count'],
  cache_analytics: ['key','json','computed_at'],
  log_audit:       ['timestamp','user_id','action','resource_id','result','meta'],
}

// SLA hours per severity level
var SLA_HOURS = { critical: 24, high: 72, medium: 168, low: 720 }

// Category → default department key
var DEPT_MAP = {
  road:        'roads_dept',
  bridge:      'roads_dept',
  drainage:    'water_dept',
  water:       'water_dept',
  landslide:   'disaster_dept',
  electricity: 'electricity_dept',
  waste:       'waste_dept',
  health:      'health_dept',
  other:       'general_dept',
}

// Valid status transitions
var WORKFLOW = {
  darta:       ['in_progress', 'banda'],
  in_progress: ['samaadhaan', 'darta', 'banda'],
  samaadhaan:  ['banda'],
  banda:       [],
}

// Role → allowed actions ('*' = everything)
var RBAC = {
  nagarik: [
    'createReport','getReport','getReports','getNearbyReports',
    'upvoteReport','addComment','getComments','getProgress',
    'getUser','upsertUser','uploadPhoto','getDashboardStats',
    'getWeeklyReports','listAIReports','getHeatmap','ping',
  ],
  samudaya_moderator: [   // community moderator — same as nagarik
    'createReport','getReport','getReports','getNearbyReports',
    'upvoteReport','addComment','getComments','getProgress',
    'getUser','upsertUser','uploadPhoto','getDashboardStats',
    'getWeeklyReports','listAIReports','getHeatmap','ping',
  ],
  officer: [
    'createReport','getReport','getReports','getNearbyReports',
    'upvoteReport','addComment','getComments','addProgress','getProgress',
    'updateReport','getUser','upsertUser','uploadPhoto','getDashboardStats',
    'getWeeklyReports','listAIReports','generateAIReport','prioritizeReport',
    'getHeatmap','getRiskZones','getAuditTrail','ping',
  ],
  wada_adhikrit: [        // ward officer — same as officer
    'createReport','getReport','getReports','getNearbyReports',
    'upvoteReport','addComment','getComments','addProgress','getProgress',
    'updateReport','getUser','upsertUser','uploadPhoto','getDashboardStats',
    'getWeeklyReports','listAIReports','generateAIReport','prioritizeReport',
    'getHeatmap','getRiskZones','getAuditTrail','ping',
  ],
  palika_officer: [       // palika officer — same as officer
    'createReport','getReport','getReports','getNearbyReports',
    'upvoteReport','addComment','getComments','addProgress','getProgress',
    'updateReport','getUser','upsertUser','uploadPhoto','getDashboardStats',
    'getWeeklyReports','listAIReports','generateAIReport','prioritizeReport',
    'getHeatmap','getRiskZones','getAuditTrail','ping',
  ],
  municipality_admin: [
    'createReport','getReport','getReports','getNearbyReports',
    'upvoteReport','addComment','getComments','addProgress','getProgress',
    'updateReport','getUser','upsertUser','getUsers','updateUserRole',
    'uploadPhoto','getDashboardStats','getWeeklyReports','triggerWeeklyReport',
    'listAIReports','generateAIReport','prioritizeReport',
    'getHeatmap','getRiskZones','getVulnerabilityScore','getAuditTrail',
    'getAdminView','ping',
  ],
  palika_pramukh: [       // palika chief — same as municipality_admin
    'createReport','getReport','getReports','getNearbyReports',
    'upvoteReport','addComment','getComments','addProgress','getProgress',
    'updateReport','getUser','upsertUser','getUsers','updateUserRole',
    'uploadPhoto','getDashboardStats','getWeeklyReports','triggerWeeklyReport',
    'listAIReports','generateAIReport','prioritizeReport',
    'getHeatmap','getRiskZones','getVulnerabilityScore','getAuditTrail',
    'getAdminView','ping',
  ],
  province_admin: [
    'createReport','getReport','getReports','getNearbyReports',
    'upvoteReport','addComment','getComments','addProgress','getProgress',
    'updateReport','deleteReport','getUser','upsertUser','getUsers','updateUserRole',
    'uploadPhoto','getDashboardStats','getWeeklyReports','triggerWeeklyReport',
    'listAIReports','generateAIReport','prioritizeReport',
    'getHeatmap','getRiskZones','getVulnerabilityScore','getAuditTrail',
    'activateEmergencyMode','emergencyBroadcast','getAdminView','ping',
  ],
  jilla_samanwayak: [     // district coordinator — same as province_admin
    'createReport','getReport','getReports','getNearbyReports',
    'upvoteReport','addComment','getComments','addProgress','getProgress',
    'updateReport','deleteReport','getUser','upsertUser','getUsers','updateUserRole',
    'uploadPhoto','getDashboardStats','getWeeklyReports','triggerWeeklyReport',
    'listAIReports','generateAIReport','prioritizeReport',
    'getHeatmap','getRiskZones','getVulnerabilityScore','getAuditTrail',
    'activateEmergencyMode','emergencyBroadcast','getAdminView','ping',
  ],
  pradesh_adhikrit: [     // province officer — same as province_admin
    'createReport','getReport','getReports','getNearbyReports',
    'upvoteReport','addComment','getComments','addProgress','getProgress',
    'updateReport','deleteReport','getUser','upsertUser','getUsers','updateUserRole',
    'uploadPhoto','getDashboardStats','getWeeklyReports','triggerWeeklyReport',
    'listAIReports','generateAIReport','prioritizeReport',
    'getHeatmap','getRiskZones','getVulnerabilityScore','getAuditTrail',
    'activateEmergencyMode','emergencyBroadcast','getAdminView','ping',
  ],
  system_admin: ['*'],
  admin: ['*'],            // alias for system_admin — use this role name in the Sheet
}

// =============================================================================
// SECTION 2 — DRIVE DATABASE ENGINE (primary store)
// =============================================================================

// Get or create a named subfolder inside a parent folder (by ID)
function driveFolder(parentId, name) {
  var parent = DriveApp.getFolderById(parentId)
  var it     = parent.getFoldersByName(name)
  return it.hasNext() ? it.next() : parent.createFolder(name)
}

// Write (create or overwrite) a JSON file in a Drive folder
function driveWriteJSON(folderId, fileName, data) {
  var folder  = DriveApp.getFolderById(folderId)
  var content = JSON.stringify(data, null, 2)
  var it      = folder.getFilesByName(fileName)
  if (it.hasNext()) {
    var f = it.next()
    f.setContent(content)
    return f
  }
  return folder.createFile(fileName, content, MimeType.PLAIN_TEXT)
}

// Read and parse a JSON file by its Drive file ID
function driveReadJSON(fileId) {
  try {
    return JSON.parse(DriveApp.getFileById(fileId).getBlob().getDataAsString())
  } catch (e) {
    throw new Error('Drive read failed [' + fileId + ']: ' + e.message)
  }
}

// Append a timestamped event file into a subfolder (append-only log)
function driveAppendEvent(reportFolderId, subFolderName, prefix, data) {
  var sub      = driveFolder(reportFolderId, subFolderName)
  var ts       = Utilities.formatDate(new Date(), 'Asia/Kathmandu', 'yyyyMMdd_HHmmss')
  var fileName = prefix + '_' + ts + '_' + uuid().substr(0, 6) + '.json'
  sub.createFile(fileName, JSON.stringify(data, null, 2), MimeType.PLAIN_TEXT)
  return fileName
}

// Build (or retrieve) the Drive folder for a report:
//   reports/{province}/{district}/{palika}/{reportId}/
//   with subfolders: images, status_updates, comments, ai_reports, exports
function getOrCreateReportFolder(province, district, palika, reportId) {
  var rootId   = CFG().ROOT_ID
  var reportsF = driveFolder(rootId,             'reports')
  var provF    = driveFolder(reportsF.getId(),   sanitizePath(province || 'unknown'))
  var distF    = driveFolder(provF.getId(),      sanitizePath(district || 'unknown'))
  var palF     = driveFolder(distF.getId(),      sanitizePath(palika   || 'unknown'))
  var repF     = driveFolder(palF.getId(),       reportId)
  ;['images','status_updates','comments','ai_reports','exports'].forEach(function(sub){
    driveFolder(repF.getId(), sub)
  })
  return repF
}

// =============================================================================
// SECTION 3 — CACHE ENGINE
// =============================================================================

function cacheGet(key) {
  var v = SCRIPT_CACHE.get(key)
  return v ? JSON.parse(v) : null
}

function cacheSet(key, data, ttlSeconds) {
  try {
    var s = JSON.stringify(data)
    if (s.length < 95000) SCRIPT_CACHE.put(key, s, ttlSeconds || CFG().CACHE_TTL)
  } catch (e) {}
}

function cacheInvalidate(key) { SCRIPT_CACHE.remove(key) }

function ck() {
  return Array.prototype.slice.call(arguments).join(':').replace(/\s+/g, '_').toLowerCase().substr(0, 250)
}

// =============================================================================
// SECTION 4 — SHEET INDEX ENGINE (metadata & pointers only)
// =============================================================================

function getIdxSheet(name) {
  var ss = SpreadsheetApp.openById(CFG().SS_ID)
  var sh = ss.getSheetByName(name)
  if (!sh) {
    sh = ss.insertSheet(name)
    var h = IDX_HEADERS[name]
    if (h) sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold')
  }
  return sh
}

function idxRead(sheetName) {
  var sh   = getIdxSheet(sheetName)
  var data = sh.getDataRange().getValues()
  if (data.length < 2) return []
  var headers = data[0].map(function(h) { return String(h).trim() })
  return data.slice(1).map(function(row) {
    var obj = {}
    headers.forEach(function(h, i) { obj[h] = row[i] != null ? String(row[i]).trim() : '' })
    return obj
  }).filter(function(r) {
    // Skip completely blank rows; keep any row with at least one non-empty cell
    return Object.keys(r).some(function(k) { return r[k] !== '' })
  })
}

function idxAppend(sheetName, rowObj) {
  var sh      = getIdxSheet(sheetName)
  var headers = IDX_HEADERS[sheetName]
  var row     = headers.map(function(h) { return rowObj[h] !== undefined ? rowObj[h] : '' })
  sh.appendRow(row)
}

function idxUpdate(sheetName, matchField, matchValue, updates) {
  var sh      = getIdxSheet(sheetName)
  var headers = IDX_HEADERS[sheetName]
  var data    = sh.getDataRange().getValues()
  var col     = headers.indexOf(matchField)
  if (col < 0) return false
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][col]).trim() === String(matchValue).trim()) {
      Object.keys(updates).forEach(function(k) {
        var c = headers.indexOf(k)
        if (c >= 0) sh.getRange(i + 1, c + 1).setValue(updates[k])
      })
      return true
    }
  }
  return false
}

function idxFind(sheetName, matchField, matchValue) {
  var rows = idxRead(sheetName)
  return rows.find(function(r) {
    return String(r[matchField]).trim() === String(matchValue).trim()
  }) || null
}

function idxFilter(sheetName, filters) {
  var rows = idxRead(sheetName)
  return rows.filter(function(r) {
    return Object.keys(filters).every(function(k) {
      return !filters[k] || String(r[k]).trim() === String(filters[k]).trim()
    })
  })
}

function idxDeleteRow(sheetName, matchField, matchValue) {
  var sh      = getIdxSheet(sheetName)
  var headers = IDX_HEADERS[sheetName]
  var col     = headers.indexOf(matchField)
  if (col < 0) return false
  var data = sh.getDataRange().getValues()
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][col]).trim() === String(matchValue).trim()) {
      sh.deleteRow(i + 1)
      return true
    }
  }
  return false
}

// =============================================================================
// SECTION 5 — AUTHENTICATION
// =============================================================================

// Verify a Google ID token via Google's tokeninfo endpoint
function verifyGoogleToken(idToken) {
  if (!idToken) return null
  try {
    var res  = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
      { muteHttpExceptions: true }
    )
    if (res.getResponseCode() !== 200) return null
    var info = JSON.parse(res.getContentText())
    if (!info.sub || !info.email) return null
    return { google_uid: info.sub, email: info.email, name: info.name || '' }
  } catch (e) { return null }
}

// Issue a session token; store hash in Sheet + cache
function createSession(userId, role) {
  var token   = uuid() + uuid()   // 32-char opaque token
  var hash    = hashToken(token)
  var expires = new Date(Date.now() + CFG().SESSION_TTL * 1000).toISOString()
  idxAppend(IDX.SESSIONS, { token_hash: hash, user_id: userId, role: role, expires_at: expires })
  cacheSet(ck('session', hash), { user_id: userId, role: role, expires_at: expires }, CFG().SESSION_TTL)
  return { token: token, expires_at: expires }
}

// Validate token; returns { user_id, role } or throws
function validateSession(token) {
  if (!token) throw new Error('AUTH_REQUIRED')
  var hash   = hashToken(token)
  var cached = cacheGet(ck('session', hash))
  if (cached) {
    if (new Date(cached.expires_at) < new Date()) {
      cacheInvalidate(ck('session', hash))
      throw new Error('SESSION_EXPIRED')
    }
    return cached
  }
  var row = idxFind(IDX.SESSIONS, 'token_hash', hash)
  if (!row) throw new Error('SESSION_INVALID')
  if (new Date(row.expires_at) < new Date()) throw new Error('SESSION_EXPIRED')
  var sess = { user_id: row.user_id, role: row.role, expires_at: row.expires_at }
  cacheSet(ck('session', hash), sess, CFG().SESSION_TTL)
  return sess
}

function revokeSession(token) {
  var hash = hashToken(token)
  cacheInvalidate(ck('session', hash))
  idxDeleteRow(IDX.SESSIONS, 'token_hash', hash)
}

// Delete rows where expires_at < now (called by trigger every 2h)
function cleanExpiredSessions() {
  var sh   = getIdxSheet(IDX.SESSIONS)
  var data = sh.getDataRange().getValues()
  var now  = new Date()
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][3] && new Date(data[i][3]) < now) sh.deleteRow(i + 1)
  }
}

// SHA-256 HMAC-lite: token + secret → hex digest
function hashToken(token) {
  var raw   = token + ':' + CFG().HMAC_SECRET
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    Utilities.newBlob(raw).getBytes()
  )
  return bytes.map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2) }).join('')
}

// Public: exchange Google ID token for a NagarikAwaz session
function loginWithGoogle(p) {
  var info = verifyGoogleToken(p.id_token)
  if (!info) throw new Error('Invalid or expired Google token')
  var user    = upsertUser({ google_uid: info.google_uid, email: info.email, name_en: info.name })
  var session = createSession(user.id, user.role)
  auditLog(user.id, 'LOGIN', user.id, 'ok', { email: info.email })
  return { user: user, session: session }
}

function logout(p) {
  if (p.token) revokeSession(p.token)
  return { ok: true }
}

// =============================================================================
// SECTION 6 — ROLE-BASED ACCESS CONTROL
// =============================================================================

function authorize(token, action) {
  var sess  = validateSession(token)
  var role  = sess.role || 'nagarik'
  var perms = RBAC[role] || []
  if (perms.indexOf('*') >= 0) return sess
  if (perms.indexOf(action) < 0) {
    auditLog(sess.user_id, action, '-', 'DENIED', { role: role })
    throw new Error('FORBIDDEN: ' + role + ' cannot ' + action)
  }
  return sess
}

function extractAuth(p) {
  return { token: p.token || p._token || '' }
}

// Rate limit per IP+action using CacheService
function rateLimit(ip, action, maxPerMinute) {
  var key   = ck('rl', ip || 'unknown', action)
  var count = parseInt(cacheGet(key) || '0')
  if (count >= (maxPerMinute || 30)) throw new Error('RATE_LIMITED')
  cacheSet(key, String(count + 1), 60)
}

// =============================================================================
// SECTION 7 — USER MANAGEMENT
// =============================================================================

var ROLE_RANK = {
  nagarik:0,
  samudaya_moderator:1,
  officer:2, wada_adhikrit:2, palika_officer:2,
  municipality_admin:3, palika_pramukh:3,
  jilla_samanwayak:4, pradesh_adhikrit:4, province_admin:4,
  system_admin:5, admin:5,
}

function upsertUser(p) {
  // Gather ALL rows that share this email — includes manually-added Sheet rows
  var emailRows = p.email ? idxFilter(IDX.USERS, { email: p.email }) : []

  // Highest role found across all email-matching rows (catches manually promoted rows)
  var bestRole = emailRows.reduce(function(best, r) {
    return (ROLE_RANK[r.role] || 0) > (ROLE_RANK[best] || 0) ? r.role : best
  }, 'nagarik')

  var existing = null
  if (p.google_uid) existing = idxFind(IDX.USERS, 'google_uid', p.google_uid)
  if (!existing && emailRows.length) {
    // Prefer rows that already have an id (auto-created), else use first match
    existing = emailRows.find(function(r) { return r.id }) || emailRows[0]
  }

  if (existing) {
    // Promote role if any Sheet row has a higher role (e.g. admin set manually)
    if ((ROLE_RANK[bestRole] || 0) > (ROLE_RANK[existing.role] || 0) && existing.id) {
      idxUpdate(IDX.USERS, 'id', existing.id, { role: bestRole })
      existing.role = bestRole
    }
    // Backfill google_uid so future lookups skip the email scan
    if (!existing.google_uid && p.google_uid && existing.id) {
      idxUpdate(IDX.USERS, 'id', existing.id, { google_uid: p.google_uid })
      existing.google_uid = p.google_uid
    }
    if (existing.id) cacheSet(ck('user', existing.id), existing, 600)
    return existing
  }

  var id      = uuid()
  var now     = new Date().toISOString()
  var usersF  = driveFolder(CFG().ROOT_ID, 'users')
  var folder  = driveFolder(usersF.getId(), id)

  var profile = {
    id:         id,
    google_uid: p.google_uid  || '',
    email:      sanitize(p.email     || ''),
    name_en:    sanitize(p.name_en   || ''),
    name_np:    sanitize(p.name_np   || ''),
    phone:      sanitize(p.phone     || ''),
    gender:     sanitize(p.gender    || ''),
    role:       'nagarik',
    province:   sanitize(p.province  || ''),
    district:   sanitize(p.district  || ''),
    palika:     sanitize(p.palika    || ''),
    ward_no:    p.ward_no   || '',
    dept_id:    '',
    status:     'active',
    created_at: now,
  }

  driveWriteJSON(folder.getId(), 'profile.json', profile)
  idxAppend(IDX.USERS, {
    id: id, google_uid: p.google_uid || '', email: profile.email,
    role: 'nagarik', province: profile.province, palika: profile.palika,
    dept_id: '', folder_id: folder.getId(), created_at: now,
  })
  cacheSet(ck('user', id), profile, 600)
  return profile
}

function getUser(id) {
  if (!id) return null
  var cached = cacheGet(ck('user', id))
  if (cached) return cached

  var row = idxFind(IDX.USERS, 'id', id)
  if (!row) return null

  var folder = DriveApp.getFolderById(row.folder_id)
  var it     = folder.getFilesByName('profile.json')
  if (!it.hasNext()) return row   // fallback to index data

  var profile = JSON.parse(it.next().getBlob().getDataAsString())
  cacheSet(ck('user', id), profile, 600)
  return profile
}

function getUsers() {
  return idxRead(IDX.USERS).map(function(r) {
    return { id: r.id, email: r.email, role: r.role, province: r.province, palika: r.palika }
  })
}

function updateUserRole(p, auth) {
  authorize(auth.token, 'updateUserRole')
  var row = idxFind(IDX.USERS, 'id', p.id)
  if (!row) throw new Error('User not found: ' + p.id)

  idxUpdate(IDX.USERS, 'id', p.id, { role: p.role, dept_id: p.dept_id || '' })

  var folder = DriveApp.getFolderById(row.folder_id)
  var it     = folder.getFilesByName('profile.json')
  if (it.hasNext()) {
    var file = it.next()
    var prof = JSON.parse(file.getBlob().getDataAsString())
    prof.role       = p.role
    prof.dept_id    = p.dept_id || prof.dept_id
    prof.updated_at = new Date().toISOString()
    file.setContent(JSON.stringify(prof, null, 2))
  }

  cacheInvalidate(ck('user', p.id))
  auditLog(auth.user_id, 'updateUserRole', p.id, 'ok', { new_role: p.role })
  return { ok: true }
}

// =============================================================================
// SECTION 7B — ADMIN VIEW & APP CONFIGURATION
// =============================================================================

// Returns a full admin dashboard payload (reports + users + stats + config)
function getAdminView(p, auth) {
  var sess = authorize(auth.token, 'getAdminView')

  var stats          = getDashboardStats(p || {})
  var users          = idxRead(IDX.USERS).map(function(r) {
    return { id: r.id, email: r.email, role: r.role, province: r.province, palika: r.palika, created_at: r.created_at }
  })
  var allReports     = idxRead(IDX.REPORTS)
  var recentReports  = allReports.slice().sort(function(a, b) {
    return new Date(b.created_at) - new Date(a.created_at)
  }).slice(0, 50)
  var criticalOpen   = allReports.filter(function(r) {
    return r.severity === 'critical' && ['samaadhaan','banda'].indexOf(r.status) < 0
  })
  var pendingReports = allReports.filter(function(r) { return r.status === 'darta' })
  var inProgressReports = allReports.filter(function(r) { return r.status === 'in_progress' })

  return {
    stats:            stats,
    users:            users,
    recentReports:    recentReports,
    criticalOpen:     criticalOpen,
    pendingReports:   pendingReports.length,
    inProgress:       inProgressReports.length,
    totalReports:     allReports.length,
    appConfig:        getAppConfig(),
    emergencyMode:    PROPS.getProperty('EMERGENCY_MODE') === 'true',
    emergencyReason:  PROPS.getProperty('EMERGENCY_REASON') || '',
    viewerRole:       sess.role,
  }
}

// Returns the citizen-facing view config and public data summary
function getCitizenView(p) {
  var cfg  = getAppConfig()
  var stats = getDashboardStats(p || {})
  return {
    appName:      cfg.app_name,
    appNameLocal: cfg.app_name_local,
    country:      cfg.country,
    countryName:  cfg.country_name,
    currency:     cfg.currency,
    geoLevels:    cfg.geo_levels,
    stats:        stats,
    emergencyMode: PROPS.getProperty('EMERGENCY_MODE') === 'true',
  }
}

// Returns current app/country configuration (readable by all)
function getAppConfig() {
  var defaultGeoLevels = JSON.stringify(['province','district','palika','ward'])
  var defaultEmergencyKw = JSON.stringify(['flood','collapse','fire','landslide','explosion',
    'बाढी','पहिरो','आगलागी','मृत्यु','घाइते','भत्कियो','डुब्यो'])
  return {
    app_name:                  PROPS.getProperty('APP_NAME')                  || 'NagarikAwaz',
    app_name_local:            PROPS.getProperty('APP_NAME_LOCAL')            || 'नागरिक आवाज',
    country:                   PROPS.getProperty('COUNTRY')                   || 'nepal',
    country_name:              PROPS.getProperty('COUNTRY_NAME')              || 'Nepal',
    currency:                  PROPS.getProperty('CURRENCY')                  || 'NPR',
    timezone:                  PROPS.getProperty('TIMEZONE')                  || 'Asia/Kathmandu',
    locale:                    PROPS.getProperty('LOCALE')                    || 'ne-NP',
    geo_levels:                JSON.parse(PROPS.getProperty('GEO_LEVELS')     || defaultGeoLevels),
    sms_provider:              PROPS.getProperty('SMS_PROVIDER')              || 'sparrow',
    emergency_keywords_local:  JSON.parse(PROPS.getProperty('EMERGENCY_KEYWORDS_LOCAL') || defaultEmergencyKw),
    site_url:                  PROPS.getProperty('SITE_URL')                  || 'https://nagarikawaz.netlify.app',
  }
}

// Update app name, country, or any developer-configurable setting (admin only)
function updateAppConfig(p, auth) {
  authorize(auth.token, 'updateAppConfig')
  var allowedKeys = {
    app_name:                 'APP_NAME',
    app_name_local:           'APP_NAME_LOCAL',
    country:                  'COUNTRY',
    country_name:             'COUNTRY_NAME',
    currency:                 'CURRENCY',
    timezone:                 'TIMEZONE',
    locale:                   'LOCALE',
    geo_levels:               'GEO_LEVELS',
    sms_provider:             'SMS_PROVIDER',
    emergency_keywords_local: 'EMERGENCY_KEYWORDS_LOCAL',
    site_url:                 'SITE_URL',
    admin_email:              'ADMIN_EMAIL',
    sparrow_identity:         'SPARROW_IDENTITY',
  }
  var updated = []
  Object.keys(allowedKeys).forEach(function(field) {
    if (p[field] === undefined) return
    var val = (typeof p[field] === 'object') ? JSON.stringify(p[field]) : String(p[field])
    PROPS.setProperty(allowedKeys[field], val)
    updated.push(field)
  })
  auditLog(auth.user_id, 'updateAppConfig', 'system', 'ok', { updated: updated })
  return { ok: true, updated: updated, config: getAppConfig() }
}

// =============================================================================
// SECTION 8 — REPORT CRUD (Drive-first)
// =============================================================================

function createReport(p, auth) {
  var submitterId = auth && auth.user_id ? auth.user_id : (p.submitted_by || 'anonymous')
  var id          = uuid()
  var now         = new Date().toISOString()

  // AI-assisted fields (fast path: heuristic if Gemini unavailable)
  var aiCat    = aiCategorize(p.description_np || '', p.description_en || '')
  var category = sanitize(p.category || aiCat.category || 'other')
  var severity = sanitize(p.severity || aiCat.severity || 'medium')

  // Emergency detection (keyword heuristic — no API call)
  var isEmergency = detectEmergencyKeywords((p.title_en || p.title_np || '') + ' ' + (p.description_en || p.description_np || ''))
  if (isEmergency) severity = 'critical'

  var score       = calcPriority({ severity: severity, category: category, upvotes: 0, comments_count: 0, is_emergency: isEmergency })
  var dept        = autoAssignDepartment(category, p.province, p.palika)
  var slaDeadline = calculateSLADeadline(severity, now)

  var report = {
    id:               id,
    version:          1,
    title_np:         sanitize(p.title_np         || ''),
    title_en:         sanitize(p.title_en         || ''),
    description_np:   sanitize(p.description_np   || ''),
    description_en:   sanitize(p.description_en   || ''),
    category:         category,
    severity:         severity,
    lat:              parseFloat(p.lat)  || null,
    lng:              parseFloat(p.lng)  || null,
    province:         sanitize(p.province         || ''),
    district:         sanitize(p.district         || ''),
    palika:           sanitize(p.palika           || ''),
    palika_type:      sanitize(p.palika_type      || 'gaunpalika'),
    ward_no:          sanitize(p.ward_no           || ''),
    address_np:       sanitize(p.address_np       || ''),
    address_en:       sanitize(p.address_en       || ''),
    status:           'darta',
    priority_score:   score,
    department:       dept,
    assigned_officer: '',
    submitted_by:     submitterId,
    submitter_phone:  sanitize(p.submitter_phone  || ''),
    photo_ids:        typeof p.photo_ids === 'string'
                        ? p.photo_ids.split(',').map(function(s){ return s.trim() }).filter(Boolean)
                        : (p.photo_ids || []),
    upvotes:          0,
    upvoters:         [],
    comments_count:   0,
    sla_deadline:     slaDeadline,
    escalated:        false,
    is_emergency:     isEmergency,
    ai_tags:          aiCat.tags || [],
    created_at:       now,
    updated_at:       now,
    resolved_at:      null,
  }

  // 1. Drive folder + report.json  (PRIMARY store)
  var folder   = getOrCreateReportFolder(report.province, report.district, report.palika, id)
  var jsonFile = driveWriteJSON(folder.getId(), 'report.json', report)

  // 2. Sheet index row  (SECONDARY — pointers only)
  idxAppend(IDX.REPORTS, {
    id:             id,
    folder_id:      folder.getId(),
    json_file_id:   jsonFile.getId(),
    province:       report.province,
    district:       report.district,
    palika:         report.palika,
    ward_no:        report.ward_no,
    category:       report.category,
    severity:       report.severity,
    status:         'darta',
    priority_score: score,
    lat:            report.lat || '',
    lng:            report.lng || '',
    submitted_by:   submitterId,
    created_at:     now,
    updated_at:     now,
  })

  // 3. Notifications
  notifyNewReport(report)
  if (isEmergency) notifyEmergency(report)

  // 4. Audit
  auditLog(submitterId, 'createReport', id, 'ok', { category: category, severity: severity })

  return { id: id, priority_score: score, status: 'darta', sla_deadline: slaDeadline, is_emergency: isEmergency, created_at: now }
}

function getReport(id) {
  if (!id) throw new Error('id required')
  var ckey   = ck('report', id)
  var cached = cacheGet(ckey)
  if (cached) return cached

  var row = idxFind(IDX.REPORTS, 'id', id)
  if (!row) throw new Error('Report not found: ' + id)

  var report = driveReadJSON(row.json_file_id)
  cacheSet(ckey, report, CFG().CACHE_TTL)
  return report
}

function getReports(p) {
  // Query the Sheet index — never traverse Drive folders
  var filters = {}
  if (p.province)     filters.province     = p.province
  if (p.district)     filters.district     = p.district
  if (p.palika)       filters.palika       = p.palika
  if (p.ward_no)      filters.ward_no      = p.ward_no
  if (p.category)     filters.category     = p.category
  if (p.severity)     filters.severity     = p.severity
  if (p.status)       filters.status       = p.status
  if (p.submitted_by) filters.submitted_by = p.submitted_by

  var rows = idxFilter(IDX.REPORTS, filters)

  var sort = p.sort || 'created_at'
  rows.sort(function(a, b) {
    if (sort === 'priority_score') return (Number(b.priority_score) || 0) - (Number(a.priority_score) || 0)
    if (sort === 'updated_at')     return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
    return new Date(b.created_at) - new Date(a.created_at)
  })

  var limit = Math.min(parseInt(p.limit || '50'), 200)
  var page  = Math.max(0, parseInt(p.page || '1') - 1)
  var slice = rows.slice(page * limit, page * limit + limit)

  // index_only=true returns index fields (fast, no Drive reads) — good for map pins
  if (p.index_only === 'true') {
    return { reports: slice, total: rows.length, page: page + 1, limit: limit }
  }

  // Otherwise fetch full report.json from Drive for each page slice
  var full = slice.map(function(r) {
    var c = cacheGet(ck('report', r.id))
    if (c) return c
    try {
      var rep = driveReadJSON(r.json_file_id)
      cacheSet(ck('report', r.id), rep, CFG().CACHE_TTL)
      return rep
    } catch (e) { return r }   // fallback to index row if Drive read fails
  })

  return { reports: full, total: rows.length, page: page + 1, limit: limit }
}

function updateReport(p, auth) {
  var session = authorize(auth.token, 'updateReport')
  var row     = idxFind(IDX.REPORTS, 'id', p.id)
  if (!row) throw new Error('Report not found: ' + p.id)

  var report = driveReadJSON(row.json_file_id)

  // Validate workflow transition
  if (p.status && p.status !== report.status) {
    var allowed = WORKFLOW[report.status] || []
    if (allowed.indexOf(p.status) < 0) {
      throw new Error('Invalid transition: ' + report.status + ' → ' + p.status)
    }
  }

  var now = new Date().toISOString()

  // Append-only snapshot of this change
  driveAppendEvent(row.folder_id, 'status_updates', 'snapshot', {
    by: session.user_id, from: report.status, to: p.status || report.status,
    note: p.note || '', at: now, version: report.version,
  })

  // Apply allowed field updates
  var allowed_fields = ['title_np','title_en','description_np','description_en','category',
                        'severity','status','priority_score','department','assigned_officer',
                        'address_np','address_en','photo_ids']
  allowed_fields.forEach(function(k) {
    if (p[k] !== undefined && p[k] !== null) report[k] = p[k]
  })
  report.version    = (report.version || 1) + 1
  report.updated_at = now
  if ((p.status === 'samaadhaan' || p.status === 'banda') && !report.resolved_at) {
    report.resolved_at = now
  }

  // Write updated JSON to Drive
  DriveApp.getFileById(row.json_file_id).setContent(JSON.stringify(report, null, 2))

  // Update index pointers
  idxUpdate(IDX.REPORTS, 'id', p.id, {
    status:         report.status,
    priority_score: report.priority_score || row.priority_score,
    updated_at:     now,
  })

  if (p.status && p.status !== row.status) notifyStatusChange(report, p.status)
  cacheInvalidate(ck('report', p.id))
  auditLog(session.user_id, 'updateReport', p.id, 'ok', { status: p.status, version: report.version })
  return { ok: true, id: p.id, version: report.version, updated_at: now }
}

function deleteReport(id, auth) {
  var session = authorize(auth.token, 'deleteReport')
  var row     = idxFind(IDX.REPORTS, 'id', id)
  if (!row) throw new Error('Report not found: ' + id)

  // Move to trash — keeps data 30 days, recoverable
  DriveApp.getFolderById(row.folder_id).setTrashed(true)
  idxDeleteRow(IDX.REPORTS, 'id', id)
  cacheInvalidate(ck('report', id))
  auditLog(session.user_id, 'deleteReport', id, 'ok', {})
  return { ok: true, id: id }
}

function upvoteReport(p, auth) {
  var userId = auth && auth.user_id ? auth.user_id : ('anon_' + uuid().substr(0, 8))
  var row    = idxFind(IDX.REPORTS, 'id', p.id)
  if (!row) throw new Error('Report not found: ' + p.id)

  var report = driveReadJSON(row.json_file_id)
  if (report.upvoters && report.upvoters.indexOf(userId) >= 0) {
    return { ok: false, reason: 'already_upvoted', upvotes: report.upvotes }
  }

  report.upvotes        = (report.upvotes || 0) + 1
  report.upvoters       = (report.upvoters || []).concat([userId])
  report.priority_score = calcPriority(report)
  report.updated_at     = new Date().toISOString()

  DriveApp.getFileById(row.json_file_id).setContent(JSON.stringify(report, null, 2))
  idxUpdate(IDX.REPORTS, 'id', p.id, { priority_score: report.priority_score, updated_at: report.updated_at })
  cacheInvalidate(ck('report', p.id))
  return { ok: true, upvotes: report.upvotes }
}

// =============================================================================
// SECTION 9 — COMMENTS & PROGRESS (Drive append-only)
// =============================================================================

function addComment(p, auth) {
  if (!p.reportId) throw new Error('reportId required')
  var userId = auth && auth.user_id ? auth.user_id : 'anonymous'
  var row    = idxFind(IDX.REPORTS, 'id', p.reportId)
  if (!row) throw new Error('Report not found: ' + p.reportId)

  var comment = {
    id: uuid(), report_id: p.reportId, user_id: userId,
    user_name:  sanitize(p.user_name  || ''),
    comment_np: sanitize(p.comment_np || ''),
    comment_en: sanitize(p.comment_en || ''),
    created_at: new Date().toISOString(),
  }
  driveAppendEvent(row.folder_id, 'comments', 'comment', comment)

  // Update counter in report.json
  var report = driveReadJSON(row.json_file_id)
  report.comments_count = (report.comments_count || 0) + 1
  report.updated_at     = new Date().toISOString()
  DriveApp.getFileById(row.json_file_id).setContent(JSON.stringify(report, null, 2))
  cacheInvalidate(ck('report', p.reportId))
  cacheInvalidate(ck('comments', p.reportId))

  return { id: comment.id, created_at: comment.created_at }
}

function getComments(reportId) {
  if (!reportId) return []
  var ckey   = ck('comments', reportId)
  var cached = cacheGet(ckey)
  if (cached) return cached

  var row = idxFind(IDX.REPORTS, 'id', reportId)
  if (!row) return []

  var repFolder = DriveApp.getFolderById(row.folder_id)
  var cit       = repFolder.getFoldersByName('comments')
  if (!cit.hasNext()) return []

  var files    = cit.next().getFiles()
  var comments = []
  while (files.hasNext()) {
    try { comments.push(JSON.parse(files.next().getBlob().getDataAsString())) } catch (e) {}
  }
  comments.sort(function(a, b) { return new Date(a.created_at) - new Date(b.created_at) })
  cacheSet(ckey, comments, 60)
  return comments
}

function addProgress(p, auth) {
  var session = authorize(auth.token, 'addProgress')
  if (!p.reportId) throw new Error('reportId required')
  var row = idxFind(IDX.REPORTS, 'id', p.reportId)
  if (!row) throw new Error('Report not found: ' + p.reportId)

  var update = {
    id:               uuid(),
    report_id:        p.reportId,
    officer_id:       session.user_id,
    officer_name:     sanitize(p.officer   || ''),
    status:           sanitize(p.status    || ''),
    progress_percent: Math.min(100, Math.max(0, parseInt(p.progress_percent || 0))),
    note_np:          sanitize(p.note_np   || ''),
    note_en:          sanitize(p.note_en   || ''),
    department:       sanitize(p.department || ''),
    timestamp:        new Date().toISOString(),
  }
  driveAppendEvent(row.folder_id, 'status_updates', 'progress', update)
  if (p.status) updateReport({ id: p.reportId, status: p.status, note: p.note_en || p.note_np }, auth)

  cacheInvalidate(ck('progress', p.reportId))
  return { id: update.id, timestamp: update.timestamp }
}

function getProgress(reportId) {
  if (!reportId) return []
  var ckey   = ck('progress', reportId)
  var cached = cacheGet(ckey)
  if (cached) return cached

  var row = idxFind(IDX.REPORTS, 'id', reportId)
  if (!row) return []

  var repFolder = DriveApp.getFolderById(row.folder_id)
  var sit       = repFolder.getFoldersByName('status_updates')
  if (!sit.hasNext()) return []

  var files   = sit.next().getFiles()
  var updates = []
  while (files.hasNext()) {
    try { updates.push(JSON.parse(files.next().getBlob().getDataAsString())) } catch (e) {}
  }
  updates.sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp) })
  cacheSet(ckey, updates, 60)
  return updates
}

// =============================================================================
// SECTION 10 — PHOTO UPLOAD
// =============================================================================

function uploadPhoto(p, auth) {
  if (!p.data || !p.fileName) throw new Error('data and fileName required')

  var folder
  if (p.reportId) {
    var row = idxFind(IDX.REPORTS, 'id', p.reportId)
    if (row) {
      var repF = DriveApp.getFolderById(row.folder_id)
      var iit  = repF.getFoldersByName('images')
      folder   = iit.hasNext() ? iit.next() : repF.createFolder('images')
    }
  }
  if (!folder) folder = driveFolder(CFG().ROOT_ID, '_uploads_temp')

  var bytes = Utilities.base64Decode(p.data)
  var blob  = Utilities.newBlob(bytes, p.mimeType || 'image/jpeg', sanitize(p.fileName))
  var file  = folder.createFile(blob)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)

  return {
    fileId:   file.getId(),
    fileUrl:  file.getUrl(),
    thumbUrl: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w600',
  }
}

// =============================================================================
// SECTION 11 — AI ENGINE
// =============================================================================

// Core Gemini call with retry + strict JSON enforcement
function callGeminiStructured(systemPrompt, userContent, outputSchema, maxTokens) {
  var key = CFG().GEMINI_KEY
  if (!key) throw new Error('GEMINI_API_KEY not configured')

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + key

  var fullPrompt =
    systemPrompt + '\n\n--- INPUT ---\n' + userContent +
    '\n\n--- REQUIRED OUTPUT FORMAT ---\n' +
    'Return ONLY a valid JSON object. No markdown fences, no explanation, no preamble.\n' +
    'Match this exact schema:\n' + JSON.stringify(outputSchema, null, 2)

  var payload = JSON.stringify({
    contents: [{ parts: [{ text: fullPrompt }] }],
    generationConfig: { maxOutputTokens: maxTokens || 1500, temperature: 0.2, topK: 40, topP: 0.8 },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  })

  for (var attempt = 1; attempt <= CFG().MAX_RETRIES; attempt++) {
    try {
      var res  = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: payload, muteHttpExceptions: true })
      var d    = JSON.parse(res.getContentText())
      if (d.error) throw new Error('Gemini: ' + d.error.message)

      var text = d.candidates[0].content.parts[0].text

      // Strip accidental markdown fences
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

      // Extract first { } block if there's surrounding prose
      var match = text.match(/\{[\s\S]*\}/)
      if (match) text = match[0]

      return JSON.parse(text)
    } catch (e) {
      if (attempt === CFG().MAX_RETRIES) throw e
      Utilities.sleep(1000 * attempt)
    }
  }
}

// Auto-categorize report text using Gemini (with cache + heuristic fallback)
function aiCategorize(text_np, text_en) {
  var combined = (text_en + ' ' + text_np).trim()
  if (!combined) return { category: 'other', severity: 'medium', tags: [] }

  var ckey   = ck('ai_cat', Utilities.base64Encode(combined.substr(0, 120)))
  var cached = cacheGet(ckey)
  if (cached) return cached

  var schema = {
    category:   'one of: road|bridge|water|drainage|landslide|electricity|waste|health|other',
    severity:   'one of: critical|high|medium|low',
    confidence: 0,
    tags:       ['keyword string'],
  }
  try {
    var result = callGeminiStructured(
      'You are a Nepal municipal infrastructure classifier. ' +
      'Classify the report text into one infrastructure category and severity.',
      combined, schema, 200
    )
    // Validate against known values
    var validCats = ['road','bridge','water','drainage','landslide','electricity','waste','health','other']
    var validSevs = ['critical','high','medium','low']
    result.category = validCats.indexOf(result.category) >= 0 ? result.category : 'other'
    result.severity = validSevs.indexOf(result.severity) >= 0 ? result.severity : 'medium'
    cacheSet(ckey, result, 3600)
    return result
  } catch (e) {
    Logger.log('aiCategorize failed: ' + e.message)
    return { category: 'other', severity: 'medium', tags: [], confidence: 0 }
  }
}

// Keyword-based emergency detection (no API call — instant)
// Base keywords are always checked; additional local keywords come from EMERGENCY_KEYWORDS_LOCAL property
function detectEmergencyKeywords(text) {
  var base = [
    'flood','flooding','collapse','collapsed','fire','death','fatality','injury',
    'landslide','bridge break','road break','sinking','explosion','dam breach',
  ]
  var localKw = []
  try {
    var stored = PROPS.getProperty('EMERGENCY_KEYWORDS_LOCAL')
    localKw = stored ? JSON.parse(stored) : ['बाढी','पहिरो','आगलागी','मृत्यु','घाइते','भत्कियो','डुब्यो']
  } catch (e) { localKw = ['बाढी','पहिरो','आगलागी','मृत्यु','घाइते','भत्कियो','डुब्यो'] }

  var keywords = base.concat(localKw)
  var lower    = text.toLowerCase()
  for (var i = 0; i < keywords.length; i++) {
    if (lower.indexOf(keywords[i]) >= 0) return true
  }
  return false
}

// Full AI report generation for a region
function generateAIReport(p, auth) {
  authorize(auth.token, 'generateAIReport')

  var filters = {}
  if (p.province) filters.province = p.province
  if (p.district) filters.district = p.district
  if (p.palika)   filters.palika   = p.palika
  var scope = [p.palika, p.district, p.province].filter(Boolean).join(', ') || 'All Nepal'

  var rows   = idxFilter(IDX.REPORTS, filters)
  var sorted = rows.slice().sort(function(a, b) {
    return (Number(b.priority_score) || 0) - (Number(a.priority_score) || 0)
  }).slice(0, 60)

  var issues = sorted.map(function(r) {
    return { id: r.id, category: r.category, severity: r.severity, status: r.status,
             palika: r.palika, district: r.district, province: r.province,
             ward_no: r.ward_no, priority_score: r.priority_score, created_at: r.created_at }
  })

  var schema = {
    executive_summary:       'string: 2-3 sentence bilingual (English | नेपाली)',
    priorities:              [{ rank: 1, title: 'string', score: 0, reason: 'string', category: 'string', location: 'string' }],
    trends:                  'string: 2-3 sentences on patterns and hotspots',
    seasonal_risk:           'string: monsoon/dry season risk analysis for Nepal',
    budget_recommendations:  'string: NPR-denominated allocation suggestions',
    risk_assessment:         'string: consequences if left unresolved',
    recommended_actions:     ['string'],
    resolution_forecast:     'string: estimated timeframe to resolve top issues',
    hotspot_areas:           ['string'],
  }

  var summary = callGeminiStructured(
    'You are a senior municipal infrastructure analyst for the Nepal government. ' +
    'Analyze the provided citizen-reported issues and return a structured report.',
    'Scope: ' + scope + ' | Issue count: ' + issues.length + '\n\nIssues:\n' + JSON.stringify(issues),
    schema, 2500
  )

  // Store in Drive _ai_reports folder
  var aiFolder = driveFolder(CFG().ROOT_ID, '_ai_reports')
  var dateStr  = Utilities.formatDate(new Date(), 'Asia/Kathmandu', 'yyyy-MM-dd')
  var repId    = uuid()
  var aiFile   = driveWriteJSON(aiFolder.getId(),
    'ai_' + repId + '_' + scope.replace(/[\s,]+/g, '_').substr(0, 30) + '_' + dateStr + '.json',
    { id: repId, scope: scope, summary: summary, issue_count: issues.length, generated_at: new Date().toISOString() }
  )

  var docUrl = createReportDoc(summary, scope, issues.length)

  idxAppend(IDX.CACHE, {
    key:         'ai_report_' + repId,
    json:        JSON.stringify({ id: repId, scope: scope, doc_url: docUrl, file_id: aiFile.getId(), issue_count: issues.length, created_at: new Date().toISOString() }),
    computed_at: new Date().toISOString(),
  })

  auditLog(auth.user_id, 'generateAIReport', repId, 'ok', { scope: scope, issue_count: issues.length })
  return { id: repId, summary: summary, docUrl: docUrl, fileId: aiFile.getId(), reportCount: issues.length }
}

function listAIReports() {
  return idxFilter(IDX.CACHE, {})
    .filter(function(r) { return r.key.indexOf('ai_report_') === 0 })
    .map(function(r) { try { return JSON.parse(r.json) } catch (e) { return null } })
    .filter(Boolean)
    .sort(function(a, b) { return new Date(b.created_at || 0) - new Date(a.created_at || 0) })
}

function prioritizeReport(id, auth) {
  authorize(auth.token, 'prioritizeReport')
  var row    = idxFind(IDX.REPORTS, 'id', id)
  if (!row)  throw new Error('Report not found: ' + id)
  var report = driveReadJSON(row.json_file_id)

  var schema = { score: 75, reasoning: 'string: one-sentence explanation' }
  try {
    var result = callGeminiStructured(
      'Score this Nepal infrastructure report 0–100 for urgency. Consider severity, location risk, and community impact.',
      JSON.stringify(report), schema, 200
    )
    result.score = Math.min(100, Math.max(0, parseInt(result.score) || 50))
    updateReport({ id: id, priority_score: result.score }, auth)
    return result
  } catch (e) {
    return { score: calcPriority(report), reasoning: 'Heuristic fallback (AI unavailable)' }
  }
}

// =============================================================================
// SECTION 12 — DEPARTMENT ROUTING ENGINE
// =============================================================================

function autoAssignDepartment(category, province, palika) {
  var depts = idxRead(IDX.DEPTS)

  // Try palika-specific first, then province-level
  var match = depts.find(function(d) {
    return d.palika === palika &&
           d.categories.split(',').some(function(c) { return c.trim() === category })
  }) || depts.find(function(d) {
    return d.province === province &&
           d.categories.split(',').some(function(c) { return c.trim() === category })
  })

  return match ? match.id : (DEPT_MAP[category] || 'general_dept')
}

function getOfficerWorkload() {
  var inProgress = idxFilter(IDX.REPORTS, { status: 'in_progress' })
  var counts     = {}
  inProgress.forEach(function(r) {
    counts[r.submitted_by] = (counts[r.submitted_by] || 0) + 1
  })
  return counts
}

// =============================================================================
// SECTION 13 — SLA & ESCALATION ENGINE
// =============================================================================

function calculateSLADeadline(severity, createdAt) {
  var hours   = SLA_HOURS[severity] || SLA_HOURS.medium
  var created = new Date(createdAt)
  return new Date(created.getTime() + hours * 3600000).toISOString()
}

// Called by 6-hour trigger
function checkSLABreaches() {
  var now  = new Date()
  var rows = idxRead(IDX.REPORTS).filter(function(r) {
    return r.status !== 'samaadhaan' && r.status !== 'banda'
  })

  var count = 0
  rows.forEach(function(r) {
    if (!r.sla_deadline || new Date(r.sla_deadline) > now) return
    try {
      var report = driveReadJSON(r.json_file_id)
      if (!report.escalated) {
        escalateReport(r.id, 'SLA breached — ' + r.severity + ' issue open for ' +
          Math.round((now - new Date(r.created_at)) / 3600000) + ' hours')
        count++
      }
    } catch (e) { Logger.log('SLA check error ' + r.id + ': ' + e.message) }
  })

  auditLog('system', 'slaCheck', 'all', 'ok', { breached: count, checked: rows.length })
}

function escalateReport(reportId, reason) {
  var row = idxFind(IDX.REPORTS, 'id', reportId)
  if (!row) return

  var report          = driveReadJSON(row.json_file_id)
  report.escalated    = true
  report.escalated_at = new Date().toISOString()
  report.escalation_note = reason
  report.priority_score  = Math.min(100, (report.priority_score || 50) + 20)
  report.updated_at      = new Date().toISOString()

  DriveApp.getFileById(row.json_file_id).setContent(JSON.stringify(report, null, 2))
  idxUpdate(IDX.REPORTS, 'id', reportId, { priority_score: report.priority_score, updated_at: report.updated_at })
  cacheInvalidate(ck('report', reportId))

  notifyEscalation(report, reason)
  auditLog('system', 'escalate', reportId, 'ok', { reason: reason })
}

// =============================================================================
// SECTION 14 — GIS ENGINE
// =============================================================================

function haversine(lat1, lng1, lat2, lng2) {
  var R  = 6371000   // metres
  var p1 = lat1 * Math.PI / 180
  var p2 = lat2 * Math.PI / 180
  var dp = (lat2 - lat1) * Math.PI / 180
  var dl = (lng2 - lng1) * Math.PI / 180
  var a  = Math.sin(dp / 2) * Math.sin(dp / 2) +
           Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getNearbyReports(p) {
  if (!p.lat || !p.lng) return []
  var lat    = parseFloat(p.lat)
  var lng    = parseFloat(p.lng)
  var radius = parseFloat(p.radius || '2000')   // metres, default 2 km
  var max    = parseInt(p.max || '20')

  return idxRead(IDX.REPORTS)
    .filter(function(r) {
      if (!r.lat || !r.lng || r.status === 'banda') return false
      return haversine(lat, lng, parseFloat(r.lat), parseFloat(r.lng)) <= radius
    })
    .sort(function(a, b) { return (Number(b.priority_score) || 0) - (Number(a.priority_score) || 0) })
    .slice(0, max)
}

// Returns {lat, lng, weight, id} points suitable for a client-side heatmap
function getHeatmapData(p) {
  var ckey   = ck('heatmap', p.province || 'all', p.category || 'all')
  var cached = cacheGet(ckey)
  if (cached) return cached

  var filters = {}
  if (p.province) filters.province = p.province
  if (p.category) filters.category = p.category
  if (p.status)   filters.status   = p.status

  var points = idxFilter(IDX.REPORTS, filters)
    .filter(function(r) { return r.lat && r.lng })
    .map(function(r) {
      return { lat: parseFloat(r.lat), lng: parseFloat(r.lng), weight: (Number(r.priority_score) || 50) / 100, id: r.id }
    })

  var result = { points: points, total: points.length }
  cacheSet(ckey, result, 300)
  return result
}

// Grid-based risk zone clustering (0.1° × 0.1° cells ≈ 11 km²)
function getRiskZones(p) {
  var filters = {}
  if (p.province) filters.province = p.province

  var rows = idxFilter(IDX.REPORTS, filters)
    .filter(function(r) { return r.lat && r.lng && r.status !== 'samaadhaan' && r.status !== 'banda' })

  var grid = {}
  rows.forEach(function(r) {
    var cellLat = Math.floor(parseFloat(r.lat) * 10) / 10
    var cellLng = Math.floor(parseFloat(r.lng) * 10) / 10
    var key     = cellLat.toFixed(1) + ',' + cellLng.toFixed(1)
    if (!grid[key]) grid[key] = { lat: cellLat + 0.05, lng: cellLng + 0.05, count: 0, critical: 0, score: 0 }
    grid[key].count++
    if (r.severity === 'critical') grid[key].critical++
    grid[key].score += Number(r.priority_score) || 0
  })

  return Object.keys(grid).map(function(k) {
    var z         = grid[k]
    z.risk_level  = z.critical > 0 ? 'high' : (z.count >= 5 ? 'medium' : 'low')
    z.avg_score   = z.count ? Math.round(z.score / z.count) : 0
    return z
  }).sort(function(a, b) { return b.score - a.score })
}

function getVulnerabilityScore(palika) {
  var rows = idxFilter(IDX.REPORTS, { palika: palika })
  var open = rows.filter(function(r) { return !['samaadhaan','banda'].includes(r.status) })
  var crit = open.filter(function(r) { return r.severity === 'critical' })
  return {
    palika: palika,
    score:  Math.min(100, open.length * 5 + crit.length * 20),
    open:   open.length,
    critical: crit.length,
    total:  rows.length,
  }
}

// =============================================================================
// SECTION 15 — NOTIFICATION SYSTEM
// =============================================================================

function sendEmail(to, subject, bodyText) {
  if (!to) return
  var appName = PROPS.getProperty('APP_NAME') || 'NagarikAwaz'
  var appNameLocal = PROPS.getProperty('APP_NAME_LOCAL') || 'नागरिक आवाज'
  try {
    MailApp.sendEmail({ to: to, subject: '[' + appName + '] ' + subject, body: bodyText, name: appNameLocal })
  } catch (e) { Logger.log('Email failed to ' + to + ': ' + e.message) }
}

// SMS dispatch — routes to the configured provider (sparrow for Nepal, twilio for others)
function sendSMS(phone, message) {
  if (!phone) return
  var provider = PROPS.getProperty('SMS_PROVIDER') || 'sparrow'
  if (provider === 'sparrow') {
    _sendSMS_Sparrow(phone, message)
  } else if (provider === 'twilio') {
    _sendSMS_Twilio(phone, message)
  } else {
    Logger.log('SMS provider "' + provider + '" not configured — skipping SMS to ' + phone)
  }
}

// Sparrow SMS — Nepal (https://sparrowsms.com)
function _sendSMS_Sparrow(phone, message) {
  var token = CFG().SPARROW_TOKEN
  if (!token) return

  var normalized = String(phone).replace(/[^0-9]/g, '')
  if (normalized.charAt(0) === '0') normalized = '977' + normalized.substr(1)
  if (normalized.indexOf('977') !== 0) normalized = '977' + normalized

  try {
    UrlFetchApp.fetch('http://api.sparrowsms.com/v2/sms/', {
      method:             'post',
      contentType:        'application/json',
      payload:            JSON.stringify({ token: token, identity: CFG().SPARROW_ID, to: normalized, text: message.substr(0, 160) }),
      muteHttpExceptions: true,
    })
  } catch (e) { Logger.log('Sparrow SMS failed to ' + phone + ': ' + e.message) }
}

// Twilio SMS — international (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM in Script Properties)
function _sendSMS_Twilio(phone, message) {
  var sid   = PROPS.getProperty('TWILIO_ACCOUNT_SID')
  var token = PROPS.getProperty('TWILIO_AUTH_TOKEN')
  var from  = PROPS.getProperty('TWILIO_FROM')
  if (!sid || !token || !from) { Logger.log('Twilio not fully configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM'); return }

  try {
    UrlFetchApp.fetch('https://api.twilio.com/2010-04-01/Accounts/' + sid + '/Messages.json', {
      method:             'post',
      headers:            { Authorization: 'Basic ' + Utilities.base64Encode(sid + ':' + token) },
      payload:            { To: phone, From: from, Body: message.substr(0, 160) },
      muteHttpExceptions: true,
    })
  } catch (e) { Logger.log('Twilio SMS failed to ' + phone + ': ' + e.message) }
}

function notifyNewReport(report) {
  var title = report.title_en || report.title_np || 'New Report'
  var loc   = [report.palika, report.district].filter(Boolean).join(', ')
  var url   = CFG().SITE_URL + '/report/' + report.id

  if (CFG().ADMIN_EMAIL) {
    sendEmail(CFG().ADMIN_EMAIL,
      'New ' + report.severity + ' report: ' + title,
      'Category: ' + report.category + '\nLocation: ' + loc + '\nPriority: ' + report.priority_score + '\nView: ' + url
    )
  }
  if (report.submitter_phone) {
    sendSMS(report.submitter_phone,
      'NagarikAwaz: Tapaaiko report darj bhayo. ID: ' + report.id.substr(0, 8) + '. Herna: ' + url
    )
  }
}

function notifyStatusChange(report, newStatus) {
  var labels = { darta: 'Darta', in_progress: 'Kaam Suru', samaadhaan: 'Samaadhaan', banda: 'Banda' }
  var url    = CFG().SITE_URL + '/report/' + report.id
  if (report.submitter_phone) {
    sendSMS(report.submitter_phone,
      'NagarikAwaz: ID ' + report.id.substr(0, 8) + ' — Status: ' + (labels[newStatus] || newStatus) + '. ' + url
    )
  }
}

function notifyEscalation(report, reason) {
  if (CFG().ADMIN_EMAIL) {
    sendEmail(CFG().ADMIN_EMAIL,
      'ESCALATED: ' + (report.title_en || report.id),
      reason + '\n\nPriority: ' + report.priority_score +
      '\nLocation: ' + [report.palika, report.district].filter(Boolean).join(', ') +
      '\nView: ' + CFG().SITE_URL + '/report/' + report.id
    )
  }
}

function notifyEmergency(report) {
  var msg = 'EMERGENCY: ' + (report.title_en || report.title_np) +
    ' | ' + [report.palika, report.district].filter(Boolean).join(', ') +
    ' | ' + CFG().SITE_URL + '/report/' + report.id
  if (CFG().ADMIN_EMAIL) sendEmail(CFG().ADMIN_EMAIL, 'EMERGENCY REPORT: ' + (report.title_en || report.id), msg)
  Logger.log('[EMERGENCY] ' + msg)
}

// =============================================================================
// SECTION 16 — ANALYTICS ENGINE
// =============================================================================

function getDashboardStats(p) {
  var ckey   = ck('stats', p.province || 'all', p.district || 'all', p.palika || 'all')
  var cached = cacheGet(ckey)
  if (cached) return cached

  var filters = {}
  if (p.province) filters.province = p.province
  if (p.district) filters.district = p.district
  if (p.palika)   filters.palika   = p.palika

  var rows     = idxFilter(IDX.REPORTS, filters)
  var open     = rows.filter(function(r) { return !['samaadhaan','banda'].includes(r.status) })
  var resolved = rows.filter(function(r) { return r.status === 'samaadhaan' })
  var critical = rows.filter(function(r) { return r.severity === 'critical' && !['samaadhaan','banda'].includes(r.status) })

  var cats = {}; var provs = {}
  rows.forEach(function(r) {
    cats[r.category]  = (cats[r.category]  || 0) + 1
    provs[r.province] = (provs[r.province] || 0) + 1
  })

  var trend = []
  for (var m = 5; m >= 0; m--) {
    var d   = new Date(); d.setMonth(d.getMonth() - m)
    var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    trend.push({ month: d.toLocaleString('default', { month: 'short' }), count: rows.filter(function(r) { return r.created_at && r.created_at.startsWith(key) }).length })
  }

  var result = {
    total: rows.length, open: open.length, resolved: resolved.length, critical: critical.length,
    byCategory: cats, byProvince: provs, monthlyTrend: trend,
    resolutionRate: rows.length ? Math.round(resolved.length / rows.length * 100) : 0,
  }
  cacheSet(ckey, result, 300)
  return result
}

// Nightly job — stores compact stats in Drive _analytics folder
function aggregateDailyStats() {
  var now     = new Date()
  var dateStr = Utilities.formatDate(now, 'Asia/Kathmandu', 'yyyy-MM-dd')
  var rows    = idxRead(IDX.REPORTS)

  var stats = {
    date:          dateStr,
    total:         rows.length,
    open:          rows.filter(function(r) { return !['samaadhaan','banda'].includes(r.status) }).length,
    resolved:      rows.filter(function(r) { return r.status === 'samaadhaan' }).length,
    critical_open: rows.filter(function(r) { return r.severity === 'critical' && !['samaadhaan','banda'].includes(r.status) }).length,
    new_today:     rows.filter(function(r) { return r.created_at && r.created_at.startsWith(dateStr) }).length,
  }

  var analyticsF = driveFolder(CFG().ROOT_ID, '_analytics')
  var monthF     = driveFolder(analyticsF.getId(), dateStr.substr(0, 7))
  driveWriteJSON(monthF.getId(), dateStr + '_stats.json', stats)
  Logger.log('Daily stats aggregated: ' + JSON.stringify(stats))
}

// =============================================================================
// SECTION 17 — WEEKLY REPORT ENGINE
// =============================================================================

function generateWeeklyReport() {
  var now     = new Date()
  var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  var allRows = idxRead(IDX.REPORTS)
  var weekRows = allRows.filter(function(r) { return r.created_at && new Date(r.created_at) >= weekAgo })

  var stats = _buildWeeklyStats(allRows, weekRows)
  var ai    = _weeklyAISummary(weekRows, stats)

  var dateStr = Utilities.formatDate(now, 'Asia/Kathmandu', 'yyyy-MM-dd')
  var title   = 'नागरिक आवाज Weekly Report — ' + dateStr
  var doc     = DocumentApp.create(title)
  _buildWeeklyDoc(doc.getBody(), weekRows, stats, ai, weekAgo, now)
  doc.saveAndClose()

  var weeklyF = driveFolder(CFG().ROOT_ID, '_weekly_reports')
  var docFile = DriveApp.getFileById(doc.getId())
  docFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
  weeklyF.addFile(docFile)
  try { DriveApp.getRootFolder().removeFile(docFile) } catch (e) {}

  var pdfBlob = docFile.getAs('application/pdf')
  pdfBlob.setName(title + '.pdf')
  var pdfFile = weeklyF.createFile(pdfBlob)
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)

  var id  = uuid()
  var rec = { id: id, title: title, period_start: weekAgo.toISOString(), period_end: now.toISOString(),
              report_count: weekRows.length, doc_url: docFile.getUrl(), pdf_url: pdfFile.getUrl(),
              summary: ai, created_at: now.toISOString() }
  driveWriteJSON(weeklyF.getId(), id + '_meta.json', rec)
  idxAppend(IDX.CACHE, {
    key:         'weekly_' + id,
    json:        JSON.stringify({ id: id, title: title, doc_url: docFile.getUrl(), pdf_url: pdfFile.getUrl(), report_count: weekRows.length, created_at: now.toISOString() }),
    computed_at: now.toISOString(),
  })

  return { id: id, docUrl: docFile.getUrl(), pdfUrl: pdfFile.getUrl(), reportCount: weekRows.length }
}

function getWeeklyReports() {
  return idxFilter(IDX.CACHE, {})
    .filter(function(r) { return r.key.indexOf('weekly_') === 0 })
    .map(function(r) { try { return JSON.parse(r.json) } catch (e) { return null } })
    .filter(Boolean)
    .sort(function(a, b) { return new Date(b.created_at || 0) - new Date(a.created_at || 0) })
}

function _buildWeeklyStats(all, week) {
  var cats = {}; var provs = {}; var sevs = {}
  week.forEach(function(r) {
    cats[r.category]  = (cats[r.category]  || 0) + 1
    provs[r.province] = (provs[r.province] || 0) + 1
    sevs[r.severity]  = (sevs[r.severity]  || 0) + 1
  })
  return {
    totalAll:    all.length,
    totalWeek:   week.length,
    open:        all.filter(function(r) { return !['samaadhaan','banda'].includes(r.status) }).length,
    resolved:    all.filter(function(r) { return r.status === 'samaadhaan' }).length,
    critical:    all.filter(function(r) { return r.severity === 'critical' && !['samaadhaan','banda'].includes(r.status) }).length,
    catCount:    cats,
    provCount:   provs,
    sevCount:    sevs,
    topPriority: week.slice().sort(function(a, b) { return (Number(b.priority_score)||0) - (Number(a.priority_score)||0) }).slice(0, 10),
  }
}

function _weeklyAISummary(weekRows, stats) {
  if (!CFG().GEMINI_KEY) return { executive_summary: 'AI unavailable (no API key).', recommendations: [] }
  var schema = {
    executive_summary: 'string: 2-3 sentence bilingual (English | नेपाली)',
    key_findings:      ['string'],
    hotspots:          ['string'],
    recommendations:   ['string'],
    trend:             'string: improving|worsening|stable with brief reason',
  }
  try {
    return callGeminiStructured(
      'You are a Nepal municipal analyst. Summarize this week\'s citizen-reported infrastructure issues.',
      'New reports: ' + weekRows.length + ' | Open: ' + stats.open + ' | Resolved: ' + stats.resolved +
      ' | Critical: ' + stats.critical + '\nBy category: ' + JSON.stringify(stats.catCount) +
      '\nBy province: ' + JSON.stringify(stats.provCount),
      schema, 800
    )
  } catch (e) { return { executive_summary: 'Summary failed: ' + e.message, recommendations: [] } }
}

function _buildWeeklyDoc(body, week, stats, ai, weekAgo, now) {
  var fmt = function(d) { return Utilities.formatDate(d, 'Asia/Kathmandu', 'MMM dd, yyyy') }

  body.appendParagraph('नागरिक आवाज | NagarikAwaz')
    .setHeading(DocumentApp.ParagraphHeading.HEADING1).setAlignment(DocumentApp.HorizontalAlignment.CENTER)
  body.appendParagraph('साप्ताहिक प्रतिवेदन — ' + fmt(weekAgo) + ' to ' + fmt(now))
    .setHeading(DocumentApp.ParagraphHeading.HEADING2).setAlignment(DocumentApp.HorizontalAlignment.CENTER)
  body.appendHorizontalRule()

  body.appendParagraph('Weekly Snapshot').setHeading(DocumentApp.ParagraphHeading.HEADING2)
  var tbl = body.appendTable([
    ['Metric', 'Value'],
    ['New reports this week',   String(stats.totalWeek)],
    ['Total reports (all time)',String(stats.totalAll)],
    ['Currently open',          String(stats.open)],
    ['Resolved (all time)',     String(stats.resolved)],
    ['Critical & open',         String(stats.critical)],
  ])
  tbl.getRow(0).editAsText().setBold(true)

  body.appendParagraph('AI Executive Summary').setHeading(DocumentApp.ParagraphHeading.HEADING2)
  body.appendParagraph(ai.executive_summary || 'Not available.')
  if (ai.key_findings && ai.key_findings.length) {
    body.appendParagraph('Key Findings:').setBold(true)
    ai.key_findings.forEach(function(f) { body.appendListItem(f).setGlyphType(DocumentApp.GlyphType.BULLET) })
  }
  if (ai.trend) body.appendParagraph('Trend: ' + ai.trend).setItalic(true)

  if (stats.topPriority.length) {
    body.appendParagraph('Top Priority Issues').setHeading(DocumentApp.ParagraphHeading.HEADING2)
    var priRows = [['#','Title','Category','Severity','Location','Score']]
    stats.topPriority.forEach(function(r, i) {
      priRows.push([String(i+1), (r.title_en || r.id || '').substr(0,40),
                    r.category||'', r.severity||'',
                    [r.palika,r.district].filter(Boolean).join(', ') || r.province || '',
                    String(r.priority_score||0)])
    })
    var priTable = body.appendTable(priRows)
    priTable.getRow(0).editAsText().setBold(true)
  }

  if (ai.recommendations && ai.recommendations.length) {
    body.appendParagraph('Recommended Actions').setHeading(DocumentApp.ParagraphHeading.HEADING2)
    ai.recommendations.forEach(function(a) { body.appendListItem(a).setGlyphType(DocumentApp.GlyphType.NUMBER) })
  }

  body.appendHorizontalRule()
  body.appendParagraph('Generated by NagarikAwaz v3.0 | ' + CFG().SITE_URL)
    .setItalic(true).setFontSize(9).setAlignment(DocumentApp.HorizontalAlignment.CENTER)
}

// =============================================================================
// SECTION 18 — EMERGENCY / DISASTER MODE
// =============================================================================

function activateEmergencyMode(p, auth) {
  authorize(auth.token, 'activateEmergencyMode')
  PROPS.setProperty('EMERGENCY_MODE',   'true')
  PROPS.setProperty('EMERGENCY_REASON', sanitize(p.reason || 'Activated by admin'))
  PROPS.setProperty('EMERGENCY_AT',     new Date().toISOString())

  var sysF = driveFolder(CFG().ROOT_ID, '_system')
  driveWriteJSON(sysF.getId(), 'emergency_mode.json', {
    active: true, reason: p.reason, activated_by: auth.user_id, activated_at: new Date().toISOString(),
  })
  if (CFG().ADMIN_EMAIL) {
    sendEmail(CFG().ADMIN_EMAIL, 'EMERGENCY MODE ACTIVATED',
      'Reason: ' + p.reason + '\nDashboard: ' + CFG().SITE_URL + '/admin/emergency')
  }
  auditLog(auth.user_id, 'activateEmergencyMode', 'system', 'ok', { reason: p.reason })
  return { ok: true, mode: 'emergency', activated_at: new Date().toISOString() }
}

function deactivateEmergencyMode(auth) {
  authorize(auth.token, 'activateEmergencyMode')
  PROPS.setProperty('EMERGENCY_MODE', 'false')
  var sysF = driveFolder(CFG().ROOT_ID, '_system')
  driveWriteJSON(sysF.getId(), 'emergency_mode.json', {
    active: false, deactivated_by: auth.user_id, deactivated_at: new Date().toISOString(),
  })
  auditLog(auth.user_id, 'deactivateEmergencyMode', 'system', 'ok', {})
  return { ok: true, mode: 'normal' }
}

function getEmergencyDashboard() {
  var critical = idxRead(IDX.REPORTS)
    .filter(function(r) { return r.severity === 'critical' && !['samaadhaan','banda'].includes(r.status) })
    .sort(function(a, b) { return (Number(b.priority_score)||0) - (Number(a.priority_score)||0) })

  return {
    emergency_mode: PROPS.getProperty('EMERGENCY_MODE') === 'true',
    reason:         PROPS.getProperty('EMERGENCY_REASON') || '',
    activated_at:   PROPS.getProperty('EMERGENCY_AT')     || '',
    critical_count: critical.length,
    top_incidents:  critical.slice(0, 20),
  }
}

function emergencyBroadcast(p, auth) {
  authorize(auth.token, 'emergencyBroadcast')
  var users = idxRead(IDX.USERS)
    .filter(function(u) { return p.province ? u.province === p.province : true })

  var sent = 0
  users.forEach(function(u) {
    if (u.email) { sendEmail(u.email, p.subject || 'Emergency Alert', p.message || ''); sent++ }
  })
  auditLog(auth.user_id, 'emergencyBroadcast', 'users', 'ok', { sent: sent, province: p.province })
  return { ok: true, sent: sent }
}

// =============================================================================
// SECTION 19 — AUDIT LOGGING
// =============================================================================

function auditLog(userId, action, resourceId, result, meta) {
  try {
    var row = {
      timestamp:   new Date().toISOString(),
      user_id:     String(userId || 'system'),
      action:      action,
      resource_id: String(resourceId),
      result:      result,
      meta:        JSON.stringify(meta || {}),
    }
    idxAppend(IDX.AUDIT, row)

    // For destructive actions, also persist to Drive
    var critical = ['deleteReport','updateUserRole','activateEmergencyMode','emergencyBroadcast','resetAllSheets']
    if (critical.indexOf(action) >= 0) {
      var auditRoot = driveFolder(CFG().ROOT_ID, '_audit')
      var dateStr   = Utilities.formatDate(new Date(), 'Asia/Kathmandu', 'yyyy/MM/dd').split('/')
      var dayF      = driveFolder(driveFolder(driveFolder(auditRoot.getId(), dateStr[0]).getId(), dateStr[1]).getId(), dateStr[2])
      driveAppendEvent(dayF.getId(), '.', 'audit', row)
    }
  } catch (e) { Logger.log('Audit log failed: ' + e.message) }
}

function getAuditTrail(resourceId) {
  return idxRead(IDX.AUDIT)
    .filter(function(r) { return !resourceId || r.resource_id === String(resourceId) })
    .sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp) })
    .slice(0, 100)
}

// =============================================================================
// SECTION 20 — HELPERS & UTILITIES
// =============================================================================

function calcPriority(r) {
  var sev = { critical: 40, high: 30, medium: 20, low: 10 }
  var cat = { road: 12, water: 12, landslide: 14, bridge: 10, drainage: 10, electricity: 8, waste: 5, health: 8, other: 3 }
  var s   = (sev[r.severity] || 20) + (cat[r.category] || 5)
  s += Math.min(20, parseInt(r.upvotes || 0) * 2)
  s += Math.min(10, parseInt(r.comments_count || 0) * 2)
  if (r.is_emergency) s += 25
  if (r.escalated)    s += 20
  return Math.min(100, s)
}

function createReportDoc(summary, scope, count) {
  var folder = driveFolder(CFG().ROOT_ID, '_ai_reports')
  var title  = 'NagarikAwaz AI Report — ' + scope + ' — ' + Utilities.formatDate(new Date(), 'Asia/Kathmandu', 'yyyy-MM-dd')
  var doc    = DocumentApp.create(title)
  var body   = doc.getBody()

  body.appendParagraph('नागरिक आवाज | NagarikAwaz — AI Infrastructure Report').setHeading(DocumentApp.ParagraphHeading.HEADING1)
  body.appendParagraph('Scope: ' + scope + '  |  Reports: ' + count).setItalic(true)
  body.appendHorizontalRule()

  if (summary.executive_summary) {
    body.appendParagraph('Executive Summary / कार्यकारी सारांश').setHeading(DocumentApp.ParagraphHeading.HEADING2)
    body.appendParagraph(summary.executive_summary)
  }
  if (summary.priorities && summary.priorities.length) {
    body.appendParagraph('Priority Actions').setHeading(DocumentApp.ParagraphHeading.HEADING2)
    summary.priorities.forEach(function(p, i) {
      body.appendParagraph((i+1) + '. ' + p.title + ' [Score: ' + p.score + '] — ' + p.location)
      if (p.reason) body.appendParagraph('   → ' + p.reason).setItalic(true)
    })
  }
  if (summary.seasonal_risk) {
    body.appendParagraph('Seasonal Risk').setHeading(DocumentApp.ParagraphHeading.HEADING2)
    body.appendParagraph(summary.seasonal_risk)
  }
  if (summary.budget_recommendations) {
    body.appendParagraph('Budget (NPR)').setHeading(DocumentApp.ParagraphHeading.HEADING2)
    body.appendParagraph(summary.budget_recommendations)
  }
  if (summary.recommended_actions && summary.recommended_actions.length) {
    body.appendParagraph('Recommended Actions').setHeading(DocumentApp.ParagraphHeading.HEADING2)
    summary.recommended_actions.forEach(function(a) { body.appendListItem(a) })
  }

  doc.saveAndClose()
  var file = DriveApp.getFileById(doc.getId())
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
  folder.addFile(file)
  try { DriveApp.getRootFolder().removeFile(file) } catch (e) {}
  return 'https://docs.google.com/document/d/' + doc.getId() + '/edit'
}

function sanitize(s) {
  return String(s || '').replace(/[<>'"]/g, function(c) {
    return { '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]
  }).slice(0, 2000)
}

function sanitizePath(s) {
  return String(s || 'unknown').replace(/[^a-zA-Z0-9ऀ-ॿ _-]/g, '').trim().substr(0, 60) || 'unknown'
}

function uuid() { return Utilities.getUuid().replace(/-/g, '').substr(0, 16) }

function json(data) {
  var out = ContentService.createTextOutput(JSON.stringify(data))
  out.setMimeType(ContentService.MimeType.JSON)
  return out
}

// =============================================================================
// SECTION 21 — API ROUTING
// =============================================================================

function doPost(e) {
  var p = {}
  try { p = JSON.parse(e.postData.contents) } catch (err) { return json({ error: 'Invalid JSON body' }) }

  var action = p.action || ''
  var auth   = extractAuth(p)
  var ip     = (e && e.parameter && e.parameter.ip) ? e.parameter.ip : 'unknown'

  try {
    rateLimit(ip, action, 20)

    switch (action) {
      // Auth
      case 'login':                  return json(loginWithGoogle(p))
      case 'logout':                 return json(logout(p))
      // Reports
      case 'createReport':           return json(createReport(p, auth))
      case 'updateReport':           return json(updateReport(p, auth))
      case 'uploadPhoto':            return json(uploadPhoto(p, auth))
      // Social
      case 'addComment':             return json(addComment(p, auth))
      case 'addProgress':            return json(addProgress(p, auth))
      // Users
      case 'upsertUser':             return json(upsertUser(p))
      case 'updateUserRole':         return json(updateUserRole(p, auth))
      // AI
      case 'generateAIReport':       return json(generateAIReport(p, auth))
      // Emergency
      case 'activateEmergencyMode':  return json(activateEmergencyMode(p, auth))
      case 'deactivateEmergencyMode':return json(deactivateEmergencyMode(auth))
      case 'emergencyBroadcast':     return json(emergencyBroadcast(p, auth))
      // Admin config
      case 'updateAppConfig':        return json(updateAppConfig(p, auth))
      default:                       return json({ error: 'Unknown POST action: ' + action })
    }
  } catch (err) {
    Logger.log('ERROR [POST/' + action + ']: ' + err.message + '\n' + (err.stack || ''))
    var code = err.message && (err.message.indexOf('FORBIDDEN') === 0 ? 403 : err.message.indexOf('AUTH') === 0 ? 401 : 500)
    return json({ error: String(err.message || err), code: code || 500 })
  }
}

function doGet(e) {
  var p      = (e && e.parameter) ? e.parameter : {}
  var action = p.action || 'ping'
  var auth   = extractAuth(p)
  var ip     = p.ip || 'unknown'

  try {
    rateLimit(ip, action, 60)

    var result
    switch (action) {
      // Public reads — no auth required
      case 'getReports':              result = getReports(p);                   break
      case 'getReport':               result = getReport(p.id);                 break
      case 'getNearbyReports':        result = getNearbyReports(p);             break
      case 'getComments':             result = getComments(p.reportId);         break
      case 'getProgress':             result = getProgress(p.reportId);         break
      case 'getDashboardStats':       result = getDashboardStats(p);            break
      case 'getHeatmap':              result = getHeatmapData(p);               break
      case 'getRiskZones':            result = getRiskZones(p);                 break
      case 'getVulnerabilityScore':   result = getVulnerabilityScore(p.palika); break
      case 'getWeeklyReports':        result = getWeeklyReports();              break
      case 'listAIReports':           result = listAIReports();                 break
      case 'getEmergencyDashboard':   result = getEmergencyDashboard();         break
      // Public reads — no auth required
      case 'getCitizenView':          result = getCitizenView(p);               break
      case 'getAppConfig':            result = getAppConfig();                  break
      // Auth required
      case 'upvoteReport':            result = upvoteReport(p, auth);           break
      case 'getUser':                 result = getUser(p.id);                   break
      case 'getUsers':                authorize(auth.token, 'getUsers'); result = getUsers(); break
      case 'deleteReport':            result = deleteReport(p.id, auth);        break
      case 'prioritizeReport':        result = prioritizeReport(p.id, auth);    break
      case 'triggerWeeklyReport':     result = generateWeeklyReport();          break
      case 'getAuditTrail':           result = getAuditTrail(p.resourceId);     break
      case 'getAdminView':            result = getAdminView(p, auth);           break
      case 'ping':
        result = { ok: true, ts: new Date().toISOString(), version: CFG().VERSION, emergency: PROPS.getProperty('EMERGENCY_MODE') === 'true' }
        break
      default:
        result = { error: 'Unknown action: ' + action }
    }
    return json(result)
  } catch (err) {
    Logger.log('ERROR [GET/' + action + ']: ' + err.message)
    var code = err.message && (err.message.indexOf('FORBIDDEN') === 0 ? 403 : err.message.indexOf('AUTH') === 0 ? 401 : 500)
    return json({ error: String(err.message || err), code: code || 500 })
  }
}

// Rate limiter using CacheService (per IP + action, 1-minute window)
function rateLimit(ip, action, maxPerMinute) {
  var key   = ck('rl', ip, action)
  var count = parseInt(cacheGet(key) || '0')
  if (count >= (maxPerMinute || 30)) throw new Error('RATE_LIMITED: slow down')
  cacheSet(key, String(count + 1), 60)
}

// =============================================================================
// SECTION 22 — SETUP, MIGRATION & TRIGGERS
// =============================================================================

// Run ONCE after first deploy to create Drive structure + index sheets
function setupSystem() {
  var cfg = CFG()
  if (!cfg.ROOT_ID) throw new Error('Set DRIVE_ROOT_FOLDER_ID in Script Properties first')
  if (!cfg.SS_ID)   throw new Error('Set SPREADSHEET_ID in Script Properties first')

  var root = DriveApp.getFolderById(cfg.ROOT_ID)
  ;['reports','users','_system','_analytics','_ai_reports','_weekly_reports','_audit','_uploads_temp']
    .forEach(function(d) {
      var it = root.getFoldersByName(d)
      if (!it.hasNext()) { root.createFolder(d); Logger.log('Created folder: ' + d) }
      else Logger.log('Folder exists: ' + d)
    })

  var sysF = driveFolder(cfg.ROOT_ID, '_system')
  driveWriteJSON(sysF.getId(), 'config.json', { version: cfg.VERSION, initialized_at: new Date().toISOString() })

  Object.keys(IDX).forEach(function(k) { getIdxSheet(IDX[k]); Logger.log('Sheet ready: ' + IDX[k]) })

  Logger.log('Setup complete. Next: run setupTriggers()')
}

// Create all time-based triggers
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t) })

  ScriptApp.newTrigger('generateWeeklyReport')
    .timeBased().everyWeeks(1).onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(17)
    .inTimezone('Asia/Kathmandu').create()

  ScriptApp.newTrigger('checkSLABreaches')
    .timeBased().everyHours(6).create()

  ScriptApp.newTrigger('aggregateDailyStats')
    .timeBased().everyDays(1).atHour(0).inTimezone('Asia/Kathmandu').create()

  ScriptApp.newTrigger('cleanExpiredSessions')
    .timeBased().everyHours(2).create()

  Logger.log('Triggers installed: weeklyReport, slaBreaches, dailyStats, sessionCleanup')
}

// Update weekly report trigger schedule from frontend settings
function updateWeeklySchedule(p) {
  var dayMap = {
    SUNDAY: ScriptApp.WeekDay.SUNDAY, MONDAY: ScriptApp.WeekDay.MONDAY,
    TUESDAY: ScriptApp.WeekDay.TUESDAY, WEDNESDAY: ScriptApp.WeekDay.WEDNESDAY,
    THURSDAY: ScriptApp.WeekDay.THURSDAY, FRIDAY: ScriptApp.WeekDay.FRIDAY,
    SATURDAY: ScriptApp.WeekDay.SATURDAY,
  }
  var weekDay = dayMap[String(p.day || '').toUpperCase()] || ScriptApp.WeekDay.SUNDAY
  var hour    = Math.max(0, Math.min(23, parseInt(p.hour || 17)))

  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'generateWeeklyReport') ScriptApp.deleteTrigger(t)
  })
  ScriptApp.newTrigger('generateWeeklyReport')
    .timeBased().everyWeeks(1).onWeekDay(weekDay).atHour(hour)
    .inTimezone('Asia/Kathmandu').create()

  return { ok: true, day: p.day, hour: hour }
}

// Migrate existing data from old Sheets-heavy system to Drive-first
function migrateFromSheets() {
  var lock = LockService.getScriptLock()
  if (!lock.tryLock(30000)) { Logger.log('Could not acquire lock'); return }

  try {
    var ss       = SpreadsheetApp.openById(CFG().SS_ID)
    var oldSheet = ss.getSheetByName('Reports')   // old sheet name from v2
    if (!oldSheet) { Logger.log('No legacy "Reports" sheet found — nothing to migrate'); return }

    var data    = oldSheet.getDataRange().getValues()
    var headers = data[0].map(function(h) { return String(h).trim() })
    var migrated = 0; var skipped = 0; var errors = 0

    data.slice(1).forEach(function(row) {
      var r = {}
      headers.forEach(function(h, i) { r[h] = row[i] != null ? String(row[i]).trim() : '' })
      if (!r.id) return

      // Skip if already migrated
      if (idxFind(IDX.REPORTS, 'id', r.id)) { skipped++; return }

      try {
        var folder = getOrCreateReportFolder(r.province, r.district, r.palika, r.id)
        var report = {
          id: r.id, version: 1,
          title_np: r.title_np||'', title_en: r.title_en||'',
          description_np: r.description_np||'', description_en: r.description_en||'',
          category: r.category||'other', severity: r.severity||'medium',
          lat: parseFloat(r.lat)||null, lng: parseFloat(r.lng)||null,
          province: r.province||'', district: r.district||'', palika: r.palika||'',
          palika_type: r.palika_type||'gaunpalika', ward_no: r.ward_no||'',
          address_np: r.address_np||'', address_en: r.address_en||'',
          status: r.status||'darta', priority_score: parseInt(r.priority_score||50),
          department: r.department||'', assigned_officer: '',
          submitted_by: r.submitted_by||'', submitter_phone: r.submitter_phone||'',
          photo_ids: r.photo_ids ? r.photo_ids.split(',').map(function(s){return s.trim()}).filter(Boolean) : [],
          upvotes: parseInt(r.upvotes||0), upvoters: [], comments_count: parseInt(r.comments_count||0),
          sla_deadline: calculateSLADeadline(r.severity||'medium', r.created_at||new Date().toISOString()),
          escalated: false, is_emergency: false, ai_tags: [],
          created_at: r.created_at||new Date().toISOString(),
          updated_at: r.updated_at||r.created_at||new Date().toISOString(),
          resolved_at: r.resolved_at||null,
          _migrated_from: 'sheets_v2',
        }

        var jsonFile = driveWriteJSON(folder.getId(), 'report.json', report)
        idxAppend(IDX.REPORTS, {
          id: r.id, folder_id: folder.getId(), json_file_id: jsonFile.getId(),
          province: r.province||'', district: r.district||'', palika: r.palika||'',
          ward_no: r.ward_no||'', category: r.category||'other', severity: r.severity||'medium',
          status: r.status||'darta', priority_score: report.priority_score,
          lat: report.lat||'', lng: report.lng||'',
          submitted_by: r.submitted_by||'',
          created_at: report.created_at, updated_at: report.updated_at,
        })
        migrated++
        if (migrated % 10 === 0) Logger.log('Progress: migrated ' + migrated)
        Utilities.sleep(150)   // respect Drive API rate limits
      } catch (e) {
        Logger.log('Migration error [' + r.id + ']: ' + e.message)
        errors++
      }
    })

    Logger.log('Migration complete — migrated: ' + migrated + ', skipped: ' + skipped + ', errors: ' + errors)
    auditLog('system', 'migration', 'all', 'ok', { migrated: migrated, skipped: skipped, errors: errors })
  } finally {
    lock.releaseLock()
  }
}

function testPing() {
  Logger.log(JSON.stringify({ ok: true, version: CFG().VERSION, ts: new Date().toISOString() }))
}

// One-time: authorize Drive access for the web app deployment
function authorizeDrive() {
  var folder = driveFolder(CFG().ROOT_ID, '_system')
  Logger.log('Drive authorized. System folder: ' + folder.getId())
}
