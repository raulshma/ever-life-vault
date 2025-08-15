import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { RefreshCw, Copy } from 'lucide-react'
import { Input } from '@/components/ui/input'

type RandomIdConfig = { variant?: 'uuid' | 'ulid' | 'nano'; length?: number }

function nanoid(len: number): string {
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const arr = new Uint32Array(len)
  crypto.getRandomValues(arr)
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[arr[i] % alphabet.length]
  return out
}

function ulid(now: number = Date.now()): string {
  const crock = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  let ts = ''
  let n = now
  for (let i = 0; i < 10; i++) { ts = crock[n % 32] + ts; n = Math.floor(n / 32) }
  const rand = new Uint8Array(16)
  crypto.getRandomValues(rand)
  let r = ''
  for (let i = 0; i < 16; i++) r += crock[rand[i] % 32]
  return ts + r
}

export default function RandomIdWidget({ config, onConfigChange }: WidgetProps<RandomIdConfig>) {
  const variant = config?.variant ?? 'uuid'
  const length = typeof config?.length === 'number' ? Math.max(6, Math.min(64, config.length)) : 21
  const [value, setValue] = React.useState('')

  const regen = React.useCallback(() => {
    const v = variant === 'uuid'
      ? crypto.randomUUID()
      : variant === 'ulid'
        ? ulid()
        : nanoid(length)
    setValue(v)
  }, [variant, length])

  React.useEffect(() => { regen() }, [regen])

  const copy = async () => { try { await navigator.clipboard.writeText(value) } catch {} }

  const setVariant = React.useCallback((variant: RandomIdConfig['variant']) => {
    onConfigChange({ ...config, variant })
  }, [config, onConfigChange])

  const setLength = React.useCallback((length: number) => {
    onConfigChange({ ...config, length })
  }, [config, onConfigChange])

  return (
    <WidgetShell title="Random ID" actions={
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" aria-label="New ID" onClick={regen}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>New</TooltipContent>
      </Tooltip>
    }>
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input value={value} readOnly className="font-mono" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Copy" onClick={copy}>
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex flex-wrap gap-2 text-sm items-center">
          <Button size="sm" variant={variant === 'uuid' ? 'default' : 'secondary'} onClick={() => setVariant('uuid')}>UUID</Button>
          <Button size="sm" variant={variant === 'ulid' ? 'default' : 'secondary'} onClick={() => setVariant('ulid')}>ULID</Button>
          <Button size="sm" variant={variant === 'nano' ? 'default' : 'secondary'} onClick={() => setVariant('nano')}>NanoID</Button>
          {variant === 'nano' && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Length</span>
              <Input type="number" min={6} max={64} value={length} onChange={(e) => setLength(Number(e.target.value))} className="w-24" />
            </div>
          )}
        </div>
        <div className="text-xs text-muted-foreground">IDs are generated locally and never sent to a server.</div>
      </div>
    </WidgetShell>
  )
}


