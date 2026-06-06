import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reportsApi, commentsApi, progressApi, aiApi, uploadPhoto } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

// ── Geolocation ───────────────────────────────────────────────────────────────
export function useGeolocation() {
  const [location, setLocation] = useState(null)
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)

  const get = useCallback(() => {
    if (!navigator.geolocation) { setError('Geolocation not supported'); return }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocation({ lat: p.coords.latitude, lng: p.coords.longitude }); setLoading(false); setError(null) },
      (e) => { setError(e.message); setLoading(false) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  useEffect(() => { get() }, [get])
  return { location, error, loading, getLocation: get }
}

// ── Reports ───────────────────────────────────────────────────────────────────
export function useReports(filters = {}, options = {}) {
  return useQuery({ queryKey: ['reports', filters], queryFn: () => reportsApi.list(filters), staleTime: 120000, retry: 2, ...options })
}

export function useReport(id) {
  return useQuery({ queryKey: ['report', id], queryFn: () => reportsApi.get(id), enabled: !!id })
}

export function useCreateReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => reportsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success('रिपोर्ट दर्ता भयो! / Report submitted!') },
    onError: (e) => toast.error(e?.error || 'Submit failed'),
  })
}

export function useUpdateReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => reportsApi.update(id, data),
    onSuccess: (_, { id }) => { qc.invalidateQueries({ queryKey: ['reports'] }); qc.invalidateQueries({ queryKey: ['report', id] }); toast.success('Updated') },
    onError: () => toast.error('Update failed'),
  })
}

export function useUpvoteReport() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: (id) => reportsApi.upvote(id, user?.id),
    onSuccess:  (_, id) => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      qc.invalidateQueries({ queryKey: ['report', id] })
    },
    onError: () => toast.error('Upvote failed'),
  })
}

// ── Comments ──────────────────────────────────────────────────────────────────
export function useComments(reportId) {
  return useQuery({ queryKey: ['comments', reportId], queryFn: () => commentsApi.list(reportId), enabled: !!reportId })
}

export function useAddComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => commentsApi.create(data),
    onSuccess:  (_, { reportId }) => { qc.invalidateQueries({ queryKey: ['comments', reportId] }); toast.success('Comment added') },
    onError:    () => toast.error('Comment failed'),
  })
}

// ── Progress ──────────────────────────────────────────────────────────────────
export function useProgress(reportId) {
  return useQuery({ queryKey: ['progress', reportId], queryFn: () => progressApi.list(reportId), enabled: !!reportId })
}

export function useAddProgress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => progressApi.create(data),
    onSuccess:  (_, { reportId }) => { qc.invalidateQueries({ queryKey: ['progress', reportId] }); qc.invalidateQueries({ queryKey: ['report', reportId] }); toast.success('Progress saved') },
    onError:    () => toast.error('Failed'),
  })
}

// ── Stats ─────────────────────────────────────────────────────────────────────
export function useDashboardStats(params = {}) {
  return useQuery({ queryKey: ['stats', params], queryFn: () => reportsApi.stats(params), staleTime: 300000 })
}

// ── AI ────────────────────────────────────────────────────────────────────────
export function useGenerateAIReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => aiApi.generate(data),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['ai-reports'] }); toast.success('AI report generated!') },
    onError:    () => toast.error('AI report failed'),
  })
}

export function useAIReports() {
  return useQuery({ queryKey: ['ai-reports'], queryFn: () => aiApi.list() })
}

// ── Photo upload ──────────────────────────────────────────────────────────────
export function usePhotoUpload() {
  const [uploading, setUploading] = useState(false)
  const [fileIds,   setFileIds]   = useState([])

  const upload = async (files, reportId = 'temp') => {
    setUploading(true)
    try {
      const results = await Promise.all(files.map((f) => uploadPhoto(f, reportId)))
      const ids = results.map((r) => r?.fileId).filter(Boolean)
      setFileIds((p) => [...p, ...ids])
      return ids
    } catch { toast.error('Photo upload failed'); return [] }
    finally  { setUploading(false) }
  }

  return { upload, uploading, fileIds, setFileIds }
}
