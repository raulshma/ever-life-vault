import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/useAuth'
import { useEncryptedVault } from '@/hooks/useEncryptedVault'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { Computer, Plus, Save, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

type AuthMode = 'password' | 'key'

type NewSessionForm = {
  mode: 'manual' | 'vault'
  vaultItemId: string
  host: string
  port: string
  username: string
  authMode: AuthMode
  password?: string
  privateKey?: string
  passphrase?: string
}

type SessionState = {
  id: string
  title: string
  ws?: WebSocket
  term?: XTerm
  fit?: FitAddon
  containerRef: React.RefObject<HTMLDivElement>
  status: 'connecting' | 'connected' | 'closed' | 'error'
}

export const TerminalManager: React.FC = () => {
  const { session } = useAuth()
  const { items, addItem } = useEncryptedVault()
  const { toast } = useToast()
  const sshItems = useMemo(() => items.filter(i => i.type === 'ssh'), [items])

  const [sessions, setSessions] = useState<SessionState[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<NewSessionForm>({
    mode: 'manual',
  vaultItemId: '',
    host: '',
    port: '22',
    username: '',
    authMode: 'password',
    password: '',
  })

  useEffect(() => {
    if (form.mode === 'vault' && form.vaultItemId) {
      const item = sshItems.find(i => i.id === form.vaultItemId)
      if (item) {
        const d = item.data || {}
        const host = d.host || ''
        const port = String(d.port || '22')
        const username = d.username || ''
        const authModeVal: AuthMode = d.privateKey ? 'key' : 'password'
        const passwordVal = d.password || ''
        const privateKeyVal = d.privateKey || ''
        const passphraseVal = d.passphrase || ''

        // Only update form when values actually change to avoid render loops
        const shouldUpdate = host !== form.host
          || port !== form.port
          || username !== form.username
          || authModeVal !== form.authMode
          || passwordVal !== (form.password || '')
          || privateKeyVal !== (form.privateKey || '')
          || passphraseVal !== (form.passphrase || '')

        if (shouldUpdate) {
          setForm(prev => ({
            ...prev,
            host,
            port,
            username,
            authMode: authModeVal,
            password: passwordVal,
            privateKey: privateKeyVal,
            passphrase: passphraseVal,
          }))
        }
      }
    }
  }, [form.mode, form.vaultItemId, sshItems])

  const createSession = async () => {
    if (!session?.access_token) return
    setCreating(true)
    try {
      const body: any = {
        host: form.host,
        port: Number(form.port) || 22,
        username: form.username,
      }
      if (form.authMode === 'password') {
        body.password = form.password
      } else {
        body.privateKey = form.privateKey
        if (form.passphrase) body.passphrase = form.passphrase
      }
      const res = await fetch('/ssh/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed to create SSH session')
      const { sessionId } = await res.json()
      const containerRef = React.createRef<HTMLDivElement>()
      const newState: SessionState = {
        id: sessionId,
        title: `${form.username}@${form.host}`,
        containerRef,
        status: 'connecting',
      }
      setSessions(prev => [...prev, newState])
      setActiveId(sessionId)

      setTimeout(() => attachTerminal(sessionId, containerRef), 0)
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  const attachTerminal = (id: string, containerRef: React.RefObject<HTMLDivElement>) => {
    const token = session?.access_token
    if (!token) return
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ssh/sessions/${id}/attach?token=${encodeURIComponent(token)}`)

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      convertEol: true,
      theme: {
        background: '#0b0f17',
      },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)

    ws.binaryType = 'arraybuffer'

    ws.onopen = () => {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, ws, term, fit, status: 'connected' } : s))
      if (containerRef.current) {
        term.open(containerRef.current)
        fit.fit()
        // send initial resize
        const dims = (term as any)._core?._renderService?._renderer?.dimensions
        const cols = term.cols
        const rows = term.rows
        ws.send(JSON.stringify({ type: 'resize', cols, rows }))
      }
      term.focus()
      term.onData(data => {
        try { ws.send(data) } catch {}
      })
      const onResize = () => {
        try { fit.fit() } catch {}
        try { ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows })) } catch {}
      }
      window.addEventListener('resize', onResize)
      // store cleanup handler on term
      ;(term as any)._cleanupResize = onResize
    }
    ws.onmessage = (ev) => {
      if (ev.data instanceof ArrayBuffer) {
        const text = new TextDecoder().decode(new Uint8Array(ev.data))
        term.write(text)
      } else if (typeof ev.data === 'string') {
        term.write(ev.data)
      }
    }
    ws.onclose = () => {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'closed' } : s))
    }
    ws.onerror = () => {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'error' } : s))
    }
  }

  const closeSession = async (id: string) => {
    const s = sessions.find(x => x.id === id)
    try {
      s?.ws?.close()
      await fetch(`/ssh/sessions/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token}` } })
    } catch {}
    if ((s?.term as any)?._cleanupResize) {
      window.removeEventListener('resize', (s!.term as any)._cleanupResize)
    }
    s?.term?.dispose()
    setSessions(prev => prev.filter(x => x.id !== id))
    if (activeId === id) setActiveId(sessions.find(x => x.id !== id)?.id || null)
  }

  const canCreate = form.host && form.username && (form.authMode === 'password' ? !!form.password : !!form.privateKey)

  const saveToVault = async () => {
    if (!canCreate) return
    try {
      const name = `SSH: ${form.username}@${form.host}${form.port && form.port !== '22' ? `:${form.port}` : ''}`
      const saved = await addItem({
        type: 'ssh',
        name,
        data: {
          host: form.host,
          port: Number(form.port) || 22,
          username: form.username,
          password: form.authMode === 'password' ? (form.password || '') : '',
          privateKey: form.authMode === 'key' ? (form.privateKey || '') : '',
          passphrase: form.authMode === 'key' ? (form.passphrase || '') : '',
        }
      })
      if (saved) {
        toast({ title: 'Saved', description: 'SSH credential saved to vault.' })
      } else {
        toast({ title: 'Unable to save', description: 'Vault is locked or unavailable.', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error saving to vault', description: e?.message || 'Unknown error', variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Computer className="h-5 w-5" /> SSH Terminals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
          <div className="md:col-span-1">
            <Label>Source</Label>
            <Select value={form.mode} onValueChange={(v: any) => setForm(f => ({ ...f, mode: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="vault" disabled={sshItems.length === 0}>From Vault</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.mode === 'vault' && (
            <div className="md:col-span-2">
              <Label>SSH Credential</Label>
              <Select value={form.vaultItemId} onValueChange={(v: any) => setForm(f => ({ ...f, vaultItemId: v }))}>
                <SelectTrigger><SelectValue placeholder={sshItems.length ? 'Choose a saved server' : 'No SSH items in vault'} /></SelectTrigger>
                <SelectContent>
                  {sshItems.map(item => (
                    <SelectItem key={item.id} value={item.id}>{item.name} ({item.data?.username}@{item.data?.host})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="md:col-span-2">
            <Label>Host</Label>
            <Input value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))} placeholder="example.com" />
          </div>
          <div>
            <Label>Port</Label>
            <Input value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))} placeholder="22" />
          </div>
          <div className="md:col-span-1">
            <Label>Username</Label>
            <Input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="root" />
          </div>
          <div className="md:col-span-1">
            <Label>Auth</Label>
            <Select value={form.authMode} onValueChange={(v: any) => setForm(f => ({ ...f, authMode: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="password">Password</SelectItem>
                <SelectItem value="key">Private Key</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.authMode === 'password' ? (
            <div className="md:col-span-2">
              <Label>Password</Label>
              <Input type="password" value={form.password || ''} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
          ) : (
            <>
              <div className="md:col-span-3">
                <Label>Private Key (PEM)</Label>
                <Textarea value={form.privateKey || ''} onChange={(e: any) => setForm(f => ({ ...f, privateKey: e.target.value }))} placeholder="-----BEGIN OPENSSH PRIVATE KEY----- ..." rows={4} />
              </div>
              <div>
                <Label>Passphrase (optional)</Label>
                <Input type="password" value={form.passphrase || ''} onChange={e => setForm(f => ({ ...f, passphrase: e.target.value }))} />
              </div>
            </>
          )}
          <div className="md:col-span-1 flex gap-2">
            <Button disabled={!canCreate || creating} onClick={createSession} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> New Session
            </Button>
          </div>
          <div className="md:col-span-1 flex gap-2">
            <Button variant="outline" disabled={!canCreate} onClick={saveToVault} className="w-full">
              <Save className="h-4 w-4 mr-2" /> Save to Vault
            </Button>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">No sessions yet. Create one above.</div>
        ) : (
          <Tabs value={activeId ?? sessions[0]?.id} onValueChange={setActiveId}>
            <TabsList className="flex flex-wrap">
              {sessions.map(s => (
                <TabsTrigger key={s.id} value={s.id} className="flex items-center gap-2">
                  {s.title}
                </TabsTrigger>
              ))}
            </TabsList>
            {sessions.map(s => (
              <TabsContent key={s.id} value={s.id} className="mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <Button size="sm" variant="outline" onClick={() => closeSession(s.id)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Close
                  </Button>
                </div>
                <div ref={s.containerRef} className="h-[420px] w-full rounded border overflow-hidden bg-black" style={{ display: activeId === s.id ? 'block' : 'none' }} />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}
