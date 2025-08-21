import React from 'react'
import type { WidgetProps, BaseWidgetConfig } from '../types'
import { WidgetShell } from '../components/WidgetShell'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useSteam } from '@/hooks/useSteam'
import { useAuth } from '@/hooks/useAuth'
import PrereqGuard from '@/components/PrereqGuard'
import { useApiCache, generateCacheKey } from '../hooks/useApiCache'
import { CacheConfig } from '../components/CacheConfig'

type SteamDetailConfig = BaseWidgetConfig & { appid?: number }

export default function SteamGameDetailWidget({ config, onConfigChange, isEditing }: WidgetProps<SteamDetailConfig>) {
  const { getGame } = useSteam()
  const [data, setData] = React.useState<{ game?: { name?: string; appid?: number; header_image?: string }; ownership?: { playtime_forever_minutes?: number; last_played_at?: string } } | null>(null)
  const [appid, setAppid] = React.useState<number | undefined>(config?.appid)
  const { user } = useAuth()
  
  const { getCached, getCachedAsync, setCached } = useApiCache<{ game?: { name?: string; appid?: number; header_image?: string }; ownership?: { playtime_forever_minutes?: number; last_played_at?: string } }>()

  const load = React.useCallback(async () => {
    if (!appid) return
    
    // Check cache first
    const cacheKey = generateCacheKey('steam-game-detail', { appid })
    const cached = await getCachedAsync(cacheKey, config.cacheTimeMs)
    if (cached) {
      setData(cached)
      return
    }
    
    const json = await getGame(appid)
    setData(json)
    
    // Cache the result
    setCached(cacheKey, json, config.cacheTimeMs)
  }, [appid, getGame, config.cacheTimeMs, getCached, setCached])

  React.useEffect(() => { void load() }, [load])

  const apply = () => { onConfigChange({ ...config, appid }); void load() }

  const prereqs = [
    { ok: Boolean(user), label: 'Sign in to load Steam game details', actionLabel: 'Sign in', onAction: () => (window.location.href = '/auth') },
  ]

  return (
    <WidgetShell title="Steam Game Detail">
      <PrereqGuard title="Steam requires sign in" checks={prereqs}>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="AppID" type="number" value={appid ?? ''} onChange={(e) => setAppid(Number(e.target.value))} />
            <Button onClick={apply}>Load</Button>
          </div>
          {!data ? (
            <p className="text-sm text-muted-foreground">Enter an AppID and click Load.</p>
          ) : (
            <div className="text-sm space-y-2">
              <div className="font-semibold">{data?.game?.name || `App ${data?.game?.appid}`}</div>
              {data?.game?.header_image && (
                <img src={data.game.header_image} alt="header" className="w-full max-w-xs rounded" />
              )}
              <div className="text-muted-foreground">
                Playtime: {data?.ownership?.playtime_forever_minutes ?? 0} min{data?.ownership?.last_played_at ? ` · Last played ${new Date(data?.ownership?.last_played_at).toLocaleString()}` : ''}
              </div>
            </div>
          )}
          
          {/* Cache Configuration */}
          {isEditing && (
            <CacheConfig config={config} onConfigChange={onConfigChange} />
          )}
        </div>
      </PrereqGuard>
    </WidgetShell>
  )
}


