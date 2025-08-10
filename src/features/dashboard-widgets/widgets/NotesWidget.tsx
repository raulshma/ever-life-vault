import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { useNotes } from '@/hooks/useNotes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Link } from 'react-router-dom'

type NotesConfig = { max?: number }

export default function NotesWidget({ config }: WidgetProps<NotesConfig>) {
  const { notes, addNote } = useNotes()
  const [title, setTitle] = React.useState('')
  const max = typeof config?.max === 'number' ? config.max : 5
  const top = notes.slice(0, max)

  const onAdd = async () => {
    if (!title.trim()) return
    await addNote(title.trim(), '')
    setTitle('')
  }

  return (
    <WidgetShell title="Notes">
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input placeholder="Quick note title" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onAdd() }} />
          <Button onClick={onAdd}>Add</Button>
        </div>
        <ul className="space-y-1 text-sm">
          {top.length === 0 ? (
            <li className="text-muted-foreground">No notes yet.</li>
          ) : (
            top.map((n) => (
              <li key={n.id} className="truncate">{n.title}</li>
            ))
          )}
        </ul>
        <div className="text-right">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/knowledge">Open Knowledge</Link>
          </Button>
        </div>
      </div>
    </WidgetShell>
  )
}


