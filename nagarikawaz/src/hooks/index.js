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
export function useReports(filters = {}) {
  return useQuery({ queryKey: ['reports', filters], queryFn: () => reportsApi.list(filters), staleTime: 120000, retry: 2 })
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
  const qc      = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (id) => {
      if (!user) throw new Error('login_required')
      return reportsApi.upvote(id, user.id)
    },
    // Optimistic update — instantly shows +1 without waiting for server
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['reports'] })
      const prev = qc.getQueriesData({ queryKey: ['reports'] })
      qc.setQueriesData({ queryKey: ['reports'] }, (old) => {
        if (!Array.isArray(old)) return old
        return old.map((r) =>
          r.id === id ? { ...r, upvotes: (Number(r.upvotes) || 0) + 1 } : r
        )
      })
      return { prev }
    },
    onSuccess: () => {
      // Refetch to sync real server value
      qc.invalidateQueries({ queryKey: ['reports'] })
    },
    onError: (err, _id, ctx) => {
      // Roll back optimistic update
      if (ctx?.prev) {
        ctx.prev.forEach(([queryKey, data]) => qc.setQueryData(queryKey, data))
      }
      if (err?.message === 'login_required') {
        toast.error('Please sign in to upvote / अपभोट गर्न लगइन गर्नुहोस्')
      } else {
        toast.error('Upvote failed — try again')
      }
    },
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
    if (!files?.length) return []
    setUploading(true)

    const ids = []
    for (const file of files) {
      const toastId = toast.loading(`📸 Uploading ${file.name}…`)
      try {
        const result = await uploadPhoto(file, reportId)
        if (result?.fileId) {
          ids.push(result.fileId)
          toast.success(`✓ Photo uploaded`, { id: toastId })
        } else {
          toast.error('Upload returned no file ID', { id: toastId })
        }
      } catch (err) {
        const msg = err?.message || 'Upload failed'
        toast.error(`📸 ${msg}`, { id: toastId, duration: 5000 })
        console.error('Photo upload error:', err)
      }
    }

    setFileIds((prev) => [...prev, ...ids])
    setUploading(false)
    return ids
  }

  return { upload, uploading, fileIds, setFileIds }
}
