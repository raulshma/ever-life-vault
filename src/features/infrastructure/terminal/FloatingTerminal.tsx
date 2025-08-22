import React from 'react'
import { useTerminal } from './TerminalProvider'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'

export const FloatingTerminal: React.FC = () => {
  const { sessions, activeId, setActiveId, closeSession, mountSessionInto } = useTerminal()
  const [collapsed, setCollapsed] = React.useState(false)
  const hostRef = React.useRef<HTMLDivElement | null>(null)
  const location = useLocation()

  // Hide PiP on the terminals page
  const onTerminalsPage = location.pathname.startsWith('/infrastructure/terminals')

  React.useEffect(() => {
    const active = sessions.find(s => s.id === activeId) ?? sessions[0]
    if (!active || !hostRef.current) return
    mountSessionInto(active.id, hostRef.current)
  }, [activeId, sessions, mountSessionInto])

  // When expanding from collapsed state, remount/fit the terminal to avoid blank view
  React.useEffect(() => {
    if (!collapsed) {
      const active = sessions.find(s => s.id === activeId) ?? sessions[0]
      if (active && hostRef.current) {
        mountSessionInto(active.id, hostRef.current)
      }
    }
  }, [collapsed, activeId, sessions, mountSessionInto])

  if (onTerminalsPage || !sessions.length) return null

  const active = sessions.find(s => s.id === activeId) ?? sessions[0]

  return (
    <div className="fixed right-3 bottom-3 z-50 w-[min(640px,95vw)] shadow-lg rounded-md border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="flex items-center justify-between px-2 py-1 border-b">
        <div className="flex items-center gap-2 text-sm">
          <select
            className="bg-transparent outline-none"
            value={active?.id}
            onChange={(e) => setActiveId(e.target.value)}
          >
            {sessions.map(s => (
              <option key={s.id} value={s.id}>{s.title} • {s.status}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => setCollapsed(v => !v)} aria-label="Toggle size" className="h-7 w-7">
            {collapsed ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
          </Button>
          {active && (
            <Button size="icon" variant="ghost" onClick={() => closeSession(active.id)} aria-label="Close" className="h-7 w-7">
              <X className="h-4 w-4"/>
            </Button>
          )}
        </div>
      </div>
    {!collapsed && (
        <div className="p-2">
      <div ref={hostRef} data-terminal className="h-[300px] w-full rounded bg-black overflow-hidden" />
        </div>
      )}
    </div>
  )
}
