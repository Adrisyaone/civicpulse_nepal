import React from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../context/LangContext'

export default function NotFoundPage() {
  const { tr } = useLang()
  return (
    <div className="min-h-screen flex items-center justify-center p-4 text-center">
      <div>
        <div className="text-7xl mb-4">🗺️</div>
        <h1 className="font-display font-bold text-4xl text-white mb-2">404</h1>
        <p className="text-slate-400 mb-6">{tr('notFound')}</p>
        <Link to="/" className="btn-primary">← {tr('backToMap')}</Link>
      </div>
    </div>
  )
}
