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
  WEEKLY:   'WeeklyReports',
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
      // Reports — admin
      case 'deleteReport':       result = deleteReport(p.id);      break
      // AI
      case 'generateAIReport':   result = generateAIReport(p);    break
      case 'listAIReports':      result = listAIReports();         break
      case 'prioritizeReport':   result = prioritizeReport(p.id); break
      // Weekly reports
      case 'getWeeklyReports':     result = getWeeklyReports();                break
      case 'triggerWeeklyReport':  result = generateWeeklyReport();            break
      case 'updateWeeklySchedule': result = updateWeeklySchedule(p);          break
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

function deleteReport(id) {
  if (!id) throw new Error('id required')
  var sheet = getSheet(SHEETS.REPORTS)
  var data  = sheet.getDataRange().getValues()
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1)
      return { ok: true, id: id }
    }
  }
  throw new Error('Report not found: ' + id)
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
    gender:           sanitize(p.gender      || ''),
    occupation:       sanitize(p.occupation  || ''),
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

  var issues = rows
    .sort(function(a,b){ return (parseInt(b.upvotes)||0) - (parseInt(a.upvotes)||0) })
    .slice(0, 60)
    .map(function(r){ return {
      id: r.id, title_en: r.title_en || r.title_np,
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
// GEMINI API (free tier — gemini-1.5-flash)
// =============================================================================
function callGemini(prompt, maxTokens) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not set in Script Properties')
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + GEMINI_KEY
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
  if (!cand || !cand.content || !cand.content.parts || !cand.content.parts[0]) {
    var reason = (cand && cand.finishReason) || (d.promptFeedback && d.promptFeedback.blockReason) || 'unknown'
    throw new Error('Gemini returned no content (reason: ' + reason + ')')
  }
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
  folder.addFile(file)
  try { DriveApp.getRootFolder().removeFile(file) } catch(e) {}
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
  Users:          ['id','supabase_user_id','name_np','name_en','email','phone','gender','occupation','role','province','district','palika','ward_no','department','created_at','status'],
  Comments:       ['id','report_id','user_id','user_name','comment_np','comment_en','created_at'],
  ProgressUpdates:['id','report_id','officer','status','progress_percent','note_np','note_en','department','timestamp'],
  Departments:    ['id','dept_name_np','dept_name_en','palika','district','lead_email','lead_phone'],
  AIReports:      ['id','title','province','district','palika','report_count','summary_json','doc_url','created_at'],
  WeeklyReports:  ['id','title','period_start','period_end','report_count','doc_url','pdf_url','summary_json','created_at'],
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
// WEEKLY REPORTS — Auto-generated every Monday via time-based trigger
// =============================================================================

function getWeeklyReports() {
  return readSheet(getSheet(SHEETS.WEEKLY))
    .sort(function(a,b){ return new Date(b.created_at) - new Date(a.created_at) })
    .map(function(r){
      var s = null; try { s = JSON.parse(r.summary_json) } catch(e){}
      return {
        id: r.id, title: r.title,
        period_start: r.period_start, period_end: r.period_end,
        report_count: r.report_count,
        doc_url: r.doc_url, pdf_url: r.pdf_url,
        summary: s, created_at: r.created_at,
      }
    })
}

function generateWeeklyReport() {
  var now     = new Date()
  var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  var allReports  = readSheet(getSheet(SHEETS.REPORTS))
  var weekReports = allReports.filter(function(r){
    return r.created_at && new Date(r.created_at) >= weekAgo
  })

  var stats    = _weeklyStats(allReports, weekReports)
  var aiResult = _weeklyAISummary(weekReports, stats)

  var folder  = getOrCreateFolder('weekly-reports')
  var dateStr = Utilities.formatDate(now, 'Asia/Kathmandu', 'yyyy-MM-dd')
  var title   = 'नागरिक आवाज Weekly Report — ' + dateStr
  var doc     = DocumentApp.create(title)
  var body    = doc.getBody()

  _buildWeeklyDoc(body, weekReports, allReports, stats, aiResult, weekAgo, now)
  doc.saveAndClose()

  var docFile = DriveApp.getFileById(doc.getId())
  docFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
  folder.addFile(docFile)
  try { DriveApp.getRootFolder().removeFile(docFile) } catch(e) {}

  var pdfBlob = docFile.getAs('application/pdf')
  pdfBlob.setName(title + '.pdf')
  var pdfFile = folder.createFile(pdfBlob)
  pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)

  var id  = uuid()
  var now2 = new Date().toISOString()
  getSheet(SHEETS.WEEKLY).appendRow([
    id, title,
    weekAgo.toISOString(), now.toISOString(),
    weekReports.length,
    docFile.getUrl(), pdfFile.getUrl(),
    JSON.stringify(aiResult),
    now2,
  ])

  Logger.log('Weekly report done: ' + docFile.getUrl())
  return { id: id, docUrl: docFile.getUrl(), pdfUrl: pdfFile.getUrl(), reportCount: weekReports.length }
}

function _weeklyStats(all, week) {
  var catCount = {}, provCount = {}, sevCount = {}
  week.forEach(function(r){
    catCount[r.category]  = (catCount[r.category]  || 0) + 1
    provCount[r.province] = (provCount[r.province] || 0) + 1
    sevCount[r.severity]  = (sevCount[r.severity]  || 0) + 1
  })
  var open     = all.filter(function(r){ return !['samaadhaan','banda'].includes(r.status) })
  var resolved = all.filter(function(r){ return r.status === 'samaadhaan' })
  var critical = all.filter(function(r){ return r.severity === 'critical' && !['samaadhaan','banda'].includes(r.status) })

  var topPriority = week.slice().sort(function(a,b){
    return (Number(b.priority_score)||0) - (Number(a.priority_score)||0)
  }).slice(0, 10)

  return {
    totalAll: all.length, totalWeek: week.length,
    open: open.length, resolved: resolved.length, critical: critical.length,
    catCount: catCount, provCount: provCount, sevCount: sevCount,
    topPriority: topPriority,
    withPhotos: week.filter(function(r){ return r.photo_ids }).length,
  }
}

function _weeklyAISummary(weekReports, stats) {
  if (!GEMINI_KEY) return { executive_summary: 'AI summary unavailable (no API key).', recommendations: [] }
  var issues = weekReports.slice(0, 80).map(function(r){ return {
    title: r.title_en || r.title_np, category: r.category, severity: r.severity,
    status: r.status, province: r.province, district: r.district, palika: r.palika,
    upvotes: r.upvotes, priority_score: r.priority_score,
  }})
  var prompt =
    'You are a municipal analyst for Nepal. Summarize this week\'s ' + weekReports.length + ' citizen-reported issues.\n' +
    'Stats: open=' + stats.open + ' resolved=' + stats.resolved + ' critical=' + stats.critical + '\n' +
    'Top categories: ' + JSON.stringify(stats.catCount) + '\n' +
    'Issues: ' + JSON.stringify(issues) + '\n\n' +
    'Return ONLY valid JSON:\n' +
    '{"executive_summary":"2-3 sentence bilingual summary (English | नेपाली)","key_findings":["finding1","finding2","finding3"],' +
    '"hotspots":["area1","area2"],"recommendations":["action1","action2","action3"],' +
    '"trend":"improving/worsening/stable with brief reason"}'
  try {
    var text   = callGemini(prompt, 800)
    var parsed = JSON.parse(text.replace(/```json|```/g,'').trim())
    return parsed
  } catch(e) {
    return { executive_summary: 'Summary generation failed: ' + e.message, recommendations: [] }
  }
}

function _buildWeeklyDoc(body, week, all, stats, ai, weekAgo, now) {
  var fmt = function(d){ return Utilities.formatDate(d, 'Asia/Kathmandu', 'MMM dd, yyyy') }

  // ── Title ──
  var title = body.appendParagraph('नागरिक आवाज | NagarikAwaz')
  title.setHeading(DocumentApp.ParagraphHeading.HEADING1)
  title.setAlignment(DocumentApp.HorizontalAlignment.CENTER)
  body.appendParagraph('साप्ताहिक प्रतिवेदन / Weekly Report')
    .setHeading(DocumentApp.ParagraphHeading.HEADING2)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
  body.appendParagraph(fmt(weekAgo) + ' — ' + fmt(now))
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
    .setItalic(true)
  body.appendHorizontalRule()

  // ── Quick stats ──
  body.appendParagraph('📊 Weekly Snapshot').setHeading(DocumentApp.ParagraphHeading.HEADING2)
  var statTable = body.appendTable([
    ['Metric', 'Value'],
    ['New reports this week', String(stats.totalWeek)],
    ['Total reports (all time)', String(stats.totalAll)],
    ['Currently open', String(stats.open)],
    ['Resolved (all time)', String(stats.resolved)],
    ['Critical & open', String(stats.critical)],
    ['Reports with photos', String(stats.withPhotos)],
  ])
  statTable.getRow(0).editAsText().setBold(true)
  statTable.setBorderWidth(1)

  // ── Map ──
  body.appendParagraph('').appendHorizontalRule()
  body.appendParagraph('🗺️ Issue Locations This Week').setHeading(DocumentApp.ParagraphHeading.HEADING2)
  var mapReports = week.filter(function(r){ return r.lat && r.lng })
  if (mapReports.length > 0) {
    try {
      var sm = Maps.newStaticMap().setSize(600, 320).setZoom(7).setCenter(28.3949, 84.124)
      mapReports.slice(0, 50).forEach(function(r){
        sm.addMarker(parseFloat(r.lat), parseFloat(r.lng))
      })
      body.appendImage(Utilities.newBlob(sm.getMapImage(), 'image/png', 'map.png')).setWidth(500)
    } catch(e) {
      body.appendParagraph('Map could not be generated automatically. View live map: ' + SITE_URL)
        .setItalic(true).setLinkUrl(SITE_URL)
    }
  } else {
    body.appendParagraph('No geo-coded reports this week.').setItalic(true)
  }

  // ── AI Summary ──
  body.appendParagraph('').appendHorizontalRule()
  body.appendParagraph('🤖 AI Executive Summary').setHeading(DocumentApp.ParagraphHeading.HEADING2)
  body.appendParagraph(ai.executive_summary || 'No summary available.')
  if (ai.key_findings && ai.key_findings.length) {
    body.appendParagraph('Key Findings:').setBold(true)
    ai.key_findings.forEach(function(f){ body.appendListItem(f).setGlyphType(DocumentApp.GlyphType.BULLET) })
  }
  if (ai.trend) {
    body.appendParagraph('Trend: ' + ai.trend).setItalic(true)
  }

  // ── Photo gallery — per-issue collage ──
  var photoReports = week.filter(function(r){ return r.photo_ids && r.photo_ids.trim() })
  if (photoReports.length > 0) {
    body.appendParagraph('').appendHorizontalRule()
    body.appendParagraph('📸 Photo Evidence').setHeading(DocumentApp.ParagraphHeading.HEADING2)

    var MAX_ISSUES = 10
    var MAX_PHOTOS = 6   // per issue
    var COLS       = 3
    var IMG_W      = 155
    var IMG_H      = 116 // 4:3 ratio

    var issuesDone = 0
    photoReports.forEach(function(r) {
      if (issuesDone >= MAX_ISSUES) return
      var ids = r.photo_ids.split(',').map(function(s){ return s.trim() }).filter(Boolean)
      if (ids.length === 0) return

      // Issue label
      var location = [r.palika, r.district].filter(Boolean).join(', ') + (r.ward_no ? ', Ward ' + r.ward_no : '')
      body.appendParagraph('📍 ' + (r.title_en || r.title_np || 'Issue') + (location ? ' — ' + location : ''))
        .setBold(true).setFontSize(10)

      // Load blobs (skip on error)
      var blobs = []
      ids.slice(0, MAX_PHOTOS).forEach(function(fid) {
        try { blobs.push(DriveApp.getFileById(fid).getBlob()) }
        catch(e) { Logger.log('Photo load failed: ' + fid + ' — ' + e.message) }
      })

      if (blobs.length === 0) {
        body.appendParagraph('(photos unavailable)').setItalic(true).setFontSize(9)
      } else {
        // Collage: COLS images per row, no border
        var cols    = Math.min(blobs.length, COLS)
        var numRows = Math.ceil(blobs.length / cols)
        for (var rowIdx = 0; rowIdx < numRows; rowIdx++) {
          var rowBlobs = blobs.slice(rowIdx * cols, rowIdx * cols + cols)
          var emptyRow = rowBlobs.map(function(){ return '' })
          var tbl = body.appendTable([emptyRow])
          tbl.setBorderWidth(0)
          rowBlobs.forEach(function(blob, colIdx) {
            var cell = tbl.getCell(0, colIdx)
            cell.clear()
            cell.setPaddingTop(3)
            cell.setPaddingBottom(3)
            cell.setPaddingLeft(3)
            cell.setPaddingRight(3)
            try {
              cell.appendImage(blob).setWidth(IMG_W).setHeight(IMG_H)
            } catch(e) {
              cell.appendParagraph('⚠ unavailable').setItalic(true).setFontSize(8)
            }
          })
        }
      }

      body.appendParagraph('').setFontSize(4) // narrow spacer between issues
      issuesDone++
    })
  }

  // ── Category breakdown ──
  body.appendParagraph('').appendHorizontalRule()
  body.appendParagraph('📂 Category Breakdown').setHeading(DocumentApp.ParagraphHeading.HEADING2)
  var catRows = [['Category', 'Count']]
  Object.keys(stats.catCount).sort(function(a,b){ return stats.catCount[b] - stats.catCount[a] }).forEach(function(c){
    catRows.push([c, String(stats.catCount[c])])
  })
  if (catRows.length > 1) {
    var catTable = body.appendTable(catRows)
    catTable.getRow(0).editAsText().setBold(true)
    catTable.setBorderWidth(1)
  }

  // ── Province breakdown ──
  body.appendParagraph('').appendHorizontalRule()
  body.appendParagraph('🗾 Province Breakdown').setHeading(DocumentApp.ParagraphHeading.HEADING2)
  var provRows = [['Province', 'New This Week']]
  Object.keys(stats.provCount).sort(function(a,b){ return stats.provCount[b] - stats.provCount[a] }).forEach(function(p){
    provRows.push([p || 'Unknown', String(stats.provCount[p])])
  })
  if (provRows.length > 1) {
    var provTable = body.appendTable(provRows)
    provTable.getRow(0).editAsText().setBold(true)
    provTable.setBorderWidth(1)
  }

  // ── Top priority issues ──
  body.appendParagraph('').appendHorizontalRule()
  body.appendParagraph('🔴 Top Priority Issues').setHeading(DocumentApp.ParagraphHeading.HEADING2)
  if (stats.topPriority.length > 0) {
    var priRows = [['#', 'Title', 'Category', 'Severity', 'Location', 'Score', 'Upvotes']]
    stats.topPriority.forEach(function(r, i){
      priRows.push([
        String(i+1),
        (r.title_en || r.title_np || '').slice(0, 50),
        r.category || '', r.severity || '',
        [r.palika, r.district].filter(Boolean).join(', ') || r.province || '',
        String(r.priority_score || 0), String(r.upvotes || 0),
      ])
    })
    var priTable = body.appendTable(priRows)
    priTable.getRow(0).editAsText().setBold(true)
    priTable.setBorderWidth(1)
  }

  // ── Recommendations ──
  if (ai.recommendations && ai.recommendations.length) {
    body.appendParagraph('').appendHorizontalRule()
    body.appendParagraph('✅ Recommended Actions').setHeading(DocumentApp.ParagraphHeading.HEADING2)
    ai.recommendations.forEach(function(a){ body.appendListItem(a).setGlyphType(DocumentApp.GlyphType.NUMBER) })
  }
  if (ai.hotspots && ai.hotspots.length) {
    body.appendParagraph('⚠️ Hotspot Areas: ' + ai.hotspots.join(', ')).setBold(true)
  }

  // ── Footer ──
  body.appendParagraph('').appendHorizontalRule()
  body.appendParagraph('Generated by NagarikAwaz on ' + fmt(now) + ' | ' + SITE_URL)
    .setItalic(true).setFontSize(9)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
}

// Call once to create the trigger (default: Sunday 5 PM Kathmandu time).
function setupWeeklyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction() === 'generateWeeklyReport') ScriptApp.deleteTrigger(t)
  })
  ScriptApp.newTrigger('generateWeeklyReport')
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(17)
    .inTimezone('Asia/Kathmandu')
    .create()
  Logger.log('Weekly trigger created — runs every Sunday at 5 PM Kathmandu time.')
}

