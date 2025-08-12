import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ClipboardCopy, ClipboardPaste, Save, Eraser } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { useNotes } from '@/hooks/useNotes'

type ScratchConfig = {
  autoClearMs?: number | null
  historySize?: number
}

export default function ClipboardScratchpadWidget({ config, onConfigChange }: WidgetProps<ScratchConfig>) {
  const [text, setText] = React.useState('')
  const [history, setHistory] = React.useState<string[]>([])
  const { addNote } = useNotes()
  const historySize = typeof config?.historySize === 'number' ? Math.max(1, Math.min(100, config.historySize)) : 10

  React.useEffect(() => {
    if (!config?.autoClearMs || config.autoClearMs <= 0 || !text) return
    const id = window.setTimeout(() => {
      setHistory((prev) => [text, ...prev].slice(0, historySize))
      setText('')
    }, config.autoClearMs)
    return () => window.clearTimeout(id)
  }, [text, config?.autoClearMs, historySize])

  const paste = async () => {
    try { const v = await navigator.clipboard.readText(); setText(v) } catch {}
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(text) } catch {}
  }

  const saveAsNote = async () => {
    if (!text.trim()) return
    await addNote(text.slice(0, 48), text)
  }

  const clearNow = () => {
    setHistory((prev) => [text, ...prev].slice(0, historySize))
    setText('')
  }

  return (
    <WidgetShell
      title="Scratchpad"
      actions={
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="outline" aria-label="Clear" onClick={clearNow}>
              <Eraser className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear</TooltipContent>
        </Tooltip>
      }
    >
      <div className="space-y-3">
        <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type or paste here..." />
        <div className="flex flex-wrap gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" aria-label="Paste" onClick={paste}>
                <ClipboardPaste className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Paste</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="outline" aria-label="Copy" onClick={copy}>
                <ClipboardCopy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Save to notes" onClick={saveAsNote}>
                <Save className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save to notes</TooltipContent>
          </Tooltip>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span>Auto-clear (ms):</span>
          <input
            type="number"
            min={0}
            className="h-8 w-28 rounded-md border bg-background px-2 text-sm"
            value={config?.autoClearMs ?? 0}
            onChange={(e) => onConfigChange({ ...config, autoClearMs: Number(e.target.value) })}
          />
          <span>History size:</span>
          <input
            type="number"
            min={1}
            max={100}
            className="h-8 w-24 rounded-md border bg-background px-2 text-sm"
            value={historySize}
            onChange={(e) => onConfigChange({ ...config, historySize: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-1">
          {history.map((h, i) => (
            <div key={i} className="text-xs text-muted-foreground truncate">{h}</div>
          ))}
          {history.length === 0 && <div className="text-xs text-muted-foreground">No history yet.</div>}
        </div>
      </div>
    </WidgetShell>
  )
}


