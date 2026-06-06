// =============================================================================
// NagarikAwaz (नागरिक आवाज) — Google Apps Script Backend
// Deploy: Execute as "Me" | Access: "Anyone"
// =============================================================================

var SS_ID         = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')
var DRIVE_ROOT    = PropertiesService.getScriptProperties().getProperty('DRIVE_ROOT_FOLDER_ID')
var GEMINI_KEY    = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY')
var SITE_URL      = PropertiesService.getScriptProperties().getProperty('SITE_URL') || 'https://nagarikawaz.netlify.app'

var SHEETS = {
  REPORTS:  'Reports',
  USERS:    'Users',
  COMMENTS: 'Comments',
  PROGRESS: 'ProgressUpdates',
  DEPTS:    'Departments',
  AI:       'AIReports',
}

// ── Entry point ───────────────────────────────────────────────────────────────
function doPost(e) {
  var p = {}
  try { p = JSON.parse(e.postData.contents) } catch(err) { return json({ error: 'Invalid JSON body' }) }
  var action = p.action || ''
  try {
    if (action === 'uploadPhoto') return json(uploadPhoto(p))
    return json({ error: 'Unknown POST action: ' + action })
  } catch(err) {
    Logger.log('ERROR [POST/' + action + ']: ' + err)
    return json({ error: String(err.message || err) })
  }
}

function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {}
  var action = p.action || 'ping'
  var result

  try {
    switch (action) {
      // Reports
      case 'getReports':         result = getReports(p);        break
      case 'getReport':          result = getReport(p.id);      break
      case 'createReport':       result = createReport(p);      break
      case 'updateReport':       result = updateReport(p);      break
      case 'upvoteReport':       result = upvoteReport(p);      break
      case 'getNearbyReports':   result = getNearbyReports(p);  break
      case 'getDashboardStats':  result = getDashboardStats(p); break
      // Comments
      case 'getComments':        result = getComments(p.reportId); break
      case 'addComment':         result = addComment(p);           break
      // Progress
      case 'getProgress':        result = getProgress(p.reportId); break
      case 'addProgress':        result = addProgress(p);          break
      // Users
      case 'getUsers':           result = getUsers();              break
      case 'getUser':            result = getUser(p.id);           break
      case 'upsertUser':         result = upsertUser(p);           break
      case 'updateUserRole':     result = updateUserRole(p);       break
      // AI
      case 'generateAIReport':   result = generateAIReport(p);    break
      case 'listAIReports':      result = listAIReports();         break
      case 'prioritizeReport':   result = prioritizeReport(p.id); break
      // Drive
      case 'uploadPhoto':        result = uploadPhoto(p);          break
      // Health
      case 'ping':               result = { ok: true, ts: new Date().toISOString(), version: '2.0' }; break
      default:                   result = { error: 'Unknown action: ' + action }
    }
  } catch (err) {
    result = { error: String(err.message || err) }
    Logger.log('ERROR [' + action + ']: ' + err)
  }

  return json(result)
}

// =============================================================================
// REPORTS
// =============================================================================
function getReports(p) {
  var rows = readSheet(getSheet(SHEETS.REPORTS))

  if (p.province) rows = rows.filter(function(r){ return r.province === p.province })
  if (p.district) rows = rows.filter(function(r){ return r.district === p.district })
  if (p.palika)   rows = rows.filter(function(r){ return r.palika   === p.palika   })
  if (p.ward_no)  rows = rows.filter(function(r){ return r.ward_no  === p.ward_no  })
  if (p.category) rows = rows.filter(function(r){ return r.category === p.category })
  if (p.severity) rows = rows.filter(function(r){ return r.severity === p.severity })
  if (p.status)   rows = rows.filter(function(r){ return r.status   === p.status   })
  if (p.submitted_by) rows = rows.filter(function(r){ return r.submitted_by === p.submitted_by || r.submitter_email === p.submitted_by })

  var sort = p.sort || 'created_at'
  rows.sort(function(a, b) {
    if (sort === 'upvotes')        return (Number(b.upvotes)||0) - (Number(a.upvotes)||0)
    if (sort === 'priority_score') return (Number(b.priority_score)||0) - (Number(a.priority_score)||0)
    if (sort === 'updated_at')     return new Date(b.updated_at||b.created_at) - new Date(a.updated_at||a.created_at)
    return new Date(b.created_at) - new Date(a.created_at)
  })

  var limit = Math.min(parseInt(p.limit||'300'), 500)
  var page  = Math.max(0, parseInt(p.page||'1') - 1)
  return rows.slice(page * limit, page * limit + limit)
}

