import React, { useCallback, useEffect, useState } from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { useEncryptedVault } from '@/hooks/useEncryptedVault'
import useKarakeep, { type KarakeepConfig, type KarakeepItem } from '@/hooks/useKarakeep'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { RefreshCw } from 'lucide-react'
import PrereqGuard from '@/components/PrereqGuard'
import { useVaultSession } from '@/hooks/useVaultSession'

export default function KarakeepWidget(_props: WidgetProps<{}>) {
  const { itemsByType } = useEncryptedVault()
  const { isUnlocked } = useVaultSession()
  const kItem = [...itemsByType.api].find((i) => i.name.toLowerCase() === 'karakeep')
  const cfg: KarakeepConfig = { serverUrl: kItem?.data?.serverUrl || '', apiKey: kItem?.data?.apiKey || '' }
  const kk = useKarakeep(cfg)
  const [items, setItems] = useState<KarakeepItem[]>([])

  const load = useCallback(async () => {
    try {
      const res = await kk.listItems({ limit: 10 })
      setItems(res.items || [])
    } catch {}
  }, [kk])

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
        </div>
      </PrereqGuard>
    </WidgetShell>
  )
}


