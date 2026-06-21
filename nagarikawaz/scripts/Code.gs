// ============================================================================
// NagarikAwaz — Google Apps Script Backend
// Roles: citizen < admin < developer
//
// Required Script Properties:
//   SPREADSHEET_ID     — Google Sheet ID
//   SUPABASE_URL       — e.g. https://xxx.supabase.co
//   SUPABASE_ANON_KEY  — Supabase anon key
// Optional:
//   DRIVE_FOLDER_ID    — Drive folder for photo uploads
//
// Setup (run in order):
//   1. Set Script Properties above
//   2. Run setup() — creates/resets all sheets with correct headers
//   3. Deploy as Web App → Execute as: Me, Access: Anyone
//      (after any code change: Deploy → Manage deployments → Edit → New version → Deploy)
// ============================================================================

var PROPS = PropertiesService.getScriptProperties()
var CACHE = CacheService.getScriptCache()

function CFG() {
  return {
    SS_ID:    PROPS.getProperty('SPREADSHEET_ID')    || '',
    SB_URL:   PROPS.getProperty('SUPABASE_URL')      || '',
    SB_KEY:   PROPS.getProperty('SUPABASE_ANON_KEY') || '',
    DRIVE_ID: PROPS.getProperty('DRIVE_FOLDER_ID')   || '',
  }
}

// ── Sheet column definitions ───────────────────────────────────────────────────
// These are the ONLY columns that will be written. If your sheet has old columns
// from a previous version, run setup() to reset them.

var HEADERS = {
  reports:  ['id','title','description','category','status','severity',
             'lat','lng','province','district','palika','ward_no','address',
             'submitted_by','assigned_to','upvotes','upvoters','photo_ids',
             'created_at','updated_at','resolved_at'],
  users:    ['id','supabase_uid','email','name','phone','role','avatar_url',
             'province','district','palika','ward_no','created_at'],
  comments: ['id','report_id','user_id','user_name','text','created_at'],
  progress: ['id','report_id','officer_id','officer_name','status','note','created_at'],
}

// ── Sheet engine ──────────────────────────────────────────────────────────────

function getSheet(name) {
  var ss = SpreadsheetApp.openById(CFG().SS_ID)
  var sh = ss.getSheetByName(name)
  if (!sh) {
    sh = ss.insertSheet(name)
    var h = HEADERS[name]
    if (h) sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold')
    Logger.log('Created sheet: ' + name)
  }
  return sh
}

function shRead(name) {
  var sh   = getSheet(name)
  var data = sh.getDataRange().getValues()
  if (data.length < 2) return []
  var hdrs = data[0].map(function(h) { return String(h).trim() })
  return data.slice(1).map(function(row) {
    var obj = {}
    hdrs.forEach(function(h, i) {
      obj[h] = (row[i] !== null && row[i] !== undefined) ? String(row[i]).trim() : ''
    })
    return obj
  }).filter(function(r) {
    return Object.keys(r).some(function(k) { return r[k] !== '' })
  })
}

// Appends a row using the sheet's ACTUAL header row (not the code constant).
// This means it works correctly regardless of column order in the sheet.
function shAppend(name, obj) {
  var sh   = getSheet(name)
  var data = sh.getDataRange().getValues()
  // Read headers from the sheet itself so column order always matches
  var hdrs = data.length > 0
    ? data[0].map(function(h) { return String(h).trim() })
    : HEADERS[name]
  var row = hdrs.map(function(h) { return obj[h] !== undefined ? obj[h] : '' })
  sh.appendRow(row)
  Logger.log('shAppend [' + name + ']: ' + JSON.stringify(obj).substr(0, 200))
}

function shUpdate(name, field, value, updates) {
  var sh   = getSheet(name)
  var data = sh.getDataRange().getValues()
  var hdrs = data[0].map(function(h) { return String(h).trim() })
  var col  = hdrs.indexOf(field)
  if (col < 0) return false
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][col]).trim() === String(value).trim()) {
      Object.keys(updates).forEach(function(k) {
        var c = hdrs.indexOf(k)
        if (c >= 0) sh.getRange(i + 1, c + 1).setValue(updates[k])
      })
      return true
    }
  }
  return false
}

function shFind(name, field, value) {
  return shRead(name).find(function(r) {
    return String(r[field]).trim() === String(value).trim()
  }) || null
}

