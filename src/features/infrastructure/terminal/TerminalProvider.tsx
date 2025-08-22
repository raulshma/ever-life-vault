import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Terminal as XTerm } from 'xterm'
import 'xterm/css/xterm.css'
import { FitAddon } from 'xterm-addon-fit'
import { getXTermTheme } from '../utils/terminalThemes'
import { useTerminalSettings } from '../hooks'

export type AuthMode = 'password' | 'key'

export type NewSessionRequest = {
  host: string
  port: number
  username: string
  authMode: AuthMode
  password?: string
  privateKey?: string
  passphrase?: string
}

export type TerminalSession = {
  id: string
  title: string
  ws?: WebSocket
  term?: XTerm
  fit?: FitAddon
  status: 'connecting' | 'connected' | 'closed' | 'error'
  // Root container that owns xterm DOM; we move it between hosts for PiP vs Page
  rootContainer?: HTMLDivElement
}

type TerminalContextValue = {
  sessions: TerminalSession[]
  activeId: string | null
  setActiveId: (id: string | null) => void
  createSession: (req: NewSessionRequest) => Promise<string | null>
  closeSession: (id: string) => Promise<void>
  mountSessionInto: (id: string, hostEl: HTMLElement | null) => void
}

const TerminalContext = createContext<TerminalContextValue | null>(null)

export const useTerminal = () => {
  const ctx = useContext(TerminalContext)
  if (!ctx) throw new Error('useTerminal must be used within TerminalProvider')
  return ctx
}

export const TerminalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuth()
  const { settings } = useTerminalSettings()
  const [sessions, setSessions] = useState<TerminalSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  // Keep a map of current host mounts so we can re-parent rootContainer
  const hostMounts = useRef(new Map<string, HTMLElement>())

  // Apply settings live
  useEffect(() => {
    sessions.forEach(s => {
      if (s.term) {
        try {
          const setOpt = (s.term as any).setOption
          if (typeof setOpt === 'function') {
            setOpt.call(s.term, 'fontSize', settings.fontSize)
            setOpt.call(s.term, 'theme', getXTermTheme(settings.theme))
          }
          s.fit?.fit()
        } catch (e) {
          console.warn('Failed to apply terminal option', { id: s.id, e })
        }
      }
    })
  }, [settings.fontSize, settings.theme, sessions])

  const closeSession = useCallback(async (id: string) => {
    const s = sessions.find(x => x.id === id)
    if (!s) return
    setSessions(prev => prev.map(x => x.id === id ? { ...x, status: 'closed' } : x))

    try {
      await fetch(`/ssh/sessions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      })
    } catch {}

    try { s.ws && s.ws.readyState === WebSocket.OPEN && s.ws.close(1000, 'user_closed') } catch {}
    try { s.term?.dispose() } catch {}

    setSessions(prev => prev.filter(x => x.id !== id))
    if (activeId === id) setActiveId(null)
    hostMounts.current.delete(id)
  }, [sessions, session?.access_token, activeId])

  // Close all sessions on full page refresh/unload
  useEffect(() => {
    const onBeforeUnload = () => {
      sessions.forEach(s => {
        try { navigator.sendBeacon?.(`/ssh/sessions/${s.id}`, JSON.stringify({ _method: 'DELETE' })) } catch {}
        try { s.ws && s.ws.readyState === WebSocket.OPEN && s.ws.close(1000, 'page_unload') } catch {}
      })
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [sessions])

  const mountSessionInto = useCallback((id: string, hostEl: HTMLElement | null) => {
    const s = sessions.find(x => x.id === id)
    if (!s || !hostEl) return
    hostMounts.current.set(id, hostEl)

    const attach = () => {
      if (!hostEl) return
      if (!s.rootContainer) {
        // Will be set after ws open; retry shortly
        setTimeout(attach, 50)
        return
      }
      try {
        while (hostEl.firstChild) hostEl.removeChild(hostEl.firstChild)
        hostEl.appendChild(s.rootContainer)
        setTimeout(() => s.fit?.fit(), 0)
      } catch (e) {
        console.warn('Failed to mount session into host', { id, e })
      }
    }
    attach()
  }, [sessions])

  const attachTerminal = useCallback((id: string) => {
    const token = session?.access_token
    if (!token) {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'error' } : s))
      return
    }
    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${wsProtocol}//${location.host}/ssh/sessions/${id}/attach?token=${encodeURIComponent(token)}`
    const ws = new WebSocket(wsUrl)
    const term = new XTerm({
      cursorBlink: true,
      fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: settings.fontSize,
      convertEol: true,
      theme: getXTermTheme(settings.theme),
      allowTransparency: true,
      rightClickSelectsWord: true,
      cols: 80,
      rows: 25,
      scrollback: 1000,
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
      } catch (e) {
        console.error('WS message error', e)
      }
    }
    ws.onopen = () => {
      setSessions(prev => prev.map(s => s.id === id ? { ...s, ws, term, fit, status: 'connected' } : s))
  // Create persistent root container and open once
  const root = document.createElement('div')
  root.style.width = '100%'
  root.style.height = '100%'
      term.open(root)
      fit.fit()
      // Send initial size
      try { ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows })) } catch {}
      // If a host has been mounted, move into it
  const host = hostMounts.current.get(id)
  if (host) {
        try {
          while (host.firstChild) host.removeChild(host.firstChild)
          host.appendChild(root)
          setTimeout(() => fit.fit(), 0)
        } catch {}
      }
      // Input
      term.onData(data => { try { ws.readyState === WebSocket.OPEN && ws.send(data) } catch {} })
      // Resize
      const onResize = () => {
        try { fit.fit(); ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows })) } catch {}
      }
      window.addEventListener('resize', onResize)
      ;(term as any)._cleanupResize = onResize

      // Store root container
      setSessions(prev => prev.map(s => s.id === id ? { ...s, rootContainer: root } : s))
    }
    ws.onerror = () => setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'error' } : s))
    ws.onclose = () => {
      try {
        const handler = (term as any)._cleanupResize
        if (handler) window.removeEventListener('resize', handler)
        term.dispose()
      } catch {}
      setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'closed' } : s))
    }
  }, [session?.access_token, settings.fontSize, settings.theme])

  const createSession = useCallback(async (req: NewSessionRequest): Promise<string | null> => {
    if (!session?.access_token) return null
    const res = await fetch('/ssh/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        host: req.host,
        port: req.port,
        username: req.username,
        password: req.authMode === 'password' ? req.password : undefined,
        privateKey: req.authMode === 'key' ? req.privateKey : undefined,
        passphrase: req.authMode === 'key' ? req.passphrase : undefined,
      }),
    })
    if (!res.ok) return null
    const { sessionId } = await res.json()
    const title = `${req.username}@${req.host}`
    setSessions(prev => [...prev, { id: sessionId, title, status: 'connecting' }])
    setActiveId(sessionId)
    // Attach terminal asynchronously
    setTimeout(() => attachTerminal(sessionId), 0)
    return sessionId
  }, [session?.access_token, attachTerminal])

  const value = useMemo<TerminalContextValue>(() => ({
    sessions,
    activeId,
    setActiveId,
    createSession,
    closeSession,
    mountSessionInto,
  }), [sessions, activeId, createSession, closeSession, mountSessionInto])

  return (
    <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>
  )
}
