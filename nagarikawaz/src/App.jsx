import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LangProvider, useLang } from './context/LangContext'
import { ErrorBoundary, LoadingScreen } from './components/ui'
import Navbar from './components/ui/Navbar'

const MapPage       = lazy(() => import('./pages/MapPage'))
const FeedPage      = lazy(() => import('./pages/FeedPage'))
const ReportNew     = lazy(() => import('./pages/ReportNewPage'))
const ReportDetail  = lazy(() => import('./pages/ReportDetailPage'))
const MyReports     = lazy(() => import('./pages/MyReportsPage'))
const Dashboard     = lazy(() => import('./pages/DashboardPage'))
const AIReports     = lazy(() => import('./pages/AIReportsPage'))
const AdminPage     = lazy(() => import('./pages/AdminPage'))
const WeeklyReports = lazy(() => import('./pages/WeeklyReportsPage'))
const LoginPage     = lazy(() => import('./pages/LoginPage'))
const RegisterPage  = lazy(() => import('./pages/RegisterPage'))
const SettingsPage  = lazy(() => import('./pages/SettingsPage'))
const AuthCallback  = lazy(() => import('./pages/AuthCallback'))
const NotFoundPage  = lazy(() => import('./pages/NotFoundPage'))


function FloatingReportButton() {
  const { pathname } = useLocation()
  const navigate     = useNavigate()
  const { user }     = useAuth()
  const { lang }     = useLang()

  const hidden = pathname === '/report/new' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/weekly-reports')

  if (hidden) return null

  return (
    <button
      onClick={() => navigate(user ? '/report/new' : '/login')}
      title="Report an issue"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-full text-white font-semibold text-sm transition-all hover:scale-105 active:scale-95 md:bottom-8 md:left-auto md:right-6 md:translate-x-0"
      style={{
        background: 'linear-gradient(135deg, #e8183e 0%, #9b0b27 100%)',
        boxShadow: '0 6px 28px rgba(220,20,60,0.55), 0 2px 8px rgba(0,0,0,0.35)',
      }}
    >
      <span className="text-base leading-none">📢</span>
      <span>{lang === 'ne' ? 'समस्या रिपोर्ट' : 'Report Issue'}</span>
    </button>
  )
}

function ProtectedRoute({ children, minRole = 'nagarik' }) {
  const { user, loading, hasPermission } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user)   return <Navigate to="/login" replace />
  if (!hasPermission(minRole)) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { loading } = useAuth()
  if (loading) return <LoadingScreen />

  // Mobile: top navbar (50px) + bottom nav (~40px) = ~90px total
  // Desktop: just top bar = 50px + flag stripe 3px
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1" style={{ paddingTop: 'calc(53px + 48px)' }} id="main-content">
        <style>{`@media(min-width:768px){#main-content{padding-top:56px}}`}</style>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/"              element={<MapPage />} />
            <Route path="/feed"           element={<FeedPage />} />
            <Route path="/weekly-reports" element={<WeeklyReports />} />
            <Route path="/report/:id"    element={<ReportDetail />} />
            <Route path="/login"         element={<LoginPage />} />
            <Route path="/register"      element={<RegisterPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            <Route path="/report/new" element={<ProtectedRoute><ReportNew /></ProtectedRoute>} />
            <Route path="/my-reports" element={<ProtectedRoute><MyReports /></ProtectedRoute>} />
            <Route path="/settings"   element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

            <Route path="/dashboard"  element={<ProtectedRoute minRole="wada_adhikrit"><Dashboard /></ProtectedRoute>} />
            <Route path="/ai-reports" element={<ProtectedRoute minRole="palika_pramukh"><AIReports /></ProtectedRoute>} />
            <Route path="/admin"      element={<ProtectedRoute minRole="admin"><AdminPage /></ProtectedRoute>} />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
      <FloatingReportButton />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <LangProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </LangProvider>
    </ErrorBoundary>
  )
}