function shDelete(name, field, value) {
  var sh   = getSheet(name)
  var data = sh.getDataRange().getValues()
  var hdrs = data[0].map(function(h) { return String(h).trim() })
  var col  = hdrs.indexOf(field)
  if (col < 0) return false
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][col]).trim() === String(value).trim()) {
      sh.deleteRow(i + 1)
      return true
    }
  }
  return false
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function uuid()  { return Utilities.getUuid().replace(/-/g, '').substr(0, 16) }
function now()   { return new Date().toISOString() }
function json(d) { return ContentService.createTextOutput(JSON.stringify(d)).setMimeType(ContentService.MimeType.JSON) }

function sanitize(s) {
  return String(s || '').replace(/[<>'"&]/g, function(c) {
    return { '<':'&lt;', '>':'&gt;', "'":"&#39;", '"':'&quot;', '&':'&amp;' }[c]
  }).slice(0, 2000)
}

function cGet(k)       { var v = CACHE.get(k); return v ? JSON.parse(v) : null }
function cSet(k, v, t) { try { var s = JSON.stringify(v); if (s.length < 95000) CACHE.put(k, s, t || 300) } catch(e) {} }
function cDel(k)       { CACHE.remove(k) }

// ── Auth ──────────────────────────────────────────────────────────────────────

var CITIZEN_ACTIONS = [
  'ping','getReports','getReport','getNearbyReports','getDashboardStats',
  'getComments','getProgress','getUser','upsertUser',
  'createReport','upvoteReport','addComment','uploadPhoto',
  'updateUser',  // citizen can update own profile; server checks ownership
]

function verifyToken(token) {
  if (!token) return null
  var cfg  = CFG()
  if (!cfg.SB_URL) { Logger.log('verifyToken: SUPABASE_URL not set'); return null }
  var ckey = 'sb:' + token.substr(-20)
  var hit  = cGet(ckey)
  if (hit) return hit
  try {
    var res = UrlFetchApp.fetch(cfg.SB_URL + '/auth/v1/user', {
      headers: { 'Authorization': 'Bearer ' + token, 'apikey': cfg.SB_KEY },
      muteHttpExceptions: true,
    })
    var code = res.getResponseCode()
    if (code !== 200) { Logger.log('verifyToken: Supabase returned ' + code); return null }
    var u = JSON.parse(res.getContentText())
    if (!u.id) return null
    var result = { supabase_uid: u.id, email: u.email || '' }
    cSet(ckey, result, 300)
    return result
  } catch(e) { Logger.log('verifyToken error: ' + e.message); return null }
}

function resolveUser(token) {
  if (!token) throw new Error('AUTH_REQUIRED')
  var ckey = 'resolved:' + token.substr(-20)
  var hit  = cGet(ckey)
  if (hit) return hit
  var sb = verifyToken(token)
  if (!sb) throw new Error('SESSION_INVALID')
  var user = upsertUser({ supabase_uid: sb.supabase_uid, email: sb.email })
  cSet(ckey, user, 300)
  return user
}

function authorize(token, action) {
  var user = resolveUser(token)
  var role = user.role || 'citizen'
  if (role === 'developer' || role === 'admin') return user
  if (CITIZEN_ACTIONS.indexOf(action) < 0) throw new Error('FORBIDDEN: ' + role + ' cannot ' + action)
  return user
}

// ── Users ─────────────────────────────────────────────────────────────────────

