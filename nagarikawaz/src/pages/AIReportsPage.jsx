import React, { useState } from 'react'
import { useGenerateAIReport, useAIReports } from '../hooks'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { Spinner, EmptyState } from '../components/ui'
import { PROVINCES } from '../utils/constants'
import { NEPAL_GEO } from '../utils/nepalGeo'
import { formatDate } from '../utils/helpers'

export default function AIReportsPage() {
  const { profile }  = useAuth()
  const { lang, tr } = useLang()
  const [province, setProvince] = useState(profile?.province || '')
  const [district, setDistrict] = useState(profile?.district || '')
  const [palika,   setPalika]   = useState(profile?.palika   || '')
  const [selected, setSelected] = useState(null)
  const generate = useGenerateAIReport()
  const { data: reports, isLoading } = useAIReports()
  const provinceObj = PROVINCES.find((p) => p.name_en === province)

  async function handleGenerate() {
    const result = await generate.mutateAsync({ province, district, palika })
    if (result) setSelected(result)
  }

  return (
    <div className="page-wrap max-w-4xl">
      <div className="mb-5">
        <h1 className="font-display font-bold text-2xl text-white flex items-center gap-2">✨ {lang==='ne'?'Gemini AI रिपोर्ट':'Gemini AI Reports'}</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {lang==='ne'?'Gemini AI ले सबै रिपोर्ट विश्लेषण गरी नेपाली र अंग्रेजीमा कार्यकारी सारांश तयार गर्छ।':'Gemini AI analyzes all reports and generates bilingual executive summaries.'}
        </p>
      </div>

      <div className="card p-5 mb-6 border-brand-800/40">
        <h2 className="section-title mb-4">{lang==='ne'?'AI रिपोर्ट बनाउनुहोस्':'Generate AI Report'}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="label">{tr('province')}</label>
            <select value={province} onChange={(e)=>{setProvince(e.target.value);setDistrict('');setPalika('')}} className="input text-sm">
              <option value="">{tr('allProvinces')}</option>
              {PROVINCES.map((p)=><option key={p.id} value={p.name_en}>{lang==='ne'?p.name_np:p.name_en}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{tr('district')}</label>
            <select value={district} onChange={(e)=>{setDistrict(e.target.value);setPalika('')}} className="input text-sm" disabled={!province}>
              <option value="">{lang==='ne'?'सबै जिल्ला':'All Districts'}</option>
              {Object.keys(NEPAL_GEO[provinceObj?.id]||{}).map((d)=><option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label">{tr('palika')}</label>
            <input value={palika} onChange={(e)=>setPalika(e.target.value)} className="input text-sm"
              placeholder={lang==='ne'?'पालिकाको नाम…':'Palika name…'} disabled={!district} />
          </div>
        </div>

        <button onClick={handleGenerate} disabled={generate.isPending} className="btn-primary py-2.5 px-6">
          {generate.isPending
            ? <><Spinner size="sm" /> {tr('geminiAnalyzing')}</>
            : `✨ ${tr('generate')}`
          }
        </button>

        {generate.isPending && (
          <div className="mt-4 bg-brand-900/20 border border-brand-800/30 rounded-lg p-4 space-y-1">
            {[
              lang==='ne'?'• सबै रिपोर्ट पढ्दैछ…':'• Reading all reports…',
              lang==='ne'?'• AI प्राथमिकता स्कोर गणना…':'• Computing priority scores…',
              lang==='ne'?'• Gemini ले नेपाली र अंग्रेजीमा सारांश बनाउँदैछ…':'• Gemini generating bilingual summary…',
              lang==='ne'?'• Google Drive मा सुरक्षित गर्दैछ…':'• Saving to Google Drive…',
            ].map((s,i)=><p key={i} className="text-xs text-slate-500">{s}</p>)}
          </div>
        )}

        {generate.data && !generate.isPending && (
          <div className="mt-4 bg-brand-900/20 border border-brand-700/30 rounded-lg p-4">
            <p className="text-brand-400 font-medium text-sm mb-2">✅ {tr('aiGenerated')}</p>
            {generate.data.docUrl && (
              <a href={generate.data.docUrl} target="_blank" rel="noreferrer" className="btn-primary text-sm">
                📄 {tr('openDoc')} ↗
              </a>
            )}
          </div>
        )}
      </div>

      <h2 className="section-title mb-3">{tr('prevReports')}</h2>
      {isLoading ? <div className="flex justify-center py-10"><Spinner size="lg" /></div>
        : !reports?.length ? <EmptyState icon="✨" titleKey="noAIReports" />
        : (
          <div className="space-y-3">
            {reports.map((r,i)=>(
              <div key={i} className="card-hover p-4 flex items-center justify-between gap-4" onClick={()=>setSelected(r)}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-900/50 border border-brand-800/40 flex items-center justify-center flex-shrink-0">📊</div>
                  <div>
                    <p className="font-medium text-slate-200 text-sm">{r.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatDate(r.created_at)} · {r.report_count||'?'} {tr('analyzed')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {r.docUrl && <a href={r.docUrl} target="_blank" rel="noreferrer" onClick={(e)=>e.stopPropagation()} className="text-brand-400 hover:text-brand-300 text-xs hover:underline">{tr('docLink')} ↗</a>}
                  <span className="text-slate-600">→</span>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {selected?.summary && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-5 py-4 flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-white">✨ AI {lang==='ne'?'रिपोर्ट':'Report'}</h2>
              <button onClick={()=>setSelected(null)} className="text-slate-500 hover:text-white text-2xl">×</button>
            </div>
            <div className="p-6 space-y-5">
              {[
                ['exec', selected.summary.executive_summary],
                ['trends', selected.summary.trends],
                ['budget', selected.summary.budget_recommendations],
              ].filter(([,v])=>v).map(([k,v])=>(
                <section key={k}>
                  <h3 className="font-display font-semibold text-brand-400 mb-2">{tr(k)}</h3>
                  <p className="text-slate-300 text-sm leading-relaxed">{v}</p>
                </section>
              ))}

              {selected.summary.priorities?.length > 0 && (
                <section>
                  <h3 className="font-display font-semibold text-brand-400 mb-3">{tr('priority')} {lang==='ne'?'कार्यहरू':'Actions'}</h3>
                  <div className="space-y-2">
                    {selected.summary.priorities.map((p,i)=>(
                      <div key={i} className="flex gap-3 bg-slate-800/40 rounded-lg p-3">
                        <div className="w-6 h-6 rounded-full bg-brand-700 text-brand-200 text-xs font-bold flex items-center justify-center flex-shrink-0">{i+1}</div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-200">{p.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{p.reason}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="font-mono text-sm font-bold text-orange-400">{p.score}</span>
                          <p className="text-xs text-slate-600">{tr('score')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {selected.summary.recommended_actions?.length > 0 && (
                <section>
                  <h3 className="font-display font-semibold text-brand-400 mb-2">{tr('actions')}</h3>
                  <ul className="space-y-1">
                    {selected.summary.recommended_actions.map((a,i)=>(
                      <li key={i} className="flex gap-2 text-sm text-slate-300"><span className="text-brand-500 flex-shrink-0">•</span>{a}</li>
                    ))}
                  </ul>
                </section>
              )}

              {selected.docUrl && (
                <a href={selected.docUrl} target="_blank" rel="noreferrer" className="btn-primary w-full justify-center">
                  📄 {tr('openDoc')} ↗
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
