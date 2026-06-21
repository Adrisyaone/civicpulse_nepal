import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi, reportsApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { RoleBadge, Spinner, EmptyState, Modal, CategoryBadge, SeverityBadge, StatusBadge } from '../components/ui'
import { ROLES, PROVINCES, CATEGORIES, SEVERITIES, STATUSES } from '../utils/constants'
import { formatDate, driveThumb } from '../utils/helpers'
import toast from 'react-hot-toast'

export default function AdminPage() {
  const { lang } = useLang()
  const { profile: myProfile } = useAuth()
  const isDeveloper = myProfile?.role === 'developer'
  const qc = useQueryClient()
  const [tab, setTab] = useState('users')

  // ── Users ─────────────────────────────────────────────────────────────────────
  const { data: rawUsers, isLoading: usersLoading, error } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })
  const users    = Array.isArray(rawUsers) ? rawUsers : []
  const apiError = !Array.isArray(rawUsers) && rawUsers?.error ? rawUsers.error : (error?.message || null)
  const [search,   setSearch]   = useState('')
  const [editUser, setEditUser] = useState(null)
  const [uForm,    setUForm]    = useState({ name: '', phone: '', role: '', province: '', district: '', palika: '', ward_no: '' })

  const updateUser = useMutation({
    mutationFn: ({ id, ...data }) => usersApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User updated'); setEditUser(null) },
    onError: () => toast.error('Update failed'),
  })

  const [addUserOpen, setAddUserOpen] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '', phone: '', role: 'citizen', province: '', district: '', palika: '', ward_no: '' })

  const createUser = useMutation({
    mutationFn: (data) => usersApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User created'); setAddUserOpen(false); setNewUser({ name: '', email: '', phone: '', role: 'citizen', province: '', district: '', palika: '', ward_no: '' }) },
    onError: (e) => toast.error(e?.error || 'Create failed'),
  })

  const deleteUser = useMutation({
    mutationFn: (id) => usersApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User deleted') },
    onError: (e) => toast.error(e?.error || 'Delete failed'),
  })

  // ── Reports ───────────────────────────────────────────────────────────────────
  const { data: rawReports, isLoading: reportsLoading } = useQuery({
    queryKey: ['reports', {}],
    queryFn: () => reportsApi.list({}),
    enabled: tab === 'reports',
  })
  const reports = Array.isArray(rawReports) ? rawReports : []
  const [editReport, setEditReport] = useState(null)
  const [rForm,      setRForm]      = useState({})
  const [rSearch,    setRSearch]    = useState('')

  const updateReport = useMutation({
    mutationFn: ({ id, ...data }) => reportsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success('Report updated'); setEditReport(null) },
    onError: () => toast.error('Update failed'),
  })

  const deleteReport = useMutation({
    mutationFn: (id) => reportsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success('Report deleted') },
    onError: () => toast.error('Delete failed'),
  })

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const displayName = (u) => u.name || u.name_np || u.name_en || '—'

  const filteredUsers = users.filter((u) =>
    !search ||
    displayName(u).toLowerCase().includes(search.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(search.toLowerCase())
  )

  const filteredReports = reports.filter((r) =>
    !rSearch ||
    (r.title || '').toLowerCase().includes(rSearch.toLowerCase()) ||
    (r.submitted_by || '').toLowerCase().includes(rSearch.toLowerCase())
  )

  async function handleDeleteUser(u) {
    if (!window.confirm(`Permanently delete "${displayName(u)}" (${u.email})? They will lose access.`)) return
    deleteUser.mutate(u.id)
  }

  function openEditUser(u) {
    setEditUser(u)
    setUForm({ name: u.name || '', phone: u.phone || '', role: u.role || 'citizen', province: u.province || '', district: u.district || '', palika: u.palika || '', ward_no: u.ward_no || '' })
  }

  function openEditReport(r) {
    setEditReport(r)
    setRForm({
      title:       r.title || '',
      description: r.description || '',
      category:    r.category || 'other',
      severity:    r.severity || 'medium',
      status:      r.status  || 'open',
      assigned_to: r.assigned_to || '',
      address:     r.address || '',
      ward_no:     r.ward_no || '',
      palika:      r.palika || '',
      district:    r.district || '',
    })
  }

  async function handleDeleteReport(r) {
    if (!window.confirm(`Delete "${r.title || 'this report'}"? Cannot be undone.`)) return
    deleteReport.mutate(r.id)
  }

  const TABS = [
    { id: 'users',   label: `👥 ${lang === 'ne' ? 'प्रयोगकर्ता' : 'Users'}`  },
    { id: 'reports', label: `📋 ${lang === 'ne' ? 'रिपोर्ट'    : 'Reports'}` },
    { id: 'setup',   label: `⚙️ ${lang === 'ne' ? 'सेटअप'      : 'Setup'}`   },
  ]

  const primaryRoles = ['citizen', 'admin', 'developer']

  return (
    <div className="page-wrap">
      <div className="mb-4">
        <h1 className="font-display font-bold text-2xl text-white">Admin Panel</h1>
        {apiError && (
          <div className="mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            ⚠ {apiError}
            {apiError.includes('SESSION') && ' — Run testAuth() in GAS editor to authorize UrlFetchApp, then redeploy.'}
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-800 mb-6">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'text-brand-400 border-b-2 border-brand-500 bg-brand-500/5'
                : 'text-slate-500 hover:text-slate-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── USERS TAB ── */}
      {tab === 'users' && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {primaryRoles.map((k) => {
              const v = ROLES[k]
              return (
                <div key={k} className="card p-3 text-center">
                  <div className={`font-display text-xl font-bold ${v.color}`}>{users.filter((u) => u.role === k).length}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{lang === 'ne' ? v.np : v.en}</div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-3 mb-4">
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder={lang === 'ne' ? 'नाम वा इमेलले खोज्नुहोस्…' : 'Search by name or email…'}
              className="input text-sm max-w-sm" />
            {isDeveloper && (
              <button onClick={() => setAddUserOpen(true)} className="btn-primary text-sm whitespace-nowrap">
                ➕ Add User
              </button>
            )}
          </div>

          {usersLoading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : filteredUsers.length === 0 ? (
            <EmptyState icon="👥" title="No users found" />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50">
                      {['User', 'Role', 'Location', 'Joined', ''].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs text-slate-500 font-medium uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-brand-900 border border-brand-800 flex items-center justify-center text-xs font-bold text-brand-400 overflow-hidden flex-shrink-0">
                              {u.avatar_url ? (
                                <img src={u.avatar_url.startsWith('http') ? u.avatar_url : driveThumb(u.avatar_url, 80)}
                                  alt="" className="w-full h-full object-cover"
                                  onError={(e) => { e.target.style.display = 'none' }} />
                              ) : (
                                ((u.name || u.email || '?')[0] || '?').toUpperCase()
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-slate-200">{displayName(u)}</p>
                              <p className="text-xs text-slate-500">{u.email}</p>
                              {u.phone && <p className="text-xs text-slate-600">{u.phone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {u.palika  && <div className="font-medium">{u.palika}</div>}
                          {u.ward_no && <div>{lang === 'ne' ? 'वडा' : 'Ward'} {u.ward_no}</div>}
                          {u.district && <div className="text-slate-600">{u.district}</div>}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {u.created_at ? formatDate(u.created_at).split(',')[0] : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 whitespace-nowrap">
                            <button onClick={() => openEditUser(u)} className="text-xs text-brand-400 hover:text-brand-300">
                              Edit
                            </button>
                            {isDeveloper && (
                              <button onClick={() => handleDeleteUser(u)} disabled={deleteUser.isPending}
                                className="text-xs text-red-500 hover:text-red-400 disabled:opacity-40">
                                Del
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── REPORTS TAB ── */}
      {tab === 'reports' && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <input value={rSearch} onChange={(e) => setRSearch(e.target.value)}
              placeholder="Search reports…"
              className="input text-sm max-w-sm" />
            <span className="text-slate-500 text-sm">{reports.length} total</span>
          </div>

          {reportsLoading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : filteredReports.length === 0 ? (
            <EmptyState icon="📋" title="No reports" />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50">
                      {['Title', 'Category', 'Severity', 'Status', 'Submitted By', 'Date', ''].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs text-slate-500 font-medium uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredReports.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="font-medium text-slate-200 truncate">{r.title || '—'}</p>
                          {(r.palika || r.district) && (
                            <p className="text-xs text-slate-600 truncate">{r.palika}{r.ward_no ? ` · ${r.ward_no}` : ''}{r.district ? `, ${r.district}` : ''}</p>
                          )}
                        </td>
                        <td className="px-4 py-3"><CategoryBadge category={r.category} /></td>
                        <td className="px-4 py-3"><SeverityBadge severity={r.severity} /></td>
                        <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                        <td className="px-4 py-3 text-xs text-slate-400 max-w-[120px] truncate">{r.submitted_by || '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                          {r.created_at ? formatDate(r.created_at).split(',')[0] : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-3 whitespace-nowrap">
                            <button onClick={() => openEditReport(r)} className="text-xs text-brand-400 hover:text-brand-300">Edit</button>
                            <button onClick={() => handleDeleteReport(r)} disabled={deleteReport.isPending} className="text-xs text-red-500 hover:text-red-400 disabled:opacity-40">Del</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── SETUP TAB ── */}
      {tab === 'setup' && (
        <div className="max-w-xl space-y-4">
          <div className="card p-5">
            <h3 className="font-semibold text-white mb-3">Configuration Status</h3>
            <div className="space-y-2 text-sm">
              {[
                ['GAS Web App URL', !!import.meta.env.VITE_SHEETS_API_URL],
                ['Supabase URL',    !!import.meta.env.VITE_SUPABASE_URL],
                ['Supabase Key',    !!import.meta.env.VITE_SUPABASE_ANON_KEY],
              ].map(([label, ok]) => (
                <div key={label} className="flex items-center justify-between py-1.5 border-b border-slate-800/50">
                  <span className="text-slate-400">{label}</span>
                  <span className={ok ? 'text-green-400 font-mono text-xs' : 'text-red-400 font-mono text-xs'}>{ok ? '✓ Set' : '✗ Missing'}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-3 text-center text-xs text-slate-500">
              <div className="flex-1 card p-2"><div className="font-bold text-white text-lg">{users.length}</div>Users</div>
              <div className="flex-1 card p-2"><div className="font-bold text-white text-lg">{reports.length || '—'}</div>Reports</div>
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-white mb-3">🔐 Google Apps Script Setup</h3>
            <ol className="space-y-2.5 text-sm text-slate-400 list-decimal list-inside">
              <li>Open <span className="text-slate-200 font-medium">scripts/Code.gs</span> in the GAS editor</li>
              <li>Run <code className="text-brand-400 bg-brand-900/30 px-1 rounded">setup()</code> to create / reset sheet headers</li>
              <li>Run <code className="text-brand-400 bg-brand-900/30 px-1 rounded">testAuth()</code> — click <strong className="text-slate-200">Allow</strong> on the authorization popup</li>
              <li>Run <code className="text-brand-400 bg-brand-900/30 px-1 rounded">testCreate()</code> to verify sheet writing works</li>
              <li>Deploy → Manage deployments → Edit → <strong className="text-slate-200">New version</strong> → Deploy</li>
              <li>Copy the <code className="text-slate-300">/exec</code> URL into <code className="text-slate-300">.env.local</code> as <code className="text-brand-400">VITE_SHEETS_API_URL</code></li>
              <li>Restart <code className="text-brand-400 bg-brand-900/30 px-1 rounded">npm run dev</code></li>
            </ol>
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-white mb-2">🗑️ Cleanup Old Triggers</h3>
            <p className="text-sm text-slate-400 mb-2">If you see <em>"Script function not found: cleanExpiredSessions"</em>:</p>
            <ol className="space-y-1 text-sm text-slate-400 list-decimal list-inside">
              <li>GAS editor → Triggers (⏰ icon on left sidebar)</li>
              <li>Delete any trigger named <code className="text-red-400 bg-red-900/20 px-1 rounded">cleanExpiredSessions</code></li>
            </ol>
          </div>
        </div>
      )}

      {/* ── Edit User Modal ── */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)}
        title={`Edit User: ${editUser?.name || editUser?.email || ''}`}>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Name</label>
              <input value={uForm.name || ''} onChange={(e) => setUForm((f) => ({ ...f, name: e.target.value }))} className="input text-sm" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input value={uForm.phone || ''} onChange={(e) => setUForm((f) => ({ ...f, phone: e.target.value }))} className="input text-sm" />
            </div>
          </div>
          <div>
            <label className="label">Role</label>
            <select value={uForm.role} onChange={(e) => setUForm((f) => ({ ...f, role: e.target.value }))} className="input">
              {primaryRoles.map((k) => (
                <option key={k} value={k}>{ROLES[k].en} ({ROLES[k].np})</option>
              ))}
            </select>
            {uForm.role === 'developer' && (
              <p className="text-xs text-amber-400 mt-1">⚠ Developer has full system access.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Province</label>
              <select value={uForm.province} onChange={(e) => setUForm((f) => ({ ...f, province: e.target.value }))} className="input text-sm">
                <option value="">—</option>
                {PROVINCES.map((p) => <option key={p.id} value={p.name_en}>{lang === 'ne' ? p.name_np : p.name_en}</option>)}
              </select>
            </div>
            <div>
              <label className="label">District</label>
              <input value={uForm.district} onChange={(e) => setUForm((f) => ({ ...f, district: e.target.value }))} className="input text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Palika</label>
              <input value={uForm.palika} onChange={(e) => setUForm((f) => ({ ...f, palika: e.target.value }))} className="input text-sm" />
            </div>
            <div>
              <label className="label">Ward</label>
              <input type="number" value={uForm.ward_no} onChange={(e) => setUForm((f) => ({ ...f, ward_no: e.target.value }))} className="input text-sm" min="1" max="35" />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn-ghost" onClick={() => setEditUser(null)}>Cancel</button>
            <button className="btn-primary" disabled={updateUser.isPending}
              onClick={() => updateUser.mutate({ id: editUser.id, ...uForm })}>
              {updateUser.isPending ? <Spinner size="sm" /> : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Add User Modal (developer only) ── */}
      {isDeveloper && (
        <Modal open={addUserOpen} onClose={() => setAddUserOpen(false)} title="Add User">
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Name</label>
                <input value={newUser.name} onChange={(e) => setNewUser((f) => ({ ...f, name: e.target.value }))} className="input text-sm" placeholder="Full name" />
              </div>
              <div>
                <label className="label">Phone</label>
                <input value={newUser.phone} onChange={(e) => setNewUser((f) => ({ ...f, phone: e.target.value }))} className="input text-sm" placeholder="98XXXXXXXX" />
              </div>
            </div>
            <div>
              <label className="label">Email *</label>
              <input value={newUser.email} onChange={(e) => setNewUser((f) => ({ ...f, email: e.target.value }))} className="input text-sm" type="email" placeholder="user@example.com" required />
            </div>
            <div>
              <label className="label">Role</label>
              <select value={newUser.role} onChange={(e) => setNewUser((f) => ({ ...f, role: e.target.value }))} className="input text-sm">
                {primaryRoles.map((k) => (
                  <option key={k} value={k}>{ROLES[k].en}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Province</label>
                <select value={newUser.province} onChange={(e) => setNewUser((f) => ({ ...f, province: e.target.value }))} className="input text-sm">
                  <option value="">—</option>
                  {PROVINCES.map((p) => <option key={p.id} value={p.name_en}>{lang === 'ne' ? p.name_np : p.name_en}</option>)}
                </select>
              </div>
              <div>
                <label className="label">District</label>
                <input value={newUser.district} onChange={(e) => setNewUser((f) => ({ ...f, district: e.target.value }))} className="input text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Palika</label>
                <input value={newUser.palika} onChange={(e) => setNewUser((f) => ({ ...f, palika: e.target.value }))} className="input text-sm" />
              </div>
              <div>
                <label className="label">Ward</label>
                <input type="number" value={newUser.ward_no} onChange={(e) => setNewUser((f) => ({ ...f, ward_no: e.target.value }))} className="input text-sm" min="1" max="35" />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Note: this creates a sheet record only. The user still needs to sign in with this email to get a Supabase session.
            </p>
            <div className="flex gap-3 justify-end">
              <button className="btn-ghost" onClick={() => setAddUserOpen(false)}>Cancel</button>
              <button className="btn-primary" disabled={createUser.isPending || !newUser.email}
                onClick={() => createUser.mutate(newUser)}>
                {createUser.isPending ? <Spinner size="sm" /> : 'Create User'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Edit Report Modal ── */}
      <Modal open={!!editReport} onClose={() => setEditReport(null)}
        title={`Edit Report: ${editReport?.title || ''}`}>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="label">Title</label>
            <input value={rForm.title || ''} onChange={(e) => setRForm((f) => ({ ...f, title: e.target.value }))} className="input text-sm" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea value={rForm.description || ''} onChange={(e) => setRForm((f) => ({ ...f, description: e.target.value }))} className="input text-sm" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select value={rForm.category || 'other'} onChange={(e) => setRForm((f) => ({ ...f, category: e.target.value }))} className="input text-sm">
                {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Severity</label>
              <select value={rForm.severity || 'medium'} onChange={(e) => setRForm((f) => ({ ...f, severity: e.target.value }))} className="input text-sm">
                {Object.entries(SEVERITIES).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Status</label>
              <select value={rForm.status || 'open'} onChange={(e) => setRForm((f) => ({ ...f, status: e.target.value }))} className="input text-sm">
                {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.en} / {v.np}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Assigned To</label>
              <input value={rForm.assigned_to || ''} onChange={(e) => setRForm((f) => ({ ...f, assigned_to: e.target.value }))} className="input text-sm" placeholder="Officer name…" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Palika</label>
              <input value={rForm.palika || ''} onChange={(e) => setRForm((f) => ({ ...f, palika: e.target.value }))} className="input text-sm" />
            </div>
            <div>
              <label className="label">District</label>
              <input value={rForm.district || ''} onChange={(e) => setRForm((f) => ({ ...f, district: e.target.value }))} className="input text-sm" />
            </div>
            <div>
              <label className="label">Ward</label>
              <input type="number" value={rForm.ward_no || ''} onChange={(e) => setRForm((f) => ({ ...f, ward_no: e.target.value }))} className="input text-sm" min="1" max="35" />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <input value={rForm.address || ''} onChange={(e) => setRForm((f) => ({ ...f, address: e.target.value }))} className="input text-sm" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button className="btn-ghost" onClick={() => setEditReport(null)}>Cancel</button>
            <button className="btn-primary" disabled={updateReport.isPending}
              onClick={() => updateReport.mutate({ id: editReport.id, ...rForm })}>
              {updateReport.isPending ? <Spinner size="sm" /> : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
