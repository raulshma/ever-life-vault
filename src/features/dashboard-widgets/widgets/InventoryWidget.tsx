import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { useInventory } from '@/hooks/useInventory'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

type InventoryConfig = { max?: number }

export default function InventoryWidget({ config }: WidgetProps<InventoryConfig>) {
  const { items, locations, getItemsWithQR, getTotalValue } = useInventory()
  const max = typeof config?.max === 'number' ? config.max : 6
  const recent = items.slice(0, max)
  const qrCount = getItemsWithQR().length
  const totalValue = getTotalValue()

  return (
    <WidgetShell title="Inventory">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Recent items</div>
          <ul className="space-y-1">
            {recent.length === 0 ? (
              <li className="text-muted-foreground">No items.</li>
            ) : (
              recent.map((i) => (
                <li key={i.id} className="truncate">{i.name}</li>
              ))
            )}
          </ul>
        </div>
        <div className="space-y-1">
          <div><span className="text-xs text-muted-foreground">Locations:</span> {locations.length}</div>
          <div><span className="text-xs text-muted-foreground">QR labeled:</span> {qrCount}</div>
          <div><span className="text-xs text-muted-foreground">Total value:</span> ${totalValue.toLocaleString()}</div>
        </div>
      </div>
      <div className="mt-3 text-right">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/inventory">Open Inventory</Link>
        </Button>
      </div>
    </WidgetShell>
  )
}