function getReport(id) {
  if (!id) throw new Error('id required')
  var rows = readSheet(getSheet(SHEETS.REPORTS))
  var r = rows.find(function(x){ return String(x.id) === String(id) })
  if (!r) throw new Error('Report not found: ' + id)
  return r
}

function createReport(p) {
  var sheet   = getSheet(SHEETS.REPORTS)
  var headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0]
  var id      = uuid()
  var now     = new Date().toISOString()
  var score   = calcPriority(p)

  var data = {
    id:               id,
    title_np:         sanitize(p.title_np         || ''),
    title_en:         sanitize(p.title_en         || ''),
    description_np:   sanitize(p.description_np   || ''),
    description_en:   sanitize(p.description_en   || ''),
    category:         sanitize(p.category         || 'other'),
    severity:         sanitize(p.severity         || 'medium'),
    lat:              p.lat      || '',
    lng:              p.lng      || '',
    province:         sanitize(p.province         || ''),
    district:         sanitize(p.district         || ''),
    palika:           sanitize(p.palika           || ''),
    palika_type:      sanitize(p.palika_type      || 'gaunpalika'),
    ward_no:          p.ward_no  || '',
    address_np:       sanitize(p.address_np       || ''),
    address_en:       sanitize(p.address_en       || ''),
    status:           'darta',
    priority_score:   score,
    department:       '',
    submitted_by:     sanitize(p.submitted_by     || ''),
    submitter_phone:  sanitize(p.submitter_phone  || ''),
    photo_ids:        p.photo_ids || '',
    upvotes:          0,
    comments_count:   0,
    created_at:       now,
    updated_at:       now,
    resolved_at:      '',
  }

  var row = headers.map(function(h) { return data[h] !== undefined ? data[h] : '' })
  sheet.appendRow(row)

  // Notify: send email if configured
  notifyNewReport({ id: id, title_en: p.title_en || p.title_np, province: p.province, district: p.district, palika: p.palika, ward_no: p.ward_no })

  return { id: id, priority_score: score, status: 'darta', created_at: now }
}

function updateReport(p) {
  if (!p.id) throw new Error('id required')
  var sheet   = getSheet(SHEETS.REPORTS)
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
  var data    = sheet.getDataRange().getValues()

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== String(p.id)) continue
    var now = new Date().toISOString()
    var fields = ['title_np','title_en','description_np','description_en','category','severity',
                  'status','priority_score','department','photo_ids','address_np','address_en']
    fields.forEach(function(k) {
      if (p[k] !== undefined && p[k] !== null) {
        var col = headers.indexOf(k)
        if (col >= 0) sheet.getRange(i+1, col+1).setValue(p[k])
      }
    })
    var uc = headers.indexOf('updated_at')
    if (uc >= 0) sheet.getRange(i+1, uc+1).setValue(now)
    if (p.status === 'samaadhaan' || p.status === 'banda') {
      var rc = headers.indexOf('resolved_at')
      if (rc >= 0) sheet.getRange(i+1, rc+1).setValue(now)
    }
    if (p.status) {
      var row = {}; headers.forEach(function(h,j){ row[h]=data[i][j] })
      notifyStatusChange({ id: p.id, title_en: row.title_en, newStatus: p.status, submitterPhone: row.submitter_phone })
    }
    return { ok: true, id: p.id, updated_at: now }
  }
  throw new Error('Report not found: ' + p.id)
}

