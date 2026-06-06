import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LangContext'
import { useCreateReport, usePhotoUpload } from '../../hooks'
import { reportsApi } from '../../services/api'
import { CATEGORIES, SEVERITIES, PROVINCES, DISTRICTS_BY_PROVINCE, PALIKA_TYPES, DEPARTMENTS, MAP_DEFAULTS } from '../../utils/constants'
import { Spinner } from '../ui'
import { cn } from '../../utils/helpers'
import toast from 'react-hot-toast'

const pinIcon = L.divIcon({
  html: `<div style="width:24px;height:24px;background:#DC143C;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,.55)"></div>`,
  className: '', iconSize: [24, 24], iconAnchor: [12, 24],
})

function DragMarker({ position, onMove }) {
  useMapEvents({ click: (e) => onMove(e.latlng) })
  return position ? (
    <Marker position={position} icon={pinIcon} draggable
      eventHandlers={{ dragend: (e) => onMove(e.target.getLatLng()) }} />
  ) : null
}

export default function ReportForm() {
  const navigate   = useNavigate()
  const { user, profile } = useAuth()
  const { lang, tr } = useLang()
  const create     = useCreateReport()
  const { upload, uploading, fileIds } = usePhotoUpload()

  const [step,     setStep]     = useState(1)
  const [pos,      setPos]      = useState(null)
  const [addrNp,   setAddrNp]   = useState('')
  const [addrEn,   setAddrEn]   = useState('')
  const [detect,   setDetect]   = useState(false)
  const [dups,     setDups]     = useState([])
  const [province, setProvince] = useState(profile?.province || '')
  const [district, setDistrict] = useState(profile?.district || '')
  const [previews, setPreviews] = useState([])

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      category: 'road', severity: 'medium',
      title_np: '', title_en: '',
      description_np: '', description_en: '',
      palika: profile?.palika || '', palika_type: 'nagarpalika',
      ward_no: profile?.ward_no || '',
    },
  })

  useEffect(() => {
    setDetect(true)
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const latlng = { lat: p.coords.latitude, lng: p.coords.longitude }
        setPos(latlng); rgeo(latlng.lat, latlng.lng); setDetect(false)
      },
      () => setDetect(false),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, [])

  async function rgeo(lat, lng) {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ne,en`)
      const d = await r.json()
      setAddrEn(d.display_name?.split(',').slice(0, 4).join(', ') || '')
      setAddrNp(d.display_name?.split(',').slice(0, 3).join(', ') || '')
    } catch {}
  }

  function handleMapMove(ll) { setPos(ll); rgeo(ll.lat, ll.lng) }

  async function checkDups() {
    if (!pos || !watch('title_en') || watch('title_en').length < 5) return
    try { const r = await reportsApi.nearby(pos.lat, pos.lng, 100); if (r?.length) setDups(r) } catch {}
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files || []).slice(0, 5 - previews.length)
    setPreviews((p) => [...p, ...files.map((f) => ({ file: f, url: URL.createObjectURL(f) }))])
    upload(files)
  }

  async function onSubmit(data) {
    if (!pos) { toast.error('Please pin the location'); setStep(2); return }
    if (!user) { navigate('/login'); return }
    await create.mutateAsync({
      title_np: data.title_np, title_en: data.title_en || data.title_np,
      description_np: data.description_np, description_en: data.description_en || data.description_np,
      category: data.category, severity: data.severity,
      lat: pos.lat, lng: pos.lng,
      address_np: addrNp, address_en: addrEn,
      province, district,
      palika: data.palika, palika_type: data.palika_type,
      ward_no: data.ward_no,
      photo_ids: fileIds.join(','),
      submitted_by:    profile?.name_np || profile?.name_en || user.email,
      submitter_phone: profile?.phone || '',
      status: 'darta',
    })
    navigate('/')
  }

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="font-display text-xl font-bold text-white mb-2">{tr('loginRequired')}</h2>
        <p className="text-slate-400 text-sm mb-6">{tr('loginToReport')}</p>
        <button className="btn-nepal w-full justify-center" onClick={() => navigate('/login')}>{tr('signIn')}</button>
      </div>
    </div>
  )

  const steps = [{ n: 1, np: 'विवरण', en: 'Details' }, { n: 2, np: 'स्थान', en: 'Location' }, { n: 3, np: 'तस्वीर', en: 'Photos' }]
  const provinceObj = PROVINCES.find((p) => p.name_en === province)

  return (
    <div className="min-h-screen pt-4 pb-10 px-3">
      <div className="max-w-lg mx-auto">
        <div className="mb-5">
          <h1 className="font-display font-bold text-2xl text-white flex items-center gap-2">
            ➕ {lang === 'ne' ? 'समस्या रिपोर्ट' : 'Report Issue'}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {lang === 'ne' ? 'आफ्नो वडाको पूर्वाधार समस्या रिपोर्ट गर्नुहोस्।' : 'Report infrastructure issues in your ward.'}
          </p>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2 mb-5">
          {steps.map((s, i) => (
            <React.Fragment key={s.n}>
              <button onClick={() => step > s.n && setStep(s.n)}
                className={cn('flex items-center gap-1.5 text-sm transition-all',
                  step === s.n ? 'text-brand-400 font-medium' : step > s.n ? 'text-brand-600 cursor-pointer' : 'text-slate-600 cursor-default'
                )}>
                <span className={cn('w-5 h-5 rounded-full text-xs flex items-center justify-center font-mono font-bold',
                  step === s.n ? 'bg-brand-600 text-white' : step > s.n ? 'bg-brand-900 text-brand-400' : 'bg-slate-800 text-slate-600'
                )}>
                  {step > s.n ? '✓' : s.n}
                </span>
                {lang === 'ne' ? s.np : s.en}
              </button>
              {i < steps.length - 1 && <div className="flex-1 h-px bg-slate-800" />}
            </React.Fragment>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* ── Step 1 ── */}
          {step === 1 && (
            <div className="card p-5 space-y-4 animate-fade-in">
              {/* Category */}
              <div>
                <label className="label">{tr('category')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(CATEGORIES).map(([k, v]) => {
                    const sel = watch('category') === k
                    return (
                      <label key={k} className={cn(
                        'flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer text-sm transition-all',
                        sel ? `${v.bg} ${v.text} ${v.border}` : 'border-slate-700 text-slate-400 hover:border-slate-600'
                      )}>
                        <input type="radio" value={k} {...register('category')} className="sr-only" />
                        <span>{v.icon}</span>
                        <span>{lang === 'ne' ? v.np : v.en}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Title NP */}
              <div>
                <label className="label">{tr('titleNpLabel')} *</label>
                <input {...register('title_np', { required: lang === 'ne' ? 'शीर्षक आवश्यक छ' : 'Title is required' })}
                  className="input" placeholder={tr('titleNpPH')} />
                {errors.title_np && <p className="text-red-400 text-xs mt-1">{errors.title_np.message}</p>}
              </div>

              {/* Title EN */}
              <div>
                <label className="label">Title (English)</label>
                <input {...register('title_en')} className="input"
                  placeholder="e.g. Large pothole on main road" onBlur={checkDups} />
              </div>

              {/* Duplicate warning */}
              {dups.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <p className="text-yellow-400 text-sm font-medium mb-1">⚠️ {tr('dupWarning')}</p>
                  {dups.slice(0, 2).map((d) => (
                    <p key={d.id} className="text-xs text-slate-400">• {d.title_np || d.title_en}</p>
                  ))}
                  <button type="button" onClick={() => setDups([])}
                    className="text-xs text-brand-400 mt-1.5 hover:underline">{tr('continueAnyway')}</button>
                </div>
              )}

              {/* Desc NP */}
              <div>
                <label className="label">{tr('descNpLabel')} *</label>
                <textarea {...register('description_np', {
                  required: lang === 'ne' ? 'विवरण आवश्यक छ' : 'Description is required',
                  minLength: { value: 10, message: lang === 'ne' ? 'कम्तीमा १० अक्षर' : 'Min 10 characters' }
                })}
                  className="input resize-none" rows={3} placeholder={tr('descNpPH')} />
                {errors.description_np && <p className="text-red-400 text-xs mt-1">{errors.description_np.message}</p>}
              </div>

              {/* Desc EN */}
              <div>
                <label className="label">Description (English)</label>
                <textarea {...register('description_en')} className="input resize-none" rows={2}
                  placeholder="Describe the issue…" />
              </div>

              {/* Severity */}
              <div>
                <label className="label">{tr('severity')}</label>
                <div className="flex gap-2">
                  {Object.entries(SEVERITIES).map(([k, v]) => (
                    <label key={k} className={cn(
                      'flex-1 flex flex-col items-center gap-1 p-2.5 rounded-lg border cursor-pointer text-center transition-all',
                      watch('severity') === k ? `${v.bg} ${v.text} ${v.border}` : 'border-slate-700 text-slate-500 hover:border-slate-600'
                    )}>
                      <input type="radio" value={k} {...register('severity')} className="sr-only" />
                      <span className={cn('w-2.5 h-2.5 rounded-full', v.dot)} />
                      <span className="text-xs font-medium">{lang === 'ne' ? v.np : v.en}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Nepal admin hierarchy */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{tr('province')}</label>
                  <select value={province} onChange={(e) => { setProvince(e.target.value); setDistrict('') }}
                    className="input text-sm">
                    <option value="">{tr('selectOpt')}</option>
                    {PROVINCES.map((p) => (
                      <option key={p.id} value={p.name_en}>{lang === 'ne' ? p.name_np : p.name_en}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">{tr('district')}</label>
                  <select value={district} onChange={(e) => setDistrict(e.target.value)}
                    className="input text-sm" disabled={!province}>
                    <option value="">{tr('selectOpt')}</option>
                    {(DISTRICTS_BY_PROVINCE[provinceObj?.id] || []).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">{tr('palika')} *</label>
                  <input {...register('palika', { required: lang === 'ne' ? 'पालिका आवश्यक छ' : 'Palika is required' })}
                    className="input text-sm" placeholder={tr('palikaPHLabel')} />
                  {errors.palika && <p className="text-red-400 text-xs mt-1">{errors.palika.message}</p>}
                </div>
                <div>
                  <label className="label">{tr('ward')} *</label>
                  <input {...register('ward_no', { required: true })} type="number" min="1" max="35"
                    className="input text-sm" placeholder={tr('wardNoPH')} />
                </div>
              </div>

              <div>
                <label className="label">{tr('palikTypeLabel')}</label>
                <select {...register('palika_type')} className="input text-sm">
                  {Object.entries(PALIKA_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{lang === 'ne' ? v.np : v.en}</option>
                  ))}
                </select>
              </div>

              <button type="button" onClick={() => setStep(2)} className="btn-nepal w-full justify-center">
                {lang === 'ne' ? 'अर्को: स्थान →' : 'Next: Location →'}
              </button>
            </div>
          )}

          {/* ── Step 2: Location ── */}
          {step === 2 && (
            <div className="card overflow-hidden animate-fade-in">
              <div className="p-4 border-b border-slate-800">
                <p className="text-sm text-slate-300 font-medium">{tr('pinLocation')}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {detect ? tr('detectingLoc') : (addrEn || tr('clickMap'))}
                </p>
              </div>
              <div className="h-72 relative">
                {detect && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/60"><Spinner /></div>
                )}
                <MapContainer
                  center={pos ? [pos.lat, pos.lng] : MAP_DEFAULTS.center}
                  zoom={pos ? 15 : MAP_DEFAULTS.zoom}
                  style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <DragMarker position={pos ? [pos.lat, pos.lng] : null} onMove={handleMapMove} />
                </MapContainer>
              </div>
              {addrNp && (
                <div className="px-4 py-2 text-xs text-slate-500 border-t border-slate-800 bg-slate-900/30">{addrNp}</div>
              )}
              <div className="p-4 flex gap-2">
                <button type="button" className="btn-ghost flex-1 justify-center" onClick={() => setStep(1)}>
                  ← {tr('back')}
                </button>
                <button type="button" disabled={!pos} onClick={() => setStep(3)}
                  className="btn-nepal flex-1 justify-center disabled:opacity-40">
                  {lang === 'ne' ? 'अर्को: तस्वीर →' : 'Next: Photos →'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Photos & Submit ── */}
          {step === 3 && (
            <div className="card p-5 space-y-4 animate-fade-in">
              <div>
                <label className="label">{tr('photosOptional')}</label>
                <label className={cn(
                  'flex flex-col items-center justify-center h-28 border-2 border-dashed rounded-xl cursor-pointer transition-all',
                  previews.length >= 5 ? 'opacity-40 cursor-not-allowed' : 'border-slate-700 hover:border-brand-600 hover:bg-slate-800/30'
                )}>
                  <input type="file" accept="image/*" multiple className="sr-only"
                    disabled={previews.length >= 5} onChange={handleFileSelect} />
                  <span className="text-2xl mb-1">📸</span>
                  <span className="text-xs text-slate-400">{tr('addPhotos')}</span>
                  <span className="text-xs text-slate-600 mt-0.5">JPG, PNG · max 10MB</span>
                </label>
                {previews.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {previews.map((p, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-slate-800">
                        <img src={p.url} alt="" className="w-full h-full object-cover" />
                        {uploading && i === previews.length - 1 && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Spinner size="sm" /></div>
                        )}
                        <button type="button"
                          onClick={() => setPreviews((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-600/90 text-white text-xs flex items-center justify-center">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="bg-slate-800/40 rounded-lg p-3 space-y-1.5">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{tr('summaryTitle')}</p>
                {[
                  [lang === 'ne' ? 'श्रेणी' : 'Category', CATEGORIES[watch('category')]?.[lang === 'ne' ? 'np' : 'en']],
                  [lang === 'ne' ? 'गम्भीरता' : 'Severity', SEVERITIES[watch('severity')]?.[lang === 'ne' ? 'np' : 'en']],
                  [lang === 'ne' ? 'पालिका' : 'Palika', watch('palika')],
                  [lang === 'ne' ? 'वडा' : 'Ward', watch('ward_no')],
                  [lang === 'ne' ? 'तस्वीर' : 'Photos', `${fileIds.length} ${tr('uploaded')}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-slate-500">{k}</span>
                    <span className="text-slate-200">{v || '—'}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button type="button" className="btn-ghost flex-1 justify-center" onClick={() => setStep(2)}>
                  ← {tr('back')}
                </button>
                <button type="submit" disabled={create.isPending || uploading} className="btn-nepal flex-1 justify-center">
                  {create.isPending
                    ? <><Spinner size="sm" /> {tr('submitting')}</>
                    : `✓ ${tr('darta')}`
                  }
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
