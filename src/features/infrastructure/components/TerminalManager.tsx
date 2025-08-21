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
import { useTerminalSettings, useRecentTerminals } from '../hooks'
import { Terminal as XTerm } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { Computer, Plus, Save, Trash2, Settings, History, Zap, Clock, X, Loader2, Maximize2, Minimize2, Copy as CopyIcon, Eraser, Search, Trash } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { ResponsiveGrid, ResponsiveButtonGroup } from './ResponsiveLayout'
import { useScreenSize, isMobile } from '../utils/responsive'
import { getXTermTheme } from '../utils/terminalThemes'
import { TerminalSettings } from './TerminalSettings'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { RecentTerminal } from '../types'

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
  containerRef: React.RefObject<HTMLDivElement | null>
  status: 'connecting' | 'connected' | 'closed' | 'error'
}

export const TerminalManager: React.FC = () => {
  const { session } = useAuth()
  const { items, addItem } = useEncryptedVault()
  const { settings: terminalSettings } = useTerminalSettings()
  const { recentTerminals, addRecentTerminal, removeRecentTerminal, clearRecentTerminals } = useRecentTerminals()
  const { toast } = useToast()
  const { width } = useScreenSize()
  const sshItems = useMemo(() => items.filter(i => i.type === 'ssh'), [items])
  const mobile = isMobile(width)

  const [sessions, setSessions] = useState<SessionState[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [fullscreenId, setFullscreenId] = useState<string | null>(null)
  const [recentFilter, setRecentFilter] = useState('')
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
  }, [form.mode, form.vaultItemId, form.host, form.port, form.username, form.authMode, form.password, form.privateKey, form.passphrase, sshItems])

  // Handle terminal focus when active session changes
  useEffect(() => {
    if (activeId) {
      const activeSession = sessions.find(s => s.id === activeId)
      if (activeSession?.term && activeSession.status === 'connected') {
        // Focus the active terminal
        activeSession.term.focus()
      }
    }
  }, [activeId, sessions])

  // Apply settings live to existing terminals
  useEffect(() => {
    try {
      sessions.forEach(s => {
        if (s.term) {
          try {
            const setOpt = (s.term as any).setOption
            if (typeof setOpt === 'function') {
              setOpt.call(s.term, 'fontSize', terminalSettings.fontSize)
              setOpt.call(s.term, 'theme', getXTermTheme(terminalSettings.theme))
            } else {
              // best-effort fallback - avoid setting readonly ctor-only options
              try { ;(s.term as any).options.fontSize = terminalSettings.fontSize } catch (err) { }
              try { ;(s.term as any).options.theme = getXTermTheme(terminalSettings.theme) } catch (err) { }
            }
            s.fit?.fit()
          } catch (innerErr) {
            console.warn('Unable to update terminal options for a session', { sessionId: s.id, error: innerErr })
          }
        }
      })
    } catch (e) {
      console.error('Failed to apply terminal settings to sessions', e)
    }
  }, [terminalSettings.fontSize, terminalSettings.theme, sessions])

  const createSession = async () => {
    if (!session?.access_token) return
    setCreating(true)
    try {
      const body: {
        host: string
        port: number
        username: string
        password?: string
        privateKey?: string
        passphrase?: string
      } = {
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
      // Use Vite proxy or same-origin path in production
      const res = await fetch(`/ssh/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        let bodyText = ''
        try { bodyText = await res.text() } catch (e) { bodyText = String(e) }
        console.error('Failed to create SSH session', { status: res.status, statusText: res.statusText, body: bodyText })
        toast({ title: 'Failed to create session', description: bodyText || res.statusText, variant: 'destructive' })
        return
      }
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

      // Track recent terminal connection
      await addRecentTerminal({
        host: form.host,
        port: Number(form.port) || 22,
        username: form.username,
        authMode: form.authMode,
        name: `${form.username}@${form.host}`,
      })

      setTimeout(() => attachTerminal(sessionId, containerRef), 0)
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  const attachTerminal = (id: string, containerRef: React.RefObject<HTMLDivElement | null>) => {
    const token = session?.access_token
    if (!token) {
      console.error('No access token available for SSH connection')
      setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'error' } : s))
      return
    }

    // Build WS URL against current origin; Vite dev server proxies /ssh with ws enabled
    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsHost = location.host // includes port
    const wsUrl = `${wsProtocol}//${wsHost}/ssh/sessions/${id}/attach?token=${encodeURIComponent(token)}`

    console.log('Opening SSH WebSocket connection:', {
      sessionId: id,
      wsUrl: wsUrl.replace(/token=[^&]*/, 'token=[HIDDEN]'),
    })

    const ws = new WebSocket(wsUrl)

    // Set up connection timeout
    const connectionTimeout = setTimeout(() => {
      console.error('SSH WebSocket connection timeout')
      ws.close(1000, 'connection_timeout')
    }, 10000)

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: terminalSettings.fontSize,
      convertEol: true,
      theme: getXTermTheme(terminalSettings.theme),
      allowTransparency: true,
      rightClickSelectsWord: true,
      // Mobile-friendly settings
      ...(mobile && {
        lineHeight: 1.2,
        letterSpacing: 0,
      }),
      // Force terminal to respect container width
      cols: mobile ? 60 : 80,
      rows: mobile ? 20 : 25,
      scrollback: mobile ? 100 : 1000,
    })


    const fit = new FitAddon()
    term.loadAddon(fit)

    ws.binaryType = 'arraybuffer'

    ws.onmessage = (ev) => {
      try {
        if (ev.data instanceof ArrayBuffer) {
          const text = new TextDecoder().decode(new Uint8Array(ev.data))
          term.write(text)
        } else if (typeof ev.data === 'string') {
          term.write(ev.data)
        }
      } catch (error) {
        console.error('Error processing WebSocket message', { sessionId: id, error })
      }
    }

    ws.onclose = (ev: CloseEvent) => {
      clearTimeout(connectionTimeout)
      const code = ev.code || 0
      const reason = ev.reason || 'unknown'
      console.log('SSH WebSocket closed', { sessionId: id, code, reason })

      // Clean up terminal
      try {
        const cleanupResize = (term as unknown as { _cleanupResize?: (() => void) | null })._cleanupResize
        if (cleanupResize) {
          window.removeEventListener('resize', cleanupResize)
        }
        term.dispose()
      } catch (error) {
        console.error('Error cleaning up terminal', { sessionId: id, error })
      }

      setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'closed' } : s))
    }

    ws.onerror = (err) => {
      clearTimeout(connectionTimeout)
      console.error('SSH WebSocket error', { sessionId: id, err })

      // Clean up terminal on error
      try {
        const cleanupResize = (term as unknown as { _cleanupResize?: (() => void) | null })._cleanupResize
        if (cleanupResize) {
          window.removeEventListener('resize', cleanupResize)
        }
        term.dispose()
      } catch (error) {
        console.error('Error cleaning up terminal after WebSocket error', { sessionId: id, error })
      }

      setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'error' } : s))
    }

    // Handle connection state changes for better UX
    ws.onopen = () => {
      console.log('SSH WebSocket connected successfully', { sessionId: id })
      clearTimeout(connectionTimeout)

      setSessions(prev => prev.map(s => s.id === id ? { ...s, ws, term, fit, status: 'connected' } : s))

      if (containerRef.current) {
        try {
          term.open(containerRef.current)
          fit.fit()

          // Add CSS classes to prevent overflow
          const termElement = term.element
          if (termElement) {
            termElement.classList.add('xterm-container')
            // Use setTimeout to ensure DOM is fully rendered
            setTimeout(() => {
              const viewport = termElement.querySelector('.xterm-viewport') as HTMLElement
              if (viewport) {
                viewport.classList.add('xterm-viewport')
                // Force viewport to respect boundaries
                viewport.style.overflow = 'hidden'
                viewport.style.maxWidth = '100%'
                viewport.style.width = '100%'
              }
              const screen = termElement.querySelector('.xterm-screen') as HTMLElement
              if (screen) {
                screen.classList.add('xterm-screen')
                // Force screen to respect boundaries
                screen.style.overflow = 'hidden'
                screen.style.maxWidth = '100%'
                screen.style.width = '100%'
              }
              // Force the entire terminal element to respect boundaries
              ;(termElement as HTMLElement).style.overflow = 'hidden'
              ;(termElement as HTMLElement).style.maxWidth = '100%'
              ;(termElement as HTMLElement).style.width = '100%'
            }, 0)
          }

          // Send initial resize
          const cols = term.cols
          const rows = term.rows
          console.log('Sending initial terminal size', { sessionId: id, cols, rows })
          ws.send(JSON.stringify({ type: 'resize', cols, rows }))
        } catch (error) {
          console.error('Error initializing terminal', { sessionId: id, error })
        }
      }

      // Focus terminal only if it's the active session
      if (activeId === id) {
        term.focus()
      }

      // Handle terminal input
      term.onData(data => {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data)
          } else {
            console.warn('Cannot send data: WebSocket not open', { sessionId: id, readyState: ws.readyState })
          }
        } catch (error) {
          console.error('Error sending terminal data', { sessionId: id, error })
        }
      })

      // Handle window resize and orientation change
      const onResize = () => {
        try {
          fit.fit()
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
          }
        } catch (error) {
          console.error('Error handling resize', { sessionId: id, error })
        }
      }

      window.addEventListener('resize', onResize)

      // Handle orientation change on mobile devices
      if (mobile) {
        window.addEventListener('orientationchange', () => {
          // Delay to ensure the orientation change has completed
          setTimeout(onResize, 300)
        })
      }
      // Store cleanup handler on term
      ;(term as unknown as { _cleanupResize: (() => void) | null })._cleanupResize = onResize
    }
  }

  const closeSession = async (id: string) => {
    console.log('Closing SSH session', { sessionId: id })
    const s = sessions.find(x => x.id === id)

    if (!s) {
      console.warn('Session not found for closing', { sessionId: id })
      return
    }

    // Update session status to 'closed' immediately
    setSessions(prev => prev.map(session =>
      session.id === id ? { ...session, status: 'closed' } : session
    ))

    // Delete session on server FIRST, before closing WebSocket
    // This prevents the WebSocket close handler from cleaning up the session
    try {
      const response = await fetch(`/ssh/sessions/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      })

    // Close WebSocket connection
    try {
      if (s.ws && s.ws.readyState === WebSocket.OPEN) {
        s.ws.close(1000, 'user_closed')
        console.log('WebSocket closed', { sessionId: id })
      }
    } catch (error) {
      console.error('Error closing WebSocket', { sessionId: id, error })
    }

    // Clean up terminal and event listeners
    try {
      const cleanupResize = (s.term as unknown as { _cleanupResize?: (() => void) | null })?._cleanupResize
      if (cleanupResize) {
        window.removeEventListener('resize', cleanupResize)
      }
      s.term?.dispose()
      console.log('Terminal disposed', { sessionId: id })
    } catch (error) {
      console.error('Error disposing terminal', { sessionId: id, error })
    }

    // Remove session from state
    setSessions(prev => {
      const newSessions = prev.filter(x => x.id !== id)
      // Update activeId if we're closing the active session
      if (activeId === id) {
        setActiveId(newSessions.length > 0 ? newSessions[0].id : null)
      }
      return newSessions
    })

      if (!response.ok) {
        // Don't treat 404 or 409 as errors since session might already be cleaned up
        if (response.status === 404) {
          console.log('Session already cleaned up on server', { sessionId: id })
        } else if (response.status === 409) {
          console.log('Session is already being cleaned up', { sessionId: id })
        } else {
          // Get the response body for better error debugging
          let errorBody = 'Unable to parse error response'
          try {
            errorBody = await response.text()
          } catch (e) {
            console.debug('Could not read error response body', { sessionId: id, error: e })
          }

          console.error('Failed to delete session on server', {
            sessionId: id,
            status: response.status,
            statusText: response.statusText,
            responseBody: errorBody
          })
        }
      } else {
        console.log('Session deleted on server', { sessionId: id })
      }
    } catch (error) {
      console.error('Error deleting session on server', { sessionId: id, error })
    }
  }

  // Cleanup function for component unmount
  useEffect(() => {
    return () => {
      // Cleanup all sessions when component unmounts
      sessions.forEach(s => {
        try {
          if (s.ws && s.ws.readyState === WebSocket.OPEN) {
            s.ws.close(1000, 'component_unmount')
          }
          const cleanupResize = (s.term as unknown as { _cleanupResize?: (() => void) | null })?._cleanupResize
          if (cleanupResize) {
            window.removeEventListener('resize', cleanupResize)
            // Also remove orientation change listener on mobile
            if (mobile) {
              window.removeEventListener('orientationchange', cleanupResize)
            }
          }
          s.term?.dispose()
        } catch (error) {
          console.error('Error during session cleanup on unmount', { sessionId: s.id, error })
        }
      })
    }
  }, [sessions, mobile])

  // Helper function to check if we can create a new session
  const canCreate = form.host && form.username && (form.authMode === 'password' ? !!form.password : !!form.privateKey)

  // Helper function to get session status color
  const getStatusColor = (status: SessionState['status']) => {
    switch (status) {
      case 'connected': return 'bg-green-100 text-green-800'
      case 'connecting': return 'bg-yellow-100 text-yellow-800'
      case 'error': return 'bg-red-100 text-red-800'
      case 'closed': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Helper function to check if maximum sessions limit is reached
  const maxSessionsReached = sessions.length >= 10 // Limit to 10 concurrent sessions

  // Quick connect to recent terminal
  const quickConnect = async (terminal: RecentTerminal) => {
    if (maxSessionsReached) {
      toast({
        title: 'Session limit reached',
        description: 'Maximum of 10 concurrent sessions allowed.',
        variant: 'destructive',
      })
      return
    }

    // Check if already connected to this terminal
    const existingSession = sessions.find(s => s.title === terminal.name)
    if (existingSession) {
      setActiveId(existingSession.id)
      return
    }

    // Set form values and create session
    setForm(prev => ({
      ...prev,
      mode: 'manual',
      host: terminal.host,
      port: terminal.port.toString(),
      username: terminal.username,
      authMode: terminal.authMode,
      // Note: We can't restore password/privateKey from recent connections for security
      password: '',
      privateKey: '',
      passphrase: '',
    }))

    // Try to find in vault first
    const vaultItem = sshItems.find(item =>
      item.data?.host === terminal.host &&
      item.data?.username === terminal.username &&
      Number(item.data?.port || 22) === terminal.port
    )

    if (vaultItem) {
      setForm(prev => ({
        ...prev,
        mode: 'vault',
        vaultItemId: vaultItem.id,
      }))
    }

    toast({
      title: 'Quick Connect',
      description: `Connecting to ${terminal.name}...`,
    })

    // Create session after a brief delay to allow form to update
    setTimeout(() => createSession(), 100)
  }

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
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error'
      toast({ title: 'Error saving to vault', description: errorMessage, variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Computer className="h-5 w-5" /> SSH Terminals
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Terminal Settings</DialogTitle>
              </DialogHeader>
              <TerminalSettings />
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          {/* Connection Mode Selection */}
          <div className="space-y-2">
            <Label>Source</Label>
            <Select value={form.mode} onValueChange={(v: 'manual' | 'vault') => setForm(f => ({ ...f, mode: v }))}>
              <SelectTrigger className={mobile ? "w-full" : "w-auto"}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="vault" disabled={sshItems.length === 0}>From Vault</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Vault Selection - Only shown when mode is vault */}
          {form.mode === 'vault' && (
            <div className="space-y-2">
              <Label>SSH Credential</Label>
              <Select value={form.vaultItemId} onValueChange={(v: string) => setForm(f => ({ ...f, vaultItemId: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={sshItems.length ? 'Choose a saved server' : 'No SSH items in vault'} />
                </SelectTrigger>
                <SelectContent>
                  {sshItems.map(item => (
                    <SelectItem key={item.id} value={item.id}>{item.name} ({item.data?.username}@{item.data?.host})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Connection Details - Responsive Grid */}
          <ResponsiveGrid config="formColumns" gap="gap" className="w-full">
            <div className="space-y-2">
              <Label>Host</Label>
              <Input
                value={form.host}
                onChange={e => setForm(f => ({ ...f, host: e.target.value }))}
                placeholder="example.com"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>Port</Label>
              <Input
                value={form.port}
                onChange={e => setForm(f => ({ ...f, port: e.target.value }))}
                placeholder="22"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="root"
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label>Auth</Label>
              <Select value={form.authMode} onValueChange={(v: AuthMode) => setForm(f => ({ ...f, authMode: v }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="password">Password</SelectItem>
                  <SelectItem value="key">Private Key</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </ResponsiveGrid>

          {/* Authentication Details */}
          {form.authMode === 'password' ? (
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={form.password || ''}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Private Key (PEM)</Label>
                <Textarea
                  value={form.privateKey || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm(f => ({ ...f, privateKey: e.target.value }))}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY----- ..."
                  rows={mobile ? 3 : 4}
                  className="w-full font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Passphrase (optional)</Label>
                <Input
                  type="password"
                  value={form.passphrase || ''}
                  onChange={e => setForm(f => ({ ...f, passphrase: e.target.value }))}
                  className="w-full"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <ResponsiveButtonGroup orientation={mobile ? "vertical" : "horizontal"} className="w-full">
            <Button
              disabled={!canCreate || creating || maxSessionsReached}
              onClick={createSession}
              className={mobile ? "w-full" : "flex-1"}
              title={maxSessionsReached ? 'Maximum sessions limit reached (10)' : ''}
            >
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />} New Session
            </Button>
            <Button
              variant="outline"
              disabled={!canCreate}
              onClick={saveToVault}
              className={mobile ? "w-full" : "flex-1"}
            >
              <Save className="h-4 w-4 mr-2" /> Save to Vault
            </Button>
          </ResponsiveButtonGroup>
          {maxSessionsReached && (
            <p className="text-xs text-muted-foreground">Close an existing tab to start a new session.</p>
          )}
        </div>

        {/* Recent Terminals Section */}
        {recentTerminals.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4" />
                <Label className="text-sm font-medium">Recent Connections</Label>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={recentFilter}
                    onChange={(e) => setRecentFilter(e.target.value)}
                    placeholder="Filter..."
                    className="pl-7 h-8 w-[140px] sm:w-[200px]"
                  />
                </div>
                <Button size="sm" variant="ghost" onClick={() => clearRecentTerminals()} title="Clear all">
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid gap-2 max-h-56 overflow-y-auto">
              {recentTerminals
                .filter(t => !recentFilter || t.name.toLowerCase().includes(recentFilter.toLowerCase()) || t.host.toLowerCase().includes(recentFilter.toLowerCase()))
                .map((terminal) => (
                <Card key={terminal.id} className="p-3 hover:bg-muted/50 transition-colors cursor-pointer" onDoubleClick={() => quickConnect(terminal)}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Computer className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium text-sm truncate">{terminal.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          terminal.authMode === 'password'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {terminal.authMode}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(terminal.lastConnected).toLocaleDateString()}
                        </span>
                        <span>Port {terminal.port}</span>
                        <span>{terminal.connectionCount} connection{terminal.connectionCount !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => quickConnect(terminal)}
                        disabled={maxSessionsReached}
                        className="ml-2"
                      >
                        <Zap className="h-3 w-3 mr-1" />
                        Connect
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => removeRecentTerminal(terminal.id)} title="Remove" className="h-8 w-8">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {sessions.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">No sessions yet. Create one above.</div>
        ) : (
          <>
            <div className="mb-4 text-sm text-muted-foreground">
              {sessions.length} active session{sessions.length !== 1 ? 's' : ''} • {sessions.filter(s => s.status === 'connected').length} connected
            </div>
            <Tabs value={activeId ?? sessions[0]?.id} onValueChange={setActiveId}>
              <div className="w-full overflow-hidden">
                <TabsList className={`${mobile ? 'flex overflow-x-auto scrollbar-hide pb-1 min-w-0' : 'flex flex-wrap'} gap-1 ${mobile ? 'px-1' : ''} w-full`}>
                  {sessions.map(s => (
                    <TabsTrigger
                      key={s.id}
                      value={s.id}
                      className={`group flex items-center gap-2 whitespace-nowrap ${mobile ? 'text-xs px-2 py-1 flex-shrink-0' : ''}`}
                    >
                      <span className={`truncate ${mobile ? 'max-w-[80px] sm:max-w-[120px]' : 'max-w-none'}`}>{s.title}</span>
                      <span className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full ${getStatusColor(s.status)} flex-shrink-0`}>
                        {s.status === 'connecting' && <Loader2 className="h-3 w-3 animate-spin" />}
                        {s.status}
                      </span>
                      <span
                        role="button"
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); closeSession(s.id) }}
                        className={`ml-1 rounded hover:bg-muted p-0.5 hidden ${mobile ? '' : 'group-hover:inline-flex'} cursor-pointer`}
                        title="Close tab"
                        aria-label={`Close ${s.title}`}
                      >
                        <X className="h-3 w-3" />
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
            {sessions.map(s => (
              <TabsContent key={s.id} value={s.id} className="mt-2">
                <div className={`flex items-center gap-2 mb-2 ${mobile ? 'justify-center' : 'justify-between'}`}>
                  <div className="flex items-center gap-2">
                    <Button
                      size={mobile ? "sm" : "sm"}
                      variant="outline"
                      onClick={() => closeSession(s.id)}
                      className={mobile ? "text-xs" : ""}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Close
                    </Button>
                    {!mobile && (
                      <span className={`text-sm px-2 py-1 rounded-full ${getStatusColor(s.status)}`}>
                        {s.status === 'connecting' && <Loader2 className="h-3 w-3 mr-1 inline animate-spin" />} {s.status}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => { try { s.fit?.fit() } catch {} }} title="Fit to container">
                      <Maximize2 className="h-4 w-4 mr-1" /> Fit
                    </Button>
                    <Button size="sm" variant="outline" onClick={async () => { try { const sel = s.term?.getSelection() || ''; await navigator.clipboard.writeText(sel); toast({ title: 'Copied', description: 'Selection copied to clipboard.' }) } catch (e) { toast({ title: 'Copy failed', description: e instanceof Error ? e.message : 'Unable to copy', variant: 'destructive' }) } }} title="Copy selection">
                      <CopyIcon className="h-4 w-4 mr-1" /> Copy
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { try { s.term?.clear() } catch {} }} title="Clear terminal">
                      <Eraser className="h-4 w-4 mr-1" /> Clear
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setFullscreenId(prev => prev === s.id ? null : s.id)} title={fullscreenId === s.id ? 'Exit fullscreen' : 'Fullscreen'}>
                      {fullscreenId === s.id ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className={`${fullscreenId === s.id ? 'fixed inset-0 z-50 p-2 sm:p-4 bg-background/90 backdrop-blur' : ''}`}>
                  <div
                      ref={s.containerRef}
                      data-terminal="true"
                      className={`${mobile ? 'h-[300px] sm:h-[350px]' : 'h-[420px]'} ${fullscreenId === s.id ? 'h-[calc(100vh-1rem)] sm:h-[calc(100vh-2rem)]' : ''} w-full rounded border overflow-hidden bg-black xterm-container no-page-h-scroll`}
                      style={{ 
                        overflow: 'hidden',
                        maxWidth: '100%',
                        width: '100%',
                        boxSizing: 'border-box' as const
                      }}
                    />
                </div>
              </TabsContent>
            ))}
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  )
}