// Update trigger day/hour via frontend Settings → saved to localStorage + called here.
function updateWeeklySchedule(p) {
  var dayMap = {
    SUNDAY:    ScriptApp.WeekDay.SUNDAY,
    MONDAY:    ScriptApp.WeekDay.MONDAY,
    TUESDAY:   ScriptApp.WeekDay.TUESDAY,
    WEDNESDAY: ScriptApp.WeekDay.WEDNESDAY,
    THURSDAY:  ScriptApp.WeekDay.THURSDAY,
    FRIDAY:    ScriptApp.WeekDay.FRIDAY,
    SATURDAY:  ScriptApp.WeekDay.SATURDAY,
  }
  var weekDay = dayMap[String(p.day || '').toUpperCase()] || ScriptApp.WeekDay.SUNDAY
  var hour    = Math.max(0, Math.min(23, parseInt(p.hour, 10) || 17))
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'generateWeeklyReport') ScriptApp.deleteTrigger(t)
  })
  ScriptApp.newTrigger('generateWeeklyReport')
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(weekDay)
    .atHour(hour)
    .inTimezone('Asia/Kathmandu')
    .create()
  Logger.log('Weekly trigger updated: ' + p.day + ' at ' + hour + ':00 Kathmandu time.')
  return { ok: true, day: p.day, hour: hour }
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