function upsertUser(p) {
  Logger.log('upsertUser: uid=' + (p.supabase_uid || '') + ' email=' + (p.email || ''))
  var row = (p.supabase_uid ? shFind('users', 'supabase_uid', p.supabase_uid) : null)
          || (p.email       ? shFind('users', 'email',        p.email)        : null)

  if (row) {
    var updates = {}
    if (!row.supabase_uid && p.supabase_uid) updates.supabase_uid = p.supabase_uid
    if (p.name)       updates.name       = sanitize(p.name)
    if (p.phone)      updates.phone      = sanitize(p.phone)
    if (p.avatar_url) updates.avatar_url = sanitize(p.avatar_url)
    if (p.province)   updates.province   = sanitize(p.province)
    if (p.district)   updates.district   = sanitize(p.district)
    if (p.palika)     updates.palika     = sanitize(p.palika)
    if (p.ward_no)    updates.ward_no    = sanitize(p.ward_no)
    if (Object.keys(updates).length) {
      shUpdate('users', 'id', row.id, updates)
      Object.keys(updates).forEach(function(k) { row[k] = updates[k] })
    }
    Logger.log('upsertUser: found existing user id=' + row.id)
    cSet('u:' + row.id, row, 600)
    return row
  }

  var user = {
    id:           uuid(),
    supabase_uid: sanitize(p.supabase_uid || ''),
    email:        sanitize(p.email        || ''),
    name:         sanitize(p.name         || ''),
    phone:        sanitize(p.phone        || ''),
    role:         'citizen',
    avatar_url:   sanitize(p.avatar_url   || ''),
    province:     sanitize(p.province     || ''),
    district:     sanitize(p.district     || ''),
    palika:       sanitize(p.palika       || ''),
    ward_no:      sanitize(p.ward_no      || ''),
    created_at:   now(),
  }
  shAppend('users', user)
  Logger.log('upsertUser: created new user id=' + user.id)
  cSet('u:' + user.id, user, 600)
  return user
}

function getUser(id) {
  if (!id) return null
  var c = cGet('u:' + id)
  if (c) return c
  var r = shFind('users', 'id', id)
  if (r) cSet('u:' + id, r, 600)
  return r
}

function getUsers() {
  return shRead('users')
}

function updateUserRole(p, token) {
  authorize(token, 'updateUserRole')
  var valid = ['citizen', 'admin', 'developer']
  if (valid.indexOf(p.role) < 0) throw new Error('Invalid role. Must be: citizen, admin, or developer')
  if (!shFind('users', 'id', p.id)) throw new Error('User not found')
  shUpdate('users', 'id', p.id, { role: p.role })
  cDel('u:' + p.id)
  Logger.log('updateUserRole: id=' + p.id + ' role=' + p.role)
  return { ok: true, id: p.id, role: p.role }
}

// Comprehensive user update — admin/developer only
function updateUser(p, token) {
  authorize(token, 'updateUser')
  if (!shFind('users', 'id', p.id)) throw new Error('User not found')
  var updates = {}
  ;['name','phone','avatar_url','role','province','district','palika','ward_no'].forEach(function(k) {
    if (p[k] !== undefined) {
      if (k === 'role') {
        var valid = ['citizen','admin','developer']
        if (valid.indexOf(p[k]) >= 0) updates[k] = p[k]
      } else {
        updates[k] = sanitize(String(p[k]))
      }
    }
  })
  if (Object.keys(updates).length) shUpdate('users', 'id', p.id, updates)
  cDel('u:' + p.id)
  Logger.log('updateUser: id=' + p.id + ' fields=' + Object.keys(updates).join(','))
  return { ok: true, id: p.id }
}

// Developer only — create a user record manually
function createUser(p, token) {
  var auth = authorize(token, 'createUser')
  if (auth.role !== 'developer') throw new Error('FORBIDDEN: only developer can create users')
  if (!p.email) throw new Error('email required')
  if (shFind('users', 'email', p.email)) throw new Error('User with this email already exists')
  var validRoles = ['citizen','admin','developer']
  var user = {
    id:           uuid(),
    supabase_uid: sanitize(p.supabase_uid || ''),
    email:        sanitize(p.email),
    name:         sanitize(p.name         || ''),
    phone:        sanitize(p.phone        || ''),
    role:         validRoles.indexOf(p.role) >= 0 ? p.role : 'citizen',
    avatar_url:   '',
    province:     sanitize(p.province     || ''),
    district:     sanitize(p.district     || ''),
    palika:       sanitize(p.palika       || ''),
    ward_no:      sanitize(p.ward_no      || ''),
    created_at:   now(),
  }
  shAppend('users', user)
  Logger.log('createUser: id=' + user.id + ' email=' + user.email)
  return user
}

// Developer only — permanently delete a user record
function deleteUser(p, token) {
  var auth = authorize(token, 'deleteUser')
  if (auth.role !== 'developer') throw new Error('FORBIDDEN: only developer can delete users')
  if (auth.id === p.id) throw new Error('Cannot delete your own account')
  if (!shFind('users', 'id', p.id)) throw new Error('User not found')
  shDelete('users', 'id', p.id)
  cDel('u:' + p.id)
  Logger.log('deleteUser: id=' + p.id)
  return { ok: true }
}