function upvoteReport(p) {
  return incrementField(SHEETS.REPORTS, p.id, 'upvotes')
}

function getNearbyReports(p) {
  if (!p.lat || !p.lng) return []
  var rows   = readSheet(getSheet(SHEETS.REPORTS))
  var lat    = parseFloat(p.lat)
  var lng    = parseFloat(p.lng)
  var radius = parseFloat(p.radius || '100')
  return rows.filter(function(r) {
    if (!r.lat || !r.lng) return false
    return haversine(lat, lng, parseFloat(r.lat), parseFloat(r.lng)) <= radius &&
           r.status !== 'banda'
  }).slice(0, 10)
}

function getDashboardStats(p) {
  var rows = readSheet(getSheet(SHEETS.REPORTS))
  if (p.province) rows = rows.filter(function(r){ return r.province === p.province })
  if (p.district) rows = rows.filter(function(r){ return r.district === p.district })
  if (p.palika)   rows = rows.filter(function(r){ return r.palika   === p.palika   })

  var open     = rows.filter(function(r){ return !['samaadhaan','banda'].includes(r.status) })
  var resolved = rows.filter(function(r){ return r.status === 'samaadhaan' })
  var critical = rows.filter(function(r){ return r.severity === 'critical' && !['samaadhaan','banda'].includes(r.status) })

  // Avg resolution time (hours)
  var times = resolved.filter(function(r){ return r.created_at && r.resolved_at })
    .map(function(r){ return (new Date(r.resolved_at) - new Date(r.created_at)) / 3600000 })
  var avgRes = times.length ? Math.round(times.reduce(function(a,b){return a+b},0)/times.length) : 0

  // Monthly trend
  var trend = []
  for (var m = 5; m >= 0; m--) {
    var d = new Date(); d.setMonth(d.getMonth()-m)
    var key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0')
    trend.push({
      month: d.toLocaleString('default',{month:'short'}),
      count: rows.filter(function(r){ return r.created_at && r.created_at.startsWith(key) }).length,
    })
  }

  return { total: rows.length, open: open.length, resolved: resolved.length, critical: critical.length,
           avgResolutionHrs: avgRes, monthlyTrend: trend }
}

// =============================================================================
// COMMENTS
// =============================================================================
function getComments(reportId) {
  if (!reportId) return []
  return readSheet(getSheet(SHEETS.COMMENTS))
    .filter(function(r){ return String(r.report_id) === String(reportId) })
    .sort(function(a,b){ return new Date(a.created_at) - new Date(b.created_at) })
}

function addComment(p) {
  if (!p.reportId) throw new Error('reportId required')
  var id  = uuid()
  var now = new Date().toISOString()
  getSheet(SHEETS.COMMENTS).appendRow([
    id, p.reportId, p.userId||'', sanitize(p.user_name||''),
    sanitize(p.comment_np||''), sanitize(p.comment_en||''), now,
  ])
  incrementField(SHEETS.REPORTS, p.reportId, 'comments_count')
  return { id: id, created_at: now }
}

// =============================================================================
// PROGRESS
// =============================================================================
function getProgress(reportId) {
  if (!reportId) return []
  return readSheet(getSheet(SHEETS.PROGRESS))
    .filter(function(r){ return String(r.report_id) === String(reportId) })
    .sort(function(a,b){ return new Date(b.timestamp) - new Date(a.timestamp) })
}

function addProgress(p) {
  if (!p.reportId) throw new Error('reportId required')
  var id  = uuid()
  var now = new Date().toISOString()
  getSheet(SHEETS.PROGRESS).appendRow([
    id, p.reportId, sanitize(p.officer||''), sanitize(p.status||''),
    parseInt(p.progress_percent||0), sanitize(p.note_np||''), sanitize(p.note_en||''),
    sanitize(p.department||''), now,
  ])
  if (p.status) updateReport({ id: p.reportId, status: p.status })
  return { id: id, timestamp: now }
}

// =============================================================================
// USERS
// =============================================================================
function getUsers() { return readSheet(getSheet(SHEETS.USERS)) }

