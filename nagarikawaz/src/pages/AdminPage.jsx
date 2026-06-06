import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../services/api'
import { useLang } from '../context/LangContext'
import { RoleBadge, Spinner, EmptyState, Modal } from '../components/ui'
import { ROLES, PROVINCES } from '../utils/constants'
import { formatDate } from '../utils/helpers'
import toast from 'react-hot-toast'

export default function AdminPage() {
  const { lang, tr } = useLang()
  const qc = useQueryClient()
  const { data: users, isLoading } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })
  const [search,   setSearch]   = useState('')
  const [editUser, setEditUser] = useState(null)
  const [form,     setForm]     = useState({ role: '', province: '', district: '', palika: '', ward_no: '' })

  const updateRole = useMutation({
    mutationFn: ({ id, ...data }) => usersApi.updateRole(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('Updated'); setEditUser(null) },
    onError: () => toast.error('Update failed'),
  })

  const filtered = (users || []).filter((u) =>
    !search ||
    (u.name_np||'').toLowerCase().includes(search.toLowerCase()) ||
    (u.name_en||'').toLowerCase().includes(search.toLowerCase()) ||
    (u.email||'').toLowerCase().includes(search.toLowerCase())
  )

  const roleCounts = Object.keys(ROLES).reduce((acc, r) => ({
    ...acc, [r]: (users||[]).filter((u) => u.role === r).length,
  }), {})

  function openEdit(u) {
    setEditUser(u)
    setForm({ role: u.role || 'nagarik', province: u.province || '', district: u.district || '', palika: u.palika || '', ward_no: u.ward_no || '' })
  }

  return (
    <div className="page-wrap">
      <div className="mb-5">
        <h1 className="font-display font-bold text-2xl text-white">{tr('userMgmt')}</h1>
        <p className="text-slate-500 text-sm mt-0.5">{users?.length || 0} {tr('registered')}</p>
      </div>

      {/* Role summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-6">
        {Object.entries(ROLES).map(([k, v]) => (
          <div key={k} className="card p-3 text-center">
            <div className={`font-display text-xl font-bold ${v.color}`}>{roleCounts[k] || 0}</div>
            <div className="text-xs text-slate-500 mt-0.5 leading-tight">{lang === 'ne' ? v.np : v.en}</div>
          </div>
        ))}
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder={lang === 'ne' ? 'नाम वा इमेलले खोज्नुहोस्…' : 'Search by name or email…'}
        className="input text-sm mb-4 max-w-sm" />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="👥" title="No users found" />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50">
                  {['User','Role','Location','Joined',''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-slate-500 font-medium uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-900 border border-brand-800 flex items-center justify-center text-xs font-bold text-brand-400">
                          {((u.name_np||u.name_en||u.email||'?')[0]||'?').toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-200">{u.name_np || u.name_en || '—'}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                          {u.phone && <p className="text-xs text-slate-600">{u.phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {u.palika && <div className="font-medium">{u.palika}</div>}
                      {u.ward_no && <div>{lang === 'ne' ? 'वडा' : 'Ward'} {u.ward_no}</div>}
                      {u.district && <div className="text-slate-600">{u.district}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {u.created_at ? formatDate(u.created_at).split(',')[0] : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => openEdit(u)} className="text-xs text-brand-400 hover:text-brand-300">
                        {lang === 'ne' ? 'सम्पादन' : 'Edit'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={!!editUser} onClose={() => setEditUser(null)}
        title={`${lang === 'ne' ? 'प्रयोगकर्ता सम्पादन' : 'Edit User'}: ${editUser?.name_np || editUser?.name_en || ''}`}>
        <div className="p-5 space-y-4">
          <div>
            <label className="label">{tr('role')}</label>
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="input">
              {Object.entries(ROLES).map(([k, v]) => (
                <option key={k} value={k}>{v.en} ({v.np})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{tr('province')}</label>
              <select value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} className="input text-sm">
                <option value="">—</option>
                {PROVINCES.map((p) => <option key={p.id} value={p.name_en}>{lang === 'ne' ? p.name_np : p.name_en}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{tr('district')}</label>
              <input value={form.district} onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))} className="input text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{tr('palika')}</label>
              <input value={form.palika} onChange={(e) => setForm((f) => ({ ...f, palika: e.target.value }))} className="input text-sm" />
            </div>
            <div>
              <label className="label">{tr('ward')}</label>
              <input type="number" value={form.ward_no} onChange={(e) => setForm((f) => ({ ...f, ward_no: e.target.value }))} className="input text-sm" min="1" max="35" />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn-ghost" onClick={() => setEditUser(null)}>{tr('cancel')}</button>
            <button className="btn-primary" disabled={updateRole.isPending}
              onClick={() => updateRole.mutate({ id: editUser.id, ...form })}>
              {updateRole.isPending ? <Spinner size="sm" /> : tr('save')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
