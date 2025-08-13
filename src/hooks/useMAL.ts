import { useCallback, useMemo, useState } from 'react'
import { fetchWithAuth } from '@/lib/aggregatorClient'

export interface MALRecentItem {
  mal_id: number
  title?: string
  episode: number
  watched_at: string
  main_picture?: any
}

export function useMAL() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startLink = useCallback(async (): Promise<string> => {
    const res = await fetchWithAuth('/api/mal/link/start', { method: 'POST' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as { url: string }
    return json.url
  }, [])

  const sync = useCallback(async (): Promise<{ ok: boolean; count: number } | null> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWithAuth('/api/mal/sync', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as any
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const getProfile = useCallback(async (): Promise<any | null> => {
    try {
      const res = await fetchWithAuth('/api/mal/profile')
      if (!res.ok) return null
      return res.json()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return null
    }
  }, [])

  const getRecent = useCallback(async (): Promise<{ items: MALRecentItem[] }> => {
    try {
      const res = await fetchWithAuth('/api/mal/recent')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return { items: [] }
    }
  }, [])

  const getSeasonal = useCallback(async (): Promise<{ items: Array<{ mal_id: number; title: string; main_picture?: any }> }> => {
    try {
      const res = await fetchWithAuth('/api/mal/seasonal')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      return { items: [] }
    }
  }, [])

  return useMemo(
    () => ({ loading, error, startLink, sync, getProfile, getRecent, getSeasonal }),
    [loading, error, startLink, sync, getProfile, getRecent, getSeasonal]
  )
}