function getUser(id) {
  if (!id) return null
  var rows = readSheet(getSheet(SHEETS.USERS))
  return rows.find(function(r){ return r.supabase_user_id === String(id) || String(r.id) === String(id) }) || null
}

function upsertUser(p) {
  if (!p.supabase_user_id && !p.email) throw new Error('supabase_user_id or email required')
  var sheet = getSheet(SHEETS.USERS)
  var rows  = readSheet(sheet)
  var existing = rows.find(function(r){
    return r.supabase_user_id === p.supabase_user_id || r.email === p.email
  })
  if (existing) {
    if (p.name_np && p.name_np !== existing.name_np) setField(SHEETS.USERS, existing.id, 'name_np', p.name_np)
    if (p.name_en && p.name_en !== existing.name_en) setField(SHEETS.USERS, existing.id, 'name_en', p.name_en)
    return existing
  }
  var id = uuid(); var now = new Date().toISOString()
  var uHeaders = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0]
  var uData = {
    id:               id,
    supabase_user_id: p.supabase_user_id || '',
    name_np:          sanitize(p.name_np     || ''),
    name_en:          sanitize(p.name_en     || ''),
    email:            sanitize(p.email       || ''),
    phone:            sanitize(p.phone       || ''),
    role:             p.role || 'nagarik',
    province:         sanitize(p.province    || ''),
    district:         sanitize(p.district    || ''),
    palika:           sanitize(p.palika      || ''),
    ward_no:          p.ward_no     || '',
    department:       p.department  || '',
    created_at:       now,
    status:           'active',
  }
  sheet.appendRow(uHeaders.map(function(h){ return uData[h] !== undefined ? uData[h] : '' }))
  return { id: id, role: 'nagarik', created_at: now }
}

function updateUserRole(p) {
  if (!p.id || !p.role) throw new Error('id and role required')
  setField(SHEETS.USERS, p.id, 'role', p.role)
  if (p.province)   setField(SHEETS.USERS, p.id, 'province',   p.province)
  if (p.district)   setField(SHEETS.USERS, p.id, 'district',   p.district)
  if (p.palika)     setField(SHEETS.USERS, p.id, 'palika',     p.palika)
  if (p.ward_no)    setField(SHEETS.USERS, p.id, 'ward_no',    p.ward_no)
  if (p.department) setField(SHEETS.USERS, p.id, 'department', p.department)
  return { ok: true }
}

// =============================================================================
// AI — GEMINI FREE API
// =============================================================================
function generateAIReport(p) {
  var rows = readSheet(getSheet(SHEETS.REPORTS))
  if (p.province) rows = rows.filter(function(r){ return r.province === p.province })
  if (p.district) rows = rows.filter(function(r){ return r.district === p.district })
  if (p.palika)   rows = rows.filter(function(r){ return r.palika   === p.palika   })

  var scope = [p.palika, p.district, p.province].filter(Boolean).join(', ') || 'All Nepal'

  var issues = rows.map(function(r){ return {
    id: r.id, title_np: r.title_np, title_en: r.title_en,
    category: r.category, severity: r.severity, status: r.status,
    palika: r.palika, district: r.district, province: r.province,
    ward_no: r.ward_no, upvotes: r.upvotes, created_at: r.created_at,
  }})

  var prompt =
    'You are a municipal infrastructure analyst for the Nepal government.\n\n' +
    'Analyze ' + issues.length + ' citizen-reported infrastructure issues for: ' + scope + '\n\n' +
    'Issues JSON:\n' + JSON.stringify(issues) + '\n\n' +
    'Return ONLY valid JSON (no markdown, no backticks, no explanation):\n' +
    '{\n' +
    '  "executive_summary": "2-3 sentence bilingual summary (English then Nepali separated by | )",\n' +
    '  "priorities": [\n' +
    '    {"rank":1,"title":"issue description","score":90,"reason":"why urgent","category":"road"}\n' +
    '  ],\n' +
    '  "trends": "2-3 sentences on patterns and hotspots",\n' +
    '  "seasonal_risk": "monsoon/dry season risk analysis for Nepal",\n' +
    '  "budget_recommendations": "NPR-denominated allocation suggestions",\n' +
    '  "risk_assessment": "if unaddressed risks",\n' +
    '  "recommended_actions": ["action1","action2","action3"],\n' +
    '  "resolution_forecast": "timeframe estimate"\n' +
    '}'

  var aiText = callGemini(prompt, 2000)
  var summary
  try {
    summary = JSON.parse(aiText.replace(/```json|```/g,'').trim())
  } catch(e) {
    summary = { executive_summary: aiText, priorities: [], recommended_actions: [] }
  }

  var docUrl = createReportDoc(summary, scope, issues.length)

  var aiSheet = getSheet(SHEETS.AI)
  var id = uuid(); var now = new Date().toISOString()
  aiSheet.appendRow([
    id, 'AI Report — ' + scope, p.province||'', p.district||'', p.palika||'',
    issues.length, JSON.stringify(summary), docUrl, now,
  ])

  return { id: id, summary: summary, docUrl: docUrl, reportCount: issues.length }
}

