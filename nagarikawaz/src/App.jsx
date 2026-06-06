import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LangProvider } from './context/LangContext'
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
const LoginPage     = lazy(() => import('./pages/LoginPage'))
const RegisterPage  = lazy(() => import('./pages/RegisterPage'))
const SettingsPage  = lazy(() => import('./pages/SettingsPage'))
const AuthCallback  = lazy(() => import('./pages/AuthCallback'))
const NotFoundPage  = lazy(() => import('./pages/NotFoundPage'))

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
            <Route path="/feed"          element={<FeedPage />} />
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
