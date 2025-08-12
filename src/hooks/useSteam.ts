import { useCallback, useMemo, useState } from 'react'
import { fetchWithAuth } from '@/lib/aggregatorClient'

export interface SteamLibraryItem {
  appid: number
  name: string
  header_image?: string | null
  genres?: any
  metascore?: number | null
  is_free?: boolean | null
  playtime_forever_minutes: number
  playtime_2weeks_minutes: number
  last_played_at?: string | null
}

export function useSteam() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startLink = useCallback(async (): Promise<string> => {
    const res = await fetchWithAuth('/api/integrations/steam/link/start', { method: 'POST' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as { url: string }
    return json.url
  }, [])

  const sync = useCallback(async (): Promise<{ ok: boolean; count: number } | null> => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchWithAuth('/api/integrations/steam/sync', { method: 'POST' })
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
    const res = await fetchWithAuth('/api/steam/profile')
    if (!res.ok) return null
    return res.json()
  }, [])

  const getLibrary = useCallback(
    async (opts?: { page?: number; pageSize?: number; sort?: 'name' | 'playtime' | 'last_played'; order?: 'asc' | 'desc' }) => {
      const p = new URLSearchParams()
      if (opts?.page) p.set('page', String(opts.page))
      if (opts?.pageSize) p.set('pageSize', String(opts.pageSize))
      if (opts?.sort) p.set('sort', opts.sort)
      if (opts?.order) p.set('order', opts.order)
      const res = await fetchWithAuth(`/api/steam/library${p.toString() ? `?${p.toString()}` : ''}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as { items: SteamLibraryItem[]; page: number; pageSize: number; total: number }
    },
    []
  )

  const getRecent = useCallback(async () => {
    const res = await fetchWithAuth('/api/steam/recent')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }, [])

  const getGame = useCallback(async (appid: number) => {
    const res = await fetchWithAuth(`/api/steam/game/${appid}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }, [])

  const getSuggestions = useCallback(async () => {
    const res = await fetchWithAuth('/api/steam/suggestions')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }, [])

  return useMemo(
    () => ({ loading, error, startLink, sync, getProfile, getLibrary, getRecent, getGame, getSuggestions }),
    [loading, error, startLink, sync, getProfile, getLibrary, getRecent, getGame, getSuggestions]
  )
}