// ── Reports ───────────────────────────────────────────────────────────────────

function parseReport(r) {
  return Object.assign({}, r, {
    upvotes:   parseInt(r.upvotes) || 0,
    lat:       r.lat ? parseFloat(r.lat) : null,
    lng:       r.lng ? parseFloat(r.lng) : null,
    upvoters:  r.upvoters  ? r.upvoters.split(',').filter(Boolean)  : [],
    photo_ids: r.photo_ids ? r.photo_ids.split(',').filter(Boolean) : [],
  })
}

function createReport(p, token) {
  Logger.log('createReport: action called')
  var submittedBy = 'anonymous'
  if (token) {
    try { submittedBy = resolveUser(token).id }
    catch(e) { Logger.log('createReport: token resolve failed — ' + e.message) }
  }

  var id = uuid(), ts = now()
  var report = {
    id:           id,
    title:        sanitize(p.title        || p.title_en    || p.title_np    || ''),
    description:  sanitize(p.description  || p.description_en || p.description_np || ''),
    category:     sanitize(p.category     || 'other'),
    status:       'open',
    severity:     sanitize(p.severity     || 'medium'),
    lat:          parseFloat(p.lat) || '',
    lng:          parseFloat(p.lng) || '',
    province:     sanitize(p.province     || ''),
    district:     sanitize(p.district     || ''),
    palika:       sanitize(p.palika       || ''),
    ward_no:      sanitize(p.ward_no      || ''),
    address:      sanitize(p.address      || p.address_en  || p.address_np  || ''),
    submitted_by: submittedBy,
    assigned_to:  '',
    upvotes:      0,
    upvoters:     '',
    photo_ids:    Array.isArray(p.photo_ids) ? p.photo_ids.join(',') : (p.photo_ids || ''),
    created_at:   ts,
    updated_at:   ts,
    resolved_at:  '',
  }

  shAppend('reports', report)
  Logger.log('createReport: saved id=' + id + ' title=' + report.title)
  return { id: id, status: 'open', created_at: ts }
}

function getReport(id) {
  if (!id) throw new Error('id required')
  var c = cGet('r:' + id)
  if (c) return c
  var r = shFind('reports', 'id', id)
  if (!r) throw new Error('Report not found: ' + id)
  var parsed = parseReport(r)
  cSet('r:' + id, parsed, 120)
  return parsed
}

function getReports(p) {
  var rows = shRead('reports')
  if (p.province)     rows = rows.filter(function(r) { return r.province     === p.province     })
  if (p.district)     rows = rows.filter(function(r) { return r.district     === p.district     })
  if (p.palika)       rows = rows.filter(function(r) { return r.palika       === p.palika       })
  if (p.category)     rows = rows.filter(function(r) { return r.category     === p.category     })
  if (p.severity)     rows = rows.filter(function(r) { return r.severity     === p.severity     })
  if (p.status)       rows = rows.filter(function(r) { return r.status       === p.status       })
  if (p.submitted_by) rows = rows.filter(function(r) { return r.submitted_by === p.submitted_by })
  rows.sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at) })
  var limit = Math.min(parseInt(p.limit || '50'), 200)
  var page  = Math.max(0, parseInt(p.page || '1') - 1)
  return {
    reports: rows.slice(page * limit, page * limit + limit).map(parseReport),
    total:   rows.length,
    page:    page + 1,
    limit:   limit,
  }
}

function updateReport(p, token) {
  authorize(token, 'updateReport')
  var row = shFind('reports', 'id', p.id)
  if (!row) throw new Error('Report not found')
  var updates = { updated_at: now() }
  ;['title','description','category','severity','status','assigned_to','address','photo_ids',
    'province','district','palika','ward_no','lat','lng'].forEach(function(k) {
    if (p[k] !== undefined) updates[k] = sanitize(String(p[k]))
  })
  if ((p.status === 'resolved' || p.status === 'closed') && !row.resolved_at) {
    updates.resolved_at = now()
  }
  shUpdate('reports', 'id', p.id, updates)
  cDel('r:' + p.id)
  return { ok: true, id: p.id }
}

