import React, { useCallback, useEffect, useState } from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps, BaseWidgetConfig } from '../types'
import { useEncryptedVault } from '@/hooks/useEncryptedVault'
import useKarakeep, { type KarakeepConfig, type KarakeepItem } from '@/hooks/useKarakeep'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { RefreshCw } from 'lucide-react'
import PrereqGuard from '@/components/PrereqGuard'
import { useVaultSession } from '@/hooks/useVaultSession'
import { useApiCache, generateCacheKey } from '../hooks/useApiCache'
import { CacheConfig } from '../components/CacheConfig'

type KarakeepWidgetConfig = BaseWidgetConfig & {}

export default function KarakeepWidget({ config, onConfigChange, isEditing }: WidgetProps<KarakeepWidgetConfig>) {
  const { itemsByType } = useEncryptedVault()
  const { isUnlocked } = useVaultSession()
  const kItem = [...itemsByType.api].find((i) => i.name.toLowerCase() === 'karakeep')
  const cfg: KarakeepConfig = { serverUrl: kItem?.data?.serverUrl || '', apiKey: kItem?.data?.apiKey || '' }
  const kk = useKarakeep(cfg)
  const [items, setItems] = useState<KarakeepItem[]>([])
  
  const { getCached, getCachedAsync, setCached } = useApiCache<KarakeepItem[]>()

  const load = useCallback(async () => {
    try {
      // Check cache first
      const cacheKey = generateCacheKey('karakeep-items', { serverUrl: cfg.serverUrl })
      const cached = await getCachedAsync(cacheKey, config.cacheTimeMs)
      if (cached) {
        setItems(cached)
        return
      }
      
      const res = await kk.listItems({ limit: 10 })
      const recentItems = res.items || []
      setItems(recentItems)
      
      // Cache the result
      setCached(cacheKey, recentItems, config.cacheTimeMs)
    } catch {}
  }, [kk, cfg.serverUrl, config.cacheTimeMs, getCached, setCached])

  useEffect(() => { if (cfg.serverUrl && cfg.apiKey) load() }, [cfg.serverUrl, cfg.apiKey, load])

  return (
    <WidgetShell title="Karakeep">
      <PrereqGuard
        title="Karakeep prerequisites"
        checks={[
          { ok: isUnlocked, label: 'Unlock your secure vault', actionLabel: 'Open Vault', onAction: () => (window.location.href = '/vault') },
          { ok: Boolean(cfg.serverUrl && cfg.apiKey), label: "Add a Vault API item named 'karakeep' with serverUrl and apiKey" },
        ]}
      >
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div>Recent items</div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="outline" aria-label="Refresh" onClick={load}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </div>
          <ul className="space-y-1">
            {items.slice(0, 8).map((r) => (
              <li key={String(r.id)} className="truncate">{r.title || r.url || '(item)'}</li>
            ))}
            {items.length === 0 && <li className="text-muted-foreground">No items found.</li>}
          </ul>
          
          {/* Cache Configuration */}
          {isEditing && (
            <CacheConfig config={config} onConfigChange={onConfigChange} />
          )}
        </div>
      </PrereqGuard>
    </WidgetShell>
  )
}


