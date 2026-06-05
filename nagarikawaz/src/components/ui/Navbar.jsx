import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useLang } from '../../context/LangContext'
import { RoleBadge } from './index'
import { cn } from '../../utils/helpers'

export default function Navbar() {
  const { user, profile, isOfficer, isLead, isAdmin, signOut } = useAuth()
  const { lang, toggleLang, tr } = useLang()
  const loc      = useLocation()
  const navigate = useNavigate()
  const [menu,   setMenu] = useState(false)

  const links = [
    { to: '/',           k: 'map',        icon: '🗺️',  show: true       },
    { to: '/feed',       k: 'feed',       icon: '📋',  show: true       },
    { to: '/report/new', k: 'report',     icon: '➕',  show: true       },
    { to: '/dashboard',  k: 'dashboard',  icon: '📊',  show: isOfficer  },
    { to: '/ai-reports', k: 'aiReports',  icon: '✨',  show: isLead     },
    { to: '/admin',      k: 'admin',      icon: '⚙️',  show: isAdmin    },
  ].filter(l => l.show)

  const active = (to) => to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to)

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 glass border-b border-emerald-900/30">
      {/* Nepal flag stripe */}
      <div className="h-[2px] flex">
        <div className="flex-1" style={{background:'#DC143C'}} />
        <div className="flex-1" style={{background:'#003893'}} />
      </div>

      {/* Main bar */}
      <div className="px-4 flex items-center justify-between gap-3" style={{height:52}}>
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 py-1">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm"
            style={{background:'linear-gradient(135deg,#DC143C 50%,#003893 50%)'}}>
            न
          </div>
          <div className="hidden sm:block">
            <div className="font-display font-bold text-white text-[15px] leading-tight tracking-tight">
              {lang === 'ne' ? 'नागरिक आवाज' : 'NagarikAwaz'}
            </div>
            <div className="text-brand-500 text-[10px] leading-none">
              {lang === 'ne' ? 'NagarikAwaz' : 'Nepal Civic Platform'}
            </div>
          </div>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {links.map(l => (
            <Link key={l.to} to={l.to}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all',
                active(l.to)
                  ? 'bg-brand-600/20 text-brand-400 border border-brand-600/25'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              )}>
              <span className="text-base leading-none">{l.icon}</span>
              {tr(l.k)}
            </Link>
          ))}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Language pill */}
          <button onClick={toggleLang}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700/60 text-slate-400 hover:border-brand-700 hover:text-brand-400 transition-all text-xs font-medium">
            <span>{lang === 'ne' ? '🇬🇧' : '🇳🇵'}</span>
            <span>{lang === 'ne' ? 'EN' : 'नेपाली'}</span>
          </button>

          {user ? (
            <div className="relative">
              <button onClick={() => setMenu(!menu)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-all">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-700 to-brand-900 border border-brand-700/50 flex items-center justify-center text-sm font-bold text-brand-200">
                  {((profile?.name_np||profile?.name_en||profile?.email||'?')[0]||'?').toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-medium text-slate-200 leading-tight max-w-[100px] truncate">
                    {profile?.name_en || profile?.name_np || user.email?.split('@')[0]}
                  </p>
                  <p className="text-xs text-slate-500 leading-none capitalize">
                    {profile?.role?.replace(/_/g,' ') || 'citizen'}
                  </p>
                </div>
                <span className="text-slate-600 text-xs hidden sm:block">▾</span>
              </button>

              {menu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-60 card-solid border border-slate-700/60 py-1 shadow-2xl z-50 animate-fade-in rounded-2xl overflow-hidden">
                    {/* Profile header */}
                    <div className="px-4 py-3 border-b border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-700 to-brand-900 flex items-center justify-center text-base font-bold text-brand-200">
                          {((profile?.name_np||profile?.name_en||'?')[0]||'?').toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {profile?.name_en || profile?.name_np || '—'}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                          {profile?.palika && (
                            <p className="text-xs text-brand-500 mt-0.5 truncate">
                              {profile.palika}{profile.ward_no ? ` · W-${profile.ward_no}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-2"><RoleBadge role={profile?.role} /></div>
                    </div>

                    {[
                      { to:'/my-reports', icon:'📋', k:'myReports' },
                      { to:'/settings',   icon:'⚙️', k:'settings'  },
                    ].map(i => (
                      <Link key={i.to} to={i.to} onClick={() => setMenu(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors">
                        <span className="text-base">{i.icon}</span> {tr(i.k)}
                      </Link>
                    ))}
                    <div className="border-t border-slate-800 mt-1 pt-1">
                      <button onClick={() => { signOut(); setMenu(false) }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                        <span className="text-base">🚪</span> {tr('signOut')}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button className="btn-nepal py-2 px-4 text-sm" onClick={() => navigate('/login')}>
              {tr('signIn')}
            </button>
          )}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden flex border-t border-slate-800/50 overflow-x-auto scrollbar-hide">
        {links.map(l => (
          <Link key={l.to} to={l.to}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 py-2 text-xs flex-shrink-0 min-w-[56px] transition-all',
              active(l.to)
                ? 'text-brand-400 bg-brand-900/20 border-t-2 border-brand-500 -mt-px'
                : 'text-slate-500 hover:text-slate-300'
            )}>
            <span className="text-lg leading-none">{l.icon}</span>
            <span className="leading-none">{tr(l.k)}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