function deleteReport(id, token) {
  authorize(token, 'deleteReport')
  shDelete('reports', 'id', id)
  cDel('r:' + id)
  return { ok: true }
}

function upvoteReport(p, token) {
  var userId = 'anon'
  if (token) { try { userId = resolveUser(token).id } catch(e) {} }
  var row = shFind('reports', 'id', p.id)
  if (!row) throw new Error('Report not found')
  var upvoters = row.upvoters ? row.upvoters.split(',').filter(Boolean) : []
  if (upvoters.indexOf(userId) >= 0) {
    return { ok: false, reason: 'already_upvoted', upvotes: parseInt(row.upvotes) || 0 }
  }
  upvoters.push(userId)
  var newCount = (parseInt(row.upvotes) || 0) + 1
  shUpdate('reports', 'id', p.id, { upvotes: newCount, upvoters: upvoters.join(','), updated_at: now() })
  cDel('r:' + p.id)
  return { ok: true, upvotes: newCount }
}

function getNearbyReports(p) {
  if (!p.lat || !p.lng) return []
  var lat = parseFloat(p.lat), lng = parseFloat(p.lng)
  var rad = parseFloat(p.radius || '2000')
  function dist(la, lo) {
    var R = 6371000, p1 = lat*Math.PI/180, p2 = la*Math.PI/180
    var dp = (la-lat)*Math.PI/180, dl = (lo-lng)*Math.PI/180
    var a  = Math.sin(dp/2)*Math.sin(dp/2) + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)*Math.sin(dl/2)
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  }
  return shRead('reports')
    .filter(function(r) { return r.lat && r.lng && dist(parseFloat(r.lat), parseFloat(r.lng)) <= rad })
    .map(parseReport).slice(0, 20)
}

// ── Comments & Progress ───────────────────────────────────────────────────────

function addComment(p, token) {
  if (!p.reportId) throw new Error('reportId required')
  var userId = 'anonymous', userName = ''
  if (token) { try { var u = resolveUser(token); userId = u.id; userName = u.name || u.email || '' } catch(e) {} }
  var id = uuid(), ts = now()
  shAppend('comments', {
    id:         id,
    report_id:  p.reportId,
    user_id:    userId,
    user_name:  sanitize(p.user_name || userName),
    text:       sanitize(p.text || p.comment_en || p.comment_np || ''),
    created_at: ts,
  })
  cDel('c:' + p.reportId)
  return { id: id, created_at: ts }
}

function getComments(reportId) {
  if (!reportId) return []
  var c = cGet('c:' + reportId)
  if (c) return c
  var r = shRead('comments')
    .filter(function(x) { return x.report_id === reportId })
    .sort(function(a, b) { return new Date(a.created_at) - new Date(b.created_at) })
  cSet('c:' + reportId, r, 60)
  return r
}

function addProgress(p, token) {
  var auth = authorize(token, 'addProgress')
  if (!p.reportId) throw new Error('reportId required')
  var id = uuid(), ts = now()
  shAppend('progress', {
    id:           id,
    report_id:    p.reportId,
    officer_id:   auth.id,
    officer_name: sanitize(p.officer || auth.name || auth.email || ''),
    status:       sanitize(p.status || ''),
    note:         sanitize(p.note || p.note_en || p.note_np || ''),
    created_at:   ts,
  })
  if (p.status) {
    shUpdate('reports', 'id', p.reportId, { status: p.status, updated_at: ts })
    cDel('r:' + p.reportId)
  }
  cDel('p:' + p.reportId)
  return { id: id, created_at: ts }
}

function getProgress(reportId) {
  if (!reportId) return []
  var c = cGet('p:' + reportId)
  if (c) return c
  var r = shRead('progress')
    .filter(function(x) { return x.report_id === reportId })
    .sort(function(a, b) { return new Date(b.created_at) - new Date(a.created_at) })
  cSet('p:' + reportId, r, 60)
  return r
}

// ── Photos ────────────────────────────────────────────────────────────────────

function uploadPhoto(p, token) {
  if (!p.data || !p.fileName) throw new Error('data and fileName required')
  var cfg    = CFG()
  var folder = cfg.DRIVE_ID ? DriveApp.getFolderById(cfg.DRIVE_ID) : DriveApp.getRootFolder()
  var bytes  = Utilities.base64Decode(p.data)
  var blob   = Utilities.newBlob(bytes, p.mimeType || 'image/jpeg', sanitize(p.fileName))
  var file   = folder.createFile(blob)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
  return {
    fileId:   file.getId(),
    fileUrl:  file.getUrl(),
    thumbUrl: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w600',
  }
}

