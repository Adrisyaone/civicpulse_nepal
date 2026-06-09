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
  const [menu, setMenu] = useState(false)

  // Links that appear as flat items (desktop + mobile)
  const flatLinks = [
    { to: '/',               k: 'map',           icon: '🗺️', show: true      },
    { to: '/weekly-reports', k: 'weeklySummary', icon: '📊', show: true      },
    { to: '/report/new',     k: 'report',        icon: '➕', show: true      },
    { to: '/dashboard',      k: 'dashboard',     icon: '📈', show: true      },
    { to: '/ai-reports',     k: 'aiReports',     icon: '✨', show: isLead    },
    { to: '/admin',          k: 'admin',         icon: '⚙️', show: isAdmin   },
  ].filter((l) => l.show)

  // All links for mobile bottom nav (flat)
  const mobileLinks = [
    { to: '/',               k: 'map',          icon: '🗺️', show: true      },
    { to: '/feed',           k: 'news',         icon: '📰', show: true      },
    { to: '/weekly-reports', k: 'weeklySummary',icon: '📊', show: true      },
    { to: '/report/new',     k: 'report',       icon: '➕', show: true      },
    { to: '/dashboard',      k: 'dashboard',    icon: '📈', show: true      },
    { to: '/ai-reports',     k: 'aiReports',    icon: '✨', show: isLead    },
    { to: '/admin',          k: 'admin',        icon: '⚙️', show: isAdmin   },
  ].filter((l) => l.show)

  const active = (to) => to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to)

  function NavLink({ to, icon, label }) {
    return (
      <Link to={to}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
          active(to)
            ? 'bg-brand-600/20 text-brand-400 border border-brand-600/30'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
        )}>
        {icon} {label}
      </Link>
    )
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 glass border-b border-brand-900/50">
      {/* Nepal flag stripe */}
      <div className="flex h-[3px]">
        <div className="flex-1" style={{ background: '#DC143C' }} />
        <div className="flex-1" style={{ background: '#003893' }} />
      </div>

      {/* Main bar */}
      <div className="max-w-7xl mx-auto px-3 flex items-center justify-between gap-3" style={{ height: 50 }}>
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm font-display"
            style={{ background: 'linear-gradient(135deg, #DC143C 50%, #003893 50%)' }}>
            न
          </div>
          <div className="hidden sm:block leading-tight">
            <div className="font-display font-bold text-white text-[15px]">{lang === 'ne' ? 'नागरिक आवाज' : 'NagarikAwaz'}</div>
            <div className="text-brand-500 text-[10px] -mt-0.5">{lang === 'ne' ? 'NagarikAwaz' : 'Citizen Voice'}</div>
          </div>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
          {flatLinks.map((l) => (
            <NavLink key={l.to} to={l.to} icon={l.icon} label={tr(l.k)} />
          ))}
        </div>

        {/* Right */}
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={toggleLang}
            className="text-xs px-2 py-1 rounded-lg border border-slate-700 text-slate-400 hover:border-brand-700 hover:text-brand-400 transition-all font-mono">
            {lang === 'ne' ? 'EN' : 'नेपाली'}
          </button>

          {user ? (
            <div className="relative">
              <button onClick={() => setMenu(!menu)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-all">
                <div className="w-7 h-7 rounded-full bg-brand-800 border border-brand-700 flex items-center justify-center text-xs font-bold text-brand-300">
                  {((profile?.name_np || profile?.name_en || profile?.email || '?')[0] || '?').toUpperCase()}
                </div>
                <span className="hidden sm:block text-sm text-slate-300 max-w-[90px] truncate">
                  {profile?.name_np || profile?.name_en || user.email}
                </span>
                <span className="text-slate-600 text-xs">▾</span>
              </button>

              {menu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 card py-1 shadow-xl z-50 animate-fade-in">
                    <div className="px-4 py-3 border-b border-slate-800">
                      <p className="text-sm font-medium text-slate-200 truncate">
                        {profile?.name_np || profile?.name_en || '—'}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      {profile?.palika && (
                        <p className="text-xs text-brand-500 mt-0.5">
                          {profile.palika}{profile.ward_no ? ` · ${lang === 'ne' ? 'वडा' : 'Ward'} ${profile.ward_no}` : ''}
                        </p>
                      )}
                      <div className="mt-1.5"><RoleBadge role={profile?.role} /></div>
                    </div>
                    {[{ to: '/my-reports', icon: '📋', k: 'myReports' }, { to: '/settings', icon: '⚙️', k: 'settings' }].map((i) => (
                      <Link key={i.to} to={i.to} onClick={() => setMenu(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white">
                        {i.icon} {tr(i.k)}
                      </Link>
                    ))}
                    <div className="border-t border-slate-800 mt-1 pt-1">
                      <button onClick={() => { signOut(); setMenu(false) }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10">
                        🚪 {tr('signOut')}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button className="btn-nepal py-1.5 text-sm" onClick={() => navigate('/login')}>
              {tr('signIn')}
            </button>
          )}
        </div>
      </div>

      {/* Mobile bottom nav — all links flat */}
      <div className="md:hidden flex border-t border-slate-800/60">
        {mobileLinks.map((l) => (
          <Link key={l.to} to={l.to}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 py-2.5 text-xs font-medium transition-all min-h-[44px]',
              active(l.to) ? 'text-brand-400 bg-brand-900/30' : 'text-slate-500'
            )}>
            <span className="text-lg leading-none">{l.icon}</span>
            <span className="leading-none mt-0.5">{tr(l.k)}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