// Run this ONCE from the editor to grant Drive authorization to the web app.
// After it logs "Drive OK", redeploy → photo upload will work.
function authorizeDrive() {
  var folder = getOrCreateFolder('photos')
  Logger.log('Drive OK — photos folder: ' + folder.getName() + ' | id: ' + folder.getId())
}

// Safe fix: rewrites row 1 headers on every sheet without touching data rows.
// Run this if columns are misaligned but you want to keep existing rows.
function fixHeaders() {
  var ss = SpreadsheetApp.openById(SS_ID)
  Object.keys(HEADERS).forEach(function(name) {
    var sh = ss.getSheetByName(name)
    if (!sh) {
      sh = ss.insertSheet(name)
      Logger.log('Created sheet: ' + name)
    }
    var h = HEADERS[name]
    sh.getRange(1, 1, 1, h.length).setValues([h])
    sh.getRange(1, 1, 1, h.length).setFontWeight('bold')
    Logger.log('Headers written: ' + name + ' (' + h.length + ' cols)')
  })
  Logger.log('Done — all sheet headers corrected.')
}

// Nuclear reset: clears ALL data + headers from every sheet, then writes correct headers.
// Use this when data rows are also wrong. You will lose all existing data.
function resetAllSheets() {
  var ss = SpreadsheetApp.openById(SS_ID)
  Object.keys(HEADERS).forEach(function(name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name)
    sh.clearContents()
    initHeaders(sh, name)
    Logger.log('Reset: ' + name)
  })
  Logger.log('All sheets reset with correct headers. Old data cleared.')
}