// ── Statistics ────────────────────────────────────────────────────────────────

function getDashboardStats(p) {
  var rows = shRead('reports')
  if (p.province) rows = rows.filter(function(r) { return r.province === p.province })
  if (p.palika)   rows = rows.filter(function(r) { return r.palika   === p.palika   })
  if (p.district) rows = rows.filter(function(r) { return r.district === p.district })
  var byStatus = {}, byCategory = {}, bySeverity = {}
  rows.forEach(function(r) {
    byStatus[r.status     || 'unknown'] = (byStatus[r.status     || 'unknown'] || 0) + 1
    byCategory[r.category || 'other']   = (byCategory[r.category || 'other']   || 0) + 1
    bySeverity[r.severity || 'medium']  = (bySeverity[r.severity || 'medium']  || 0) + 1
  })
  var open     = rows.filter(function(r) { return r.status !== 'resolved' && r.status !== 'closed' }).length
  var resolved = rows.filter(function(r) { return r.status === 'resolved' }).length
  return {
    total: rows.length, open: open, resolved: resolved,
    byStatus: byStatus, byCategory: byCategory, bySeverity: bySeverity,
    resolutionRate: rows.length ? Math.round(resolved / rows.length * 100) : 0,
  }
}

// ── Router ────────────────────────────────────────────────────────────────────

function doGet(e) {
  var p      = (e && e.parameter) ? e.parameter : {}
  var action = p.action || 'ping'
  var token  = p.token  || ''
  Logger.log('doGet action=' + action)

  try {
    var result
    switch (action) {
      case 'ping':             result = { ok: true, ts: now() };                               break
      case 'getReports':       result = getReports(p);                                         break
      case 'getReport':        result = getReport(p.id);                                       break
      case 'getNearbyReports': result = getNearbyReports(p);                                   break
      case 'getDashboardStats':result = getDashboardStats(p);                                  break
      case 'getComments':      result = getComments(p.reportId);                               break
      case 'getProgress':      result = getProgress(p.reportId);                               break
      case 'getUser':          result = getUser(p.id);                                         break
      case 'getUsers':         authorize(token, 'getUsers'); result = getUsers();              break
      case 'upsertUser':       result = upsertUser(p);                                         break
      case 'updateUserRole':   result = updateUserRole(p, token);                              break
      case 'updateUser':       result = updateUser(p, token);                                  break
      case 'createUser':       result = createUser(p, token);                                  break
      case 'deleteUser':       result = deleteUser(p, token);                                  break
      case 'createReport':     result = createReport(p, token);                                break
      case 'updateReport':     result = updateReport(p, token);                                break
      case 'deleteReport':     result = deleteReport(p.id, token);                             break
      case 'upvoteReport':     result = upvoteReport(p, token);                                break
      case 'addComment':       result = addComment(p, token);                                  break
      case 'addProgress':      result = addProgress(p, token);                                 break
      case 'uploadPhoto':      result = uploadPhoto(p, token);                                 break
      default:                 result = { error: 'Unknown action: ' + action }
    }
    Logger.log('doGet result: ' + JSON.stringify(result).substr(0, 200))
    return json(result)
  } catch(err) {
    var code = 500
    if (err.message === 'AUTH_REQUIRED')   code = 401
    if (err.message === 'SESSION_INVALID') code = 401
    if (err.message === 'FORBIDDEN')       code = 403
    Logger.log('doGet ERROR [' + action + ']: ' + err.message)
    return json({ error: err.message, code: code })
  }
}

// Netlify proxy (photo upload) POSTs JSON — parse and forward to doGet
function doPost(e) {
  var p = {}
  try { p = JSON.parse(e.postData.contents) } catch(err) {
    return json({ error: 'Invalid JSON body' })
  }
  Logger.log('doPost forwarding action=' + (p.action || 'none'))
  return doGet({ parameter: p })
}

// ── Setup & Diagnostics ───────────────────────────────────────────────────────