function listAIReports() {
  return readSheet(getSheet(SHEETS.AI))
    .sort(function(a,b){ return new Date(b.created_at) - new Date(a.created_at) })
    .map(function(r){
      var s = null; try { s = JSON.parse(r.summary_json) } catch(e){}
      return { id:r.id, title:r.title, province:r.province, district:r.district,
               palika:r.palika, report_count:r.report_count, docUrl:r.doc_url,
               created_at:r.created_at, summary:s }
    })
}

function prioritizeReport(id) {
  var report = getReport(id)
  var prompt = 'Score this Nepal infrastructure report 0-100 for urgency.\n' +
    JSON.stringify(report) + '\n' +
    'Return ONLY JSON: {"score":75,"reasoning":"brief reason"}'
  var result = callGemini(prompt, 200)
  var parsed
  try { parsed = JSON.parse(result.replace(/```json|```/g,'').trim()) }
  catch(e) { parsed = { score: calcPriority(report), reasoning: 'Heuristic score' } }
  updateReport({ id: id, priority_score: parsed.score })
  return parsed
}

// =============================================================================
// DRIVE — PHOTO UPLOAD
// =============================================================================
function uploadPhoto(p) {
  if (!p.data || !p.fileName) throw new Error('data and fileName required')
  var folder = getOrCreateFolder('photos')
  var bytes  = Utilities.base64Decode(p.data)
  var blob   = Utilities.newBlob(bytes, p.mimeType||'image/jpeg', p.fileName)
  var file   = folder.createFile(blob)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
  return {
    fileId:   file.getId(),
    fileUrl:  file.getUrl(),
    thumbUrl: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w400',
  }
}

// =============================================================================
// GEMINI API (free tier — gemini-2.0-flash)
// =============================================================================
function callGemini(prompt, maxTokens) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not set in Script Properties')
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_KEY
  var res = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens||1000, temperature: 0.3 },
      safetySettings: [
        {category:'HARM_CATEGORY_HARASSMENT',       threshold:'BLOCK_NONE'},
        {category:'HARM_CATEGORY_HATE_SPEECH',      threshold:'BLOCK_NONE'},
        {category:'HARM_CATEGORY_SEXUALLY_EXPLICIT',threshold:'BLOCK_NONE'},
        {category:'HARM_CATEGORY_DANGEROUS_CONTENT',threshold:'BLOCK_NONE'},
      ],
    }),
    muteHttpExceptions: true,
  })
  var d = JSON.parse(res.getContentText())
  if (d.error) throw new Error('Gemini: ' + d.error.message)
  var cand = d.candidates && d.candidates[0]
  if (!cand || cand.finishReason === 'SAFETY') throw new Error('Gemini returned no content')
  return cand.content.parts[0].text
}

