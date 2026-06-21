import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReports } from '../hooks'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { StatCard, Spinner, EmptyState } from '../components/ui'
import ReportCard from '../components/reports/ReportCard'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { CATEGORIES, SEVERITIES, STATUSES, PROVINCES } from '../utils/constants'
import { driveThumb } from '../utils/helpers'

const TT = {
  contentStyle: { background:'#0d1a0f', border:'1px solid #1f7350', borderRadius:'8px', color:'#e8f5ee', fontFamily:'Mukta' },
}

function PhotoCollage({ reports }) {
  const navigate = useNavigate()
  const photos = []
  for (const r of reports) {
    const ids = Array.isArray(r.photo_ids) ? r.photo_ids : (r.photo_ids || '').split(',').filter(Boolean)
    for (const fid of ids) {
      photos.push({ fid, reportId: r.id, title: r.title || '' })
      if (photos.length >= 24) break
    }
    if (photos.length >= 24) break
  }
  if (photos.length === 0) return null
  return (
    <div className="mb-6">
      <h2 className="font-display font-semibold text-slate-300 text-sm mb-3">📸 Recent Photos</h2>
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-1.5">
        {photos.map(({ fid, reportId, title }, i) => (
          <div key={`${fid}-${i}`} onClick={() => navigate(`/report/${reportId}`)}
            className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-brand-500 bg-slate-800 relative group">
            <img
              src={driveThumb(fid, 200)}
              alt={title}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              onError={(e) => { e.target.parentElement.style.display = 'none' }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { profile }  = useAuth()
  const { lang, tr } = useLang()
  const [province, setProvince] = useState(profile?.province || '')
  const { data: reports, isLoading } = useReports({ province })

  const open     = (reports||[]).filter((r)=>!['resolved','closed'].includes(r.status))
  const critical = (reports||[]).filter((r)=>r.severity==='critical'&&!['resolved','closed'].includes(r.status))

  const catData = Object.entries(CATEGORIES).map(([k,v])=>({
    name: lang==='ne'?v.np:v.en,
    count: (reports||[]).filter((r)=>r.category===k).length,
    color: v.color,
  })).filter((d)=>d.count>0)

  const statusData = Object.entries(STATUSES).map(([k,v])=>({
    name: lang==='ne'?v.np:v.en,
    count: (reports||[]).filter((r)=>r.status===k).length,
  })).filter((d)=>d.count>0)

  const sevData = Object.entries(SEVERITIES).map(([k,v])=>({
    name: lang==='ne'?v.np:v.en,
    count: (reports||[]).filter((r)=>r.severity===k).length,
    color: v.color,
    pct:  reports?.length ? Math.round((reports||[]).filter((r)=>r.severity===k).length/reports.length*100) : 0,
  }))

  return (
    <div className="page-wrap">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">{tr('govDashboard')}</h1>
          <p className="text-slate-500 text-sm">{province || tr('allProvinces2')}</p>
        </div>
        <select value={province} onChange={(e)=>setProvince(e.target.value)} className="input text-sm w-44">
          <option value="">{tr('allProvinces')}</option>
          {PROVINCES.map((p)=><option key={p.id} value={p.name_en}>{lang==='ne'?p.name_np:p.name_en}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard labelKey="totalReports"  value={reports?.length??'—'} icon="📋" loading={isLoading} color="text-white" />
        <StatCard labelKey="openIssues"    value={open.length}          icon="🔓" loading={isLoading} color="text-orange-400" />
        <StatCard labelKey="critical"      value={critical.length}      icon="🚨" loading={isLoading} color="text-red-400" />
        <StatCard labelKey="resolvedStat"  value={(reports||[]).filter((r)=>r.status==='resolved').length} icon="✅" loading={isLoading} color="text-brand-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <div className="card p-5">
          <h3 className="section-title mb-4">{tr('byCategory')}</h3>
          {isLoading ? <div className="shimmer h-48 rounded-lg" /> : catData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-600 text-sm">{tr('noData')}</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart><Pie data={catData} cx="50%" cy="50%" innerRadius={44} outerRadius={68} dataKey="count" paddingAngle={2}>
                  {catData.map((d,i)=><Cell key={i} fill={d.color} />)}
                </Pie><Tooltip {...TT} /></PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {catData.slice(0,4).map((d)=>(
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{background:d.color}}/><span className="text-slate-400">{d.name}</span></div>
                    <span className="font-mono text-slate-300">{d.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card p-5">
          <h3 className="section-title mb-4">{tr('byStatus')}</h3>
          {isLoading ? <div className="shimmer h-48 rounded-lg" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusData} layout="vertical" barSize={10}>
                <XAxis type="number" tick={{fill:'#4b5563',fontSize:9}} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{fill:'#6b7280',fontSize:9}} axisLine={false} tickLine={false} width={80} />
                <Tooltip {...TT} />
                <Bar dataKey="count" fill="#2d9265" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <h3 className="section-title mb-4">{tr('bySeverity')}</h3>
          {isLoading ? <div className="shimmer h-48 rounded-lg" /> : (
            <div className="space-y-4 mt-4">
              {sevData.map((s)=>(
                <div key={s.name}>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{background:s.color}}/>{s.name}</div>
                    <span className="font-mono">{s.count} ({s.pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{width:`${s.pct}%`,background:s.color}} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Photo collage */}
      {!isLoading && <PhotoCollage reports={reports || []} />}

      {critical.length > 0 && (
        <div className="mb-6">
          <h2 className="font-display font-semibold text-red-400 text-sm mb-3 flex items-center gap-2">
            🚨 {tr('criticalIssues')}
            <span className="font-mono text-xs bg-red-500/20 px-2 py-0.5 rounded-full">{critical.length}</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {critical.slice(0,6).map((r)=><ReportCard key={r.id} report={r} compact />)}
          </div>
        </div>
      )}

      <div>
        <h2 className="font-display font-semibold text-slate-300 text-sm mb-3">⚡ {tr('topPriority')}</h2>
        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner size="lg" /></div>
        ) : open.length === 0 ? (
          <EmptyState icon="✅" title={tr('allClear')} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {open.sort((a,b)=>(b.priority_score||0)-(a.priority_score||0)).slice(0,9).map((r)=><ReportCard key={r.id} report={r} compact />)}
          </div>
        )}
      </div>
    </div>
  )
}
