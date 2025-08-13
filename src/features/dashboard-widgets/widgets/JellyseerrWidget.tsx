import React, { useCallback, useEffect, useState } from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { useEncryptedVault } from '@/hooks/useEncryptedVault'
import { useJellyseerr, type JellyseerrConfig, type MediaRequest } from '@/hooks/useJellyseerr'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import PrereqGuard from '@/components/PrereqGuard'
import { useVaultSession } from '@/hooks/useVaultSession'

export default function JellyseerrWidget(_props: WidgetProps<{}>) {
  const { itemsByType } = useEncryptedVault()
  const jItem = [...itemsByType.api].find((i) => i.name.toLowerCase() === 'jellyseerr')
  const cfg: JellyseerrConfig = { serverUrl: jItem?.data?.serverUrl || '', apiKey: jItem?.data?.apiKey || '' }
  const js = useJellyseerr(cfg)
  const [requests, setRequests] = useState<MediaRequest[]>([])
  const { isUnlocked } = useVaultSession()

  const load = useCallback(async () => {
    try {
      const res = await js.getRequests(10, 0)
      setRequests(res.results || [])
    } catch {}
  }, [js])

  useEffect(() => { if (cfg.serverUrl && cfg.apiKey) load() }, [cfg.serverUrl, cfg.apiKey, load])

  return (
    <WidgetShell title="Jellyseerr">
      <PrereqGuard
        title="Jellyseerr prerequisites"
        checks={[
          { ok: isUnlocked, label: 'Unlock your secure vault', actionLabel: 'Open Vault', onAction: () => (window.location.href = '/vault') },
          { ok: Boolean(cfg.serverUrl && cfg.apiKey), label: "Add a Vault API item named 'jellyseerr' with serverUrl and apiKey" },
        ]}
      >
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div>Recent requests</div>
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
            {js.loading && requests.length === 0 ? (
              Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="truncate"><Skeleton className="h-4 w-56" /></li>
              ))
            ) : (
              requests.slice(0, 8).map((r) => (
                <li key={r.id} className="truncate">{r.media?.title || '(item)'} — {r.status}</li>
              ))
            )}
            {!js.loading && requests.length === 0 && <li className="text-muted-foreground">No requests found.</li>}
          </ul>
        </div>
      </PrereqGuard>
    </WidgetShell>
  )
}