function createReportDoc(summary, scope, count) {
  var folder = getOrCreateFolder('reports')
  var title  = 'नागरिक आवाज Report — ' + scope + ' — ' + Utilities.formatDate(new Date(), 'Asia/Kathmandu', 'yyyy-MM-dd')
  var doc    = DocumentApp.create(title)
  var body   = doc.getBody()
  body.appendParagraph('नागरिक आवाज | NagarikAwaz').setHeading(DocumentApp.ParagraphHeading.HEADING1)
  body.appendParagraph('Scope: ' + scope + '  |  Reports: ' + count + '  |  Generated: ' +
    Utilities.formatDate(new Date(), 'Asia/Kathmandu', 'yyyy-MM-dd HH:mm'))
  body.appendHorizontalRule()
  if (summary.executive_summary) {
    body.appendParagraph('Executive Summary / कार्यकारी सारांश').setHeading(DocumentApp.ParagraphHeading.HEADING2)
    body.appendParagraph(summary.executive_summary)
  }
  if (summary.priorities && summary.priorities.length) {
    body.appendParagraph('Priority Actions / प्राथमिकता कार्य').setHeading(DocumentApp.ParagraphHeading.HEADING2)
    summary.priorities.forEach(function(p, i) {
      body.appendParagraph((i+1) + '. ' + p.title + ' (Score: ' + p.score + ')')
      if (p.reason) body.appendParagraph('   ' + p.reason)
    })
  }
  if (summary.seasonal_risk) {
    body.appendParagraph('Seasonal Risk / मौसमी जोखिम').setHeading(DocumentApp.ParagraphHeading.HEADING2)
    body.appendParagraph(summary.seasonal_risk)
  }
  if (summary.budget_recommendations) {
    body.appendParagraph('Budget (NPR) / बजेट').setHeading(DocumentApp.ParagraphHeading.HEADING2)
    body.appendParagraph(summary.budget_recommendations)
  }
  if (summary.recommended_actions && summary.recommended_actions.length) {
    body.appendParagraph('Recommended Actions / सिफारिस').setHeading(DocumentApp.ParagraphHeading.HEADING2)
    summary.recommended_actions.forEach(function(a){ body.appendListItem(a) })
  }
  doc.saveAndClose()
  var file = DriveApp.getFileById(doc.getId())
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
  folder.addFile(file); DriveApp.getRootFolder().removeFile(file)
  return 'https://docs.google.com/document/d/' + doc.getId() + '/edit'
}

// =============================================================================
// EMAIL NOTIFICATIONS
// =============================================================================
function notifyNewReport(p) {
  try {
    Logger.log('[NOTIFY] New report: ' + p.title_en + ' | ' + p.palika + ' W-' + p.ward_no)
    // Uncomment to send real emails:
    // MailApp.sendEmail('officer@palika.gov.np', 'New Issue: ' + p.title_en,
    //   'Report submitted\nPalika: ' + p.palika + '\nWard: ' + p.ward_no +
    //   '\nView: ' + SITE_URL + '/report/' + p.id)
  } catch(e) { Logger.log('Email error: ' + e) }
}

function notifyStatusChange(p) {
  try {
    Logger.log('[NOTIFY] Status changed: ' + p.id + ' → ' + p.newStatus)
    // MailApp.sendEmail(p.submitterEmail, 'रिपोर्ट अपडेट: ' + p.title_en, ...)
  } catch(e) {}
}

// =============================================================================
// HELPERS
// =============================================================================
function calcPriority(p) {
  var s = 0
  var sev = {critical:40,high:30,medium:20,low:10}
  var cat = {road:12,water:12,landslide:14,bridge:10,drainage:10,electricity:8,waste:5,health:8,other:3}
  s += sev[p.severity] || 20
  s += cat[p.category] || 5
  s += Math.min(20, parseInt(p.upvotes||0)*2)
  s += Math.min(10, parseInt(p.comments_count||0)*2)
  return Math.min(100, s)
}

function haversine(lat1,lng1,lat2,lng2) {
  var R=6371e3, p1=lat1*Math.PI/180, p2=lat2*Math.PI/180
  var dp=(lat2-lat1)*Math.PI/180, dl=(lng2-lng1)*Math.PI/180
  var a=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))
}

