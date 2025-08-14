import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Plus, Copy, Save, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useEncryptedVault } from '@/hooks/useEncryptedVault'
import { useVaultSession } from '@/hooks/useVaultSession'

type OTPAccount = {
  label: string
  secret: string // base32
  digits?: number
  period?: number
  algorithm?: 'SHA1' | 'SHA256' | 'SHA512'
}

type OTPConfig = {
  accounts?: OTPAccount[]
}

function base32ToBytes(base32: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  const cleaned = base32.replace(/=+$/,'').toUpperCase().replace(/\s+/g, '')
  for (const c of cleaned) {
    const val = alphabet.indexOf(c)
    if (val === -1) continue
    bits += val.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2))
  }
  return new Uint8Array(bytes)
}

async function hotp(secret: Uint8Array, counter: number, algorithm: 'SHA1' | 'SHA256' | 'SHA512' = 'SHA1'): Promise<ArrayBuffer> {
  const enc = new TextEncoder()
  const algoName = algorithm === 'SHA1' ? 'SHA-1' : algorithm === 'SHA256' ? 'SHA-256' : 'SHA-512'
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: { name: algoName } }, false, ['sign'])
  const buf = new ArrayBuffer(8)
  const view = new DataView(buf)
  // big-endian counter
  const high = Math.floor(counter / 0x100000000)
  const low = counter >>> 0
  view.setUint32(0, high)
  view.setUint32(4, low)
  return crypto.subtle.sign('HMAC', key, buf)
}

function truncateHOTP(hmac: ArrayBuffer, digits: number): string {
  const bytes = new Uint8Array(hmac)
  const offset = bytes[bytes.length - 1] & 0xf
  const bin = ((bytes[offset] & 0x7f) << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | (bytes[offset + 3])
  const mod = 10 ** digits
  return String(bin % mod).padStart(digits, '0')
}

async function totp(secretB32: string, nowMs: number, period: number, digits: number, algorithm: 'SHA1' | 'SHA256' | 'SHA512'): Promise<string> {
  const counter = Math.floor(nowMs / 1000 / period)
  const mac = await hotp(base32ToBytes(secretB32), counter, algorithm)
  return truncateHOTP(mac, digits)
}

export default function OTPHelperWidget({ config, onConfigChange }: WidgetProps<OTPConfig>) {
  const accounts = Array.isArray(config?.accounts) ? config.accounts : []
  const { addItem } = useEncryptedVault()
  const { isUnlocked } = useVaultSession()
  const [now, setNow] = React.useState(() => Date.now())
  const [label, setLabel] = React.useState('')
  const [secret, setSecret] = React.useState('')
  const [digits, setDigits] = React.useState('6')
  const [period, setPeriod] = React.useState('30')
  const [algo, setAlgo] = React.useState<'SHA1' | 'SHA256' | 'SHA512'>('SHA1')

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const addAccount = () => {
    if (!label.trim() || !secret.trim()) return
    const entry: OTPAccount = { label: label.trim(), secret: secret.trim().replace(/\s+/g, ''), digits: Number(digits) || 6, period: Number(period) || 30, algorithm: algo }
    onConfigChange({ ...config, accounts: [...accounts, entry] })
    setLabel(''); setSecret('')
  }

  const removeAt = (idx: number) => {
    onConfigChange({ ...config, accounts: accounts.filter((_, i) => i !== idx) })
  }

  const saveToVault = async (acc: OTPAccount) => {
    await addItem({ type: 'api', name: acc.label, data: { totpSecret: acc.secret, digits: acc.digits || 6, period: acc.period || 30, algorithm: acc.algorithm || 'SHA1' } } as any)
  }

  const secondsLeft = (acc: OTPAccount) => {
    const p = acc.period || 30
    const s = Math.floor(now / 1000)
    return p - (s % p)
  }

  return (
    <WidgetShell
      title="OTP/TOTP"
      actions={
        <Dialog>
          <DialogTrigger asChild>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="outline" aria-label="Add">
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add</TooltipContent>
            </Tooltip>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add TOTP</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
              <Input placeholder="Base32 Secret" value={secret} onChange={(e) => setSecret(e.target.value)} />
              <div className="flex gap-2">
                <Input placeholder="Digits" type="number" value={digits} onChange={(e) => setDigits(e.target.value)} />
                <Input placeholder="Period" type="number" value={period} onChange={(e) => setPeriod(e.target.value)} />
                <Input placeholder="Algorithm (SHA1/SHA256/SHA512)" value={algo} onChange={(e) => setAlgo((e.target.value.toUpperCase() as any) || 'SHA1')} />
              </div>
              <div className="flex gap-2 justify-end">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" aria-label="Add" onClick={addAccount}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Add</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-3 text-sm">
        <ul className="space-y-2">
          {accounts.map((acc, idx) => (
            <OTPRow key={idx} acc={acc} now={now} onCopy={async (code) => { try { await navigator.clipboard.writeText(code) } catch {} }} onSave={() => saveToVault(acc)} onRemove={() => removeAt(idx)} />
          ))}
          {accounts.length === 0 && <li className="text-muted-foreground">No accounts yet.</li>}
        </ul>
        <div className="text-xs text-muted-foreground">Secrets are kept only in your config/vault and never transmitted.</div>
        {!isUnlocked && (
          <div className="text-xs text-warning">Unlock your vault to save accounts securely.</div>
        )}
      </div>
    </WidgetShell>
  )
}

function OTPRow({ acc, now, onCopy, onSave, onRemove }: { acc: OTPAccount; now: number; onCopy: (code: string) => void; onSave: () => void; onRemove: () => void }) {
  const [code, setCode] = React.useState<string>('------')
  const [remaining, setRemaining] = React.useState<number>(0)
  const { isUnlocked } = useVaultSession()
  React.useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const val = await totp(acc.secret, now, acc.period || 30, acc.digits || 6, acc.algorithm || 'SHA1')
        if (!cancelled) setCode(val)
      } catch {
        if (!cancelled) setCode('ERR')
      }
      if (!cancelled) setRemaining((acc.period || 30) - Math.floor((now / 1000) % (acc.period || 30)))
    }
    run()
    return () => { cancelled = true }
  }, [acc.algorithm, acc.digits, acc.period, acc.secret, now])
  return (
    <li className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">{acc.label}</div>
        <div className="text-xs text-muted-foreground">{acc.algorithm || 'SHA1'} · {acc.digits || 6} digits · {acc.period || 30}s</div>
      </div>
      <div className="font-mono tabular-nums text-lg">{code}</div>
      <div className="text-xs text-muted-foreground w-10 text-right">{remaining}s</div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="outline" aria-label="Copy" onClick={() => onCopy(code)}>
            <Copy className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Copy</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Save" onClick={onSave} disabled={!isUnlocked}>
            <Save className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isUnlocked ? 'Save' : 'Unlock vault to save'}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" aria-label="Remove" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Remove</TooltipContent>
      </Tooltip>
    </li>
  )
}


