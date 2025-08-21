import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { useVaultSession } from '@/hooks/useVaultSession'
import { useEncryptedVault } from '@/hooks/useEncryptedVault'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

export default function VaultWidget(_props: WidgetProps<Record<string, never>>) {
  const { isUnlocked, unlockVault, lockVault } = useVaultSession()
  const { itemsByType, totalItems } = useEncryptedVault()

  return (
    <WidgetShell title="Vault">
      <div className="space-y-2 text-sm">
        <div>Status: {isUnlocked ? 'Unlocked' : 'Locked'}</div>
        <div className="grid grid-cols-2 gap-2">
          <div>Logins: {itemsByType.login.length}</div>
          <div>Notes: {itemsByType.note.length}</div>
          <div>API Keys: {itemsByType.api.length}</div>
          <div>Docs: {itemsByType.document.length}</div>
        </div>
        <div>Total items: {totalItems}</div>
        <div className="flex gap-2 pt-1">
          {isUnlocked ? (
            <Button size="sm" variant="outline" onClick={() => lockVault()}>Lock</Button>
          ) : (
            <Button size="sm" onClick={() => unlockVault(prompt('Master password') || '', 15)}>Unlock</Button>
          )}
          <Button size="sm" variant="ghost" asChild>
            <Link to="/vault">Open Vault</Link>
          </Button>
        </div>
      </div>
    </WidgetShell>
  )
}