// Run this after any code change to reset sheet headers.
// WARNING: clears all existing rows in each sheet.
function setup() {
  var cfg = CFG()
  if (!cfg.SS_ID) { Logger.log('ERROR: SPREADSHEET_ID not set'); return }
  var ss = SpreadsheetApp.openById(cfg.SS_ID)
  Object.keys(HEADERS).forEach(function(name) {
    var hdrs = HEADERS[name]
    var sh   = ss.getSheetByName(name)
    if (sh) {
      sh.clearContents()
      sh.getRange(1, 1, 1, hdrs.length).setValues([hdrs]).setFontWeight('bold')
      Logger.log('RESET: "' + name + '" — ' + hdrs.join(', '))
    } else {
      sh = ss.insertSheet(name)
      sh.getRange(1, 1, 1, hdrs.length).setValues([hdrs]).setFontWeight('bold')
      Logger.log('CREATED: "' + name + '" — ' + hdrs.join(', '))
    }
  })
  Logger.log('Setup complete. Now redeploy: Deploy → Manage deployments → Edit → New version → Deploy')
}

// Run this to write a real row directly — bypasses auth and web app.
// If rows appear in the sheet after running this, the code and sheet are fine.
// If nothing appears, the SPREADSHEET_ID or sheet name is wrong.
function testCreate() {
  var ts = now()
  var id = uuid()
  shAppend('reports', {
    id: id, title: 'TEST REPORT - delete me', description: 'Written by testCreate()',
    category: 'other', status: 'open', severity: 'medium',
    lat: '', lng: '', province: '', district: '', palika: '', ward_no: '', address: '',
    submitted_by: 'test_script', assigned_to: '', upvotes: 0, upvoters: '', photo_ids: '',
    created_at: ts, updated_at: ts, resolved_at: '',
  })
  Logger.log('testCreate: wrote report id=' + id)

  var uid = uuid()
  shAppend('users', {
    id: uid, supabase_uid: 'test-uid-123', email: 'test@nagarikawaz.test',
    name: 'Test User', phone: '', role: 'citizen',
    province: '', district: '', palika: '', created_at: ts,
  })
  Logger.log('testCreate: wrote user id=' + uid)
  Logger.log('Check your Google Sheet — both rows should now be visible.')
}

// Run this ONCE from the editor to authorize UrlFetchApp (needed for token verification).
// If this prompts "Authorization required", click Allow — that grants external fetch access.
// After running, redeploy the Web App so the new scope takes effect.
function testAuth() {
  var cfg = CFG()
  if (!cfg.SB_URL || !cfg.SB_KEY) { Logger.log('ERROR: SUPABASE_URL or SUPABASE_ANON_KEY not set'); return }
  Logger.log('Testing UrlFetchApp access to Supabase...')
  try {
    var res = UrlFetchApp.fetch(cfg.SB_URL + '/auth/v1/health', {
      headers: { 'apikey': cfg.SB_KEY },
      muteHttpExceptions: true,
    })
    Logger.log('UrlFetchApp OK — Supabase responded: ' + res.getResponseCode())
    Logger.log('If you see this, token verification will work. Redeploy the Web App now.')
  } catch(e) {
    Logger.log('UrlFetchApp FAILED: ' + e.message)
    Logger.log('Grant the authorization prompt and run testAuth() again.')
  }
}

// Run to verify configuration without changing anything
function test() {
  var cfg = CFG()
  Logger.log('SPREADSHEET_ID: ' + (cfg.SS_ID    ? 'SET' : 'NOT SET — required'))
  Logger.log('SUPABASE_URL:   ' + (cfg.SB_URL   ? 'SET' : 'NOT SET — required'))
  Logger.log('SUPABASE_KEY:   ' + (cfg.SB_KEY   ? 'SET' : 'NOT SET — required'))
  Logger.log('DRIVE_FOLDER:   ' + (cfg.DRIVE_ID ? 'SET' : 'not set (optional)'))
  if (cfg.SS_ID) {
    try {
      var ss = SpreadsheetApp.openById(cfg.SS_ID)
      Logger.log('Spreadsheet: "' + ss.getName() + '" — OK')
      ss.getSheets().forEach(function(s) {
        var vals = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0]
        Logger.log('  Sheet "' + s.getName() + '" headers: ' + vals.join(', '))
      })
    } catch(err) { Logger.log('ERROR: ' + err.message) }
  }
}
