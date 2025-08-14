import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { RefreshCw, Copy, Save } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useEncryptedVault } from '@/hooks/useEncryptedVault'
import { useVaultSession } from '@/hooks/useVaultSession'

type PasswordGenConfig = {
  length?: number
  useLower?: boolean
  useUpper?: boolean
  useDigits?: boolean
  useSymbols?: boolean
}

function generatePassword(opts: Required<PasswordGenConfig>): string {
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const digits = '0123456789'
  const symbols = '!@#$%^&*()-_=+[]{};:,.<>/?'
  let alphabet = ''
  if (opts.useLower) alphabet += lower
  if (opts.useUpper) alphabet += upper
  if (opts.useDigits) alphabet += digits
  if (opts.useSymbols) alphabet += symbols
  if (!alphabet) alphabet = lower
  const arr = new Uint32Array(opts.length)
  crypto.getRandomValues(arr)
  let out = ''
  for (let i = 0; i < arr.length; i++) {
    out += alphabet[arr[i] % alphabet.length]
  }
  return out
}

export default function PasswordGeneratorWidget({ config, onConfigChange }: WidgetProps<PasswordGenConfig>) {
  const defaults: Required<PasswordGenConfig> = {
    length: typeof config?.length === 'number' ? Math.max(6, Math.min(128, config.length)) : 16,
    useLower: config?.useLower ?? true,
    useUpper: config?.useUpper ?? true,
    useDigits: config?.useDigits ?? true,
    useSymbols: config?.useSymbols ?? false,
  }
  const [password, setPassword] = React.useState('')
  const { addItem } = useEncryptedVault()
  const { isUnlocked } = useVaultSession()

  const regen = React.useCallback(() => {
    setPassword(generatePassword(defaults))
  }, [defaults.length, defaults.useDigits, defaults.useLower, defaults.useSymbols, defaults.useUpper])

  React.useEffect(() => { regen() }, [regen])

  const updateConfig = (next: Partial<PasswordGenConfig>) => {
    onConfigChange({ ...config, ...next })
  }

  const copyToClipboard = async () => {
    try { await navigator.clipboard.writeText(password) } catch {}
  }

  const saveToVault = async () => {
    await addItem({
      type: 'login',
      name: 'Generated Password',
      data: { password, notes: 'Generated from Dashboard widget' },
    } as any)
  }

  return (
    <WidgetShell title="Password Generator" actions={
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" aria-label="Regenerate" onClick={regen}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Regenerate</TooltipContent>
      </Tooltip>
    }>
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input value={password} readOnly className="font-mono" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Copy" onClick={copyToClipboard}>
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Save" onClick={saveToVault} disabled={!isUnlocked}>
                <Save className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isUnlocked ? 'Save' : 'Unlock vault to save'}</TooltipContent>
          </Tooltip>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-center text-sm">
          <div className="flex items-center gap-2 col-span-1">
            <Label htmlFor="pw-len" className="w-20">Length</Label>
            <Input id="pw-len" type="number" min={6} max={128} value={defaults.length}
              onChange={(e) => updateConfig({ length: Number(e.target.value) })} />
          </div>
          <div className="flex items-center gap-2"><Switch id="lower" checked={defaults.useLower} onCheckedChange={(v) => updateConfig({ useLower: v })} /><Label htmlFor="lower">Lowercase</Label></div>
          <div className="flex items-center gap-2"><Switch id="upper" checked={defaults.useUpper} onCheckedChange={(v) => updateConfig({ useUpper: v })} /><Label htmlFor="upper">Uppercase</Label></div>
          <div className="flex items-center gap-2"><Switch id="digits" checked={defaults.useDigits} onCheckedChange={(v) => updateConfig({ useDigits: v })} /><Label htmlFor="digits">Digits</Label></div>
          <div className="flex items-center gap-2"><Switch id="symbols" checked={defaults.useSymbols} onCheckedChange={(v) => updateConfig({ useSymbols: v })} /><Label htmlFor="symbols">Symbols</Label></div>
        </div>
        <div className="text-xs text-muted-foreground">Secrets are generated locally. Saving uses your encrypted vault.</div>
        {!isUnlocked && (
          <div className="text-xs text-warning">Unlock your vault to save generated passwords.</div>
        )}
      </div>
    </WidgetShell>
  )
}