function getSheet(name) {
  var ss = SpreadsheetApp.openById(SS_ID)
  var sh = ss.getSheetByName(name)
  if (!sh) { sh = ss.insertSheet(name); initHeaders(sh, name) }
  return sh
}

var HEADERS = {
  Reports:        ['id','title_np','title_en','description_np','description_en','category','severity','lat','lng','province','district','palika','palika_type','ward_no','address_np','address_en','status','priority_score','department','submitted_by','submitter_phone','photo_ids','upvotes','comments_count','created_at','updated_at','resolved_at'],
  Users:          ['id','supabase_user_id','name_np','name_en','email','phone','role','province','district','palika','ward_no','department','created_at','status'],
  Comments:       ['id','report_id','user_id','user_name','comment_np','comment_en','created_at'],
  ProgressUpdates:['id','report_id','officer','status','progress_percent','note_np','note_en','department','timestamp'],
  Departments:    ['id','dept_name_np','dept_name_en','palika','district','lead_email','lead_phone'],
  AIReports:      ['id','title','province','district','palika','report_count','summary_json','doc_url','created_at'],
}

function initHeaders(sheet, name) {
  var h = HEADERS[name]
  if (h) { sheet.getRange(1,1,1,h.length).setValues([h]); sheet.getRange(1,1,1,h.length).setFontWeight('bold') }
}

function readSheet(sheet) {
  var data = sheet.getDataRange().getValues()
  if (data.length < 2) return []
  var headers = data[0].map(function(h){ return String(h).trim() })
  return data.slice(1).map(function(row){
    var obj = {}
    headers.forEach(function(h,i){ obj[h] = row[i] != null ? String(row[i]).trim() : '' })
    return obj
  }).filter(function(r){ return r.id })
}

function setField(sheetName, rowId, field, value) {
  var sheet   = getSheet(sheetName)
  var headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0]
  var col     = headers.indexOf(field); if (col < 0) return
  var data    = sheet.getDataRange().getValues()
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(rowId)) { sheet.getRange(i+1,col+1).setValue(value); return }
  }
}

function incrementField(sheetName, rowId, field) {
  var sheet   = getSheet(sheetName)
  var headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0]
  var col     = headers.indexOf(field); if (col < 0) return { ok: true }
  var data    = sheet.getDataRange().getValues()
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(rowId)) {
      var cur = parseInt(data[i][col]||0)
      sheet.getRange(i+1,col+1).setValue(cur+1)
      return { ok: true, value: cur+1 }
    }
  }
  return { ok: true }
}

function getOrCreateFolder(name) {
  var root
  try { root = DRIVE_ROOT ? DriveApp.getFolderById(DRIVE_ROOT) : DriveApp.getRootFolder() } catch(e) { root = DriveApp.getRootFolder() }
  var it = root.getFoldersByName(name)
  return it.hasNext() ? it.next() : root.createFolder(name)
}

function uuid() { return Utilities.getUuid().replace(/-/g,'').substr(0,16) }

function sanitize(s) {
  return String(s||'').replace(/[<>'"]/g,function(c){
    return {'<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]
  }).slice(0,2000)
}

function json(data) {
  var out = ContentService.createTextOutput(JSON.stringify(data))
  out.setMimeType(ContentService.MimeType.JSON)
  return out
}

// =============================================================================
// SETUP — Run once manually
// =============================================================================
function setupSpreadsheet() {
  Logger.log('Setting up NagarikAwaz spreadsheet...')
  Object.keys(HEADERS).forEach(function(name) {
    var ss   = SpreadsheetApp.openById(SS_ID)
    var sh   = ss.getSheetByName(name)
    if (!sh) { sh = ss.insertSheet(name); initHeaders(sh, name); Logger.log('Created: ' + name) }
    else     { Logger.log('Exists: ' + name) }
  })
  Logger.log('Setup complete! Test: ?action=ping')
}

function testPing() {
  Logger.log(doGet({ parameter: { action: 'ping' } }).getContent())
}
