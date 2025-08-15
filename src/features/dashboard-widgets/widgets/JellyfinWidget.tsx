import React, { useCallback, useEffect, useState } from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps, BaseWidgetConfig } from '../types'
import { useEncryptedVault } from '@/hooks/useEncryptedVault'
import { useJellyfin, type JellyfinConfig, type JellyfinSession, type JellyfinSystemInfo } from '@/hooks/useJellyfin'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { RefreshCw } from 'lucide-react'
import PrereqGuard from '@/components/PrereqGuard'
import { useVaultSession } from '@/hooks/useVaultSession'
import { Skeleton } from '@/components/ui/skeleton'
import { useApiCache, generateCacheKey } from '../hooks/useApiCache'
import { CacheConfig } from '../components/CacheConfig'

type JellyfinWidgetConfig = BaseWidgetConfig & {}

export default function JellyfinWidget(_props: WidgetProps<JellyfinWidgetConfig>) {
  const { itemsByType } = useEncryptedVault()
  const jellyfinItem = [...itemsByType.api].find((i) => i.name.toLowerCase() === 'jellyfin')
  const config: JellyfinConfig = { serverUrl: jellyfinItem?.data?.serverUrl || '', apiKey: jellyfinItem?.data?.apiKey || '' }
  const jf = useJellyfin(config)
  const { isUnlocked } = useVaultSession()
  const [info, setInfo] = useState<JellyfinSystemInfo | null>(null)
  const [sessions, setSessions] = useState<JellyfinSession[]>([])
  
  const { getCached, setCached } = useApiCache<{ info: JellyfinSystemInfo; sessions: JellyfinSession[] }>()

  const load = useCallback(async () => {
    try {
      // Check cache first
      const cacheKey = generateCacheKey('jellyfin', { serverUrl: config.serverUrl })
      const cached = getCached(cacheKey, _props.config.cacheTimeMs)
      if (cached) {
        setInfo(cached.info)
        setSessions(cached.sessions)
        return
      }
      
      const i = await jf.getSystemInfo()
      const s = await jf.getSessions()
      setInfo(i)
      setSessions(s)
      
      // Cache the result
      setCached(cacheKey, { info: i, sessions: s }, _props.config.cacheTimeMs)
    } catch {}
  }, [jf, config.serverUrl, _props.config.cacheTimeMs, getCached, setCached])

  useEffect(() => { if (config.serverUrl && config.apiKey) load() }, [config.serverUrl, config.apiKey, load])

  return (
    <WidgetShell title="Jellyfin">
      <PrereqGuard
        title="Jellyfin prerequisites"
        checks={[
          { ok: isUnlocked, label: 'Unlock your secure vault', actionLabel: 'Open Vault', onAction: () => (window.location.href = '/vault') },
          { ok: Boolean(config.serverUrl && config.apiKey), label: "Add a Vault API item named 'jellyfin' with serverUrl and apiKey" },
        ]}
      >
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <div>
              {info ? (
                <>
                  Server: {info.ServerName || '(unknown)'} {info.Version && <span className="text-muted-foreground">v{info.Version}</span>}
                </>
              ) : (
                <>
                  <Skeleton className="h-4 w-32 inline-block align-middle" />
                </>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="outline" aria-label="Refresh" onClick={load}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </div>
          <div>
            {info ? (
              <>Active sessions: {sessions.filter(s => s.IsActive).length}</>
            ) : (
              <Skeleton className="h-3 w-28" />
            )}
          </div>
          <ul className="space-y-1">
            {info ? (
              sessions.slice(0, 5).map((s) => (
                <li key={s.Id} className="truncate">{s.UserName} — {s.NowPlayingItem?.Name || 'idle'}</li>
              ))
            ) : (
              Array.from({ length: 3 }).map((_, i) => (
                <li key={i} className="truncate"><Skeleton className="h-4 w-48" /></li>
              ))
            )}
            {info && sessions.length === 0 && <li className="text-muted-foreground">No active sessions.</li>}
          </ul>
          
          {/* Cache Configuration */}
          {_props.isEditing && <CacheConfig config={_props.config} onConfigChange={_props.onConfigChange} />}
        </div>
      </PrereqGuard>
    </WidgetShell>
  )
}


