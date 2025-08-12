import React from 'react'
import { WidgetShell } from '../components/WidgetShell'
import type { WidgetProps } from '../types'
import { useTasks } from '@/hooks/useTasks'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Link } from 'react-router-dom'

type TasksConfig = { max?: number }

export default function TasksWidget({ config }: WidgetProps<TasksConfig>) {
  const { tasks, loading, addTask, updateTask } = useTasks()
  const [title, setTitle] = React.useState('')
  const max = typeof config?.max === 'number' ? config.max : 6
  const top = tasks.slice(0, max)

  const onAdd = async () => {
    if (!title.trim()) return
    await addTask(title.trim())
    setTitle('')
  }

  const onToggle = async (id: string, checked: boolean) => {
    await updateTask(id, { status: checked ? 'done' as const : 'todo' as const })
  }

  return (
    <WidgetShell title="Tasks">
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input placeholder="Quick add task" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onAdd() }} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" aria-label="Add" onClick={onAdd}>
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add</TooltipContent>
          </Tooltip>
        </div>
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: max }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))
          ) : top.length === 0 ? (
            <div className="text-sm text-muted-foreground">No tasks yet.</div>
          ) : (
            top.map((t) => (
              <label key={t.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={t.status === 'done'} onCheckedChange={(v) => onToggle(t.id, Boolean(v))} />
                <span className={t.status === 'done' ? 'line-through text-muted-foreground' : ''}>{t.title}</span>
              </label>
            ))
          )}
        </div>
        <div className="text-right">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/day-tracker">Open Day Tracker</Link>
          </Button>
        </div>
      </div>
    </WidgetShell>
  )
}


