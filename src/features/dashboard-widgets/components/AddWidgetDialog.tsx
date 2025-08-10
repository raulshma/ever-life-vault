import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWidgetRegistry } from '../registry'
import { useDashboardRuntime } from '../runtime'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export function AddWidgetDialog() {
  const registry = useWidgetRegistry()
  const { addWidget } = useDashboardRuntime()
  const widgets = registry.list()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [category, setCategory] = React.useState<'all' | 'shortcuts' | 'helpers' | 'analytics' | 'actions' | 'other'>('all')
  const [defaultSpan, setDefaultSpan] = React.useState<'1' | '2' | '3' | '4'>('1')
  const [defaultRowSpan, setDefaultRowSpan] = React.useState<'1' | '2' | '3'>('1')

  const categories: Array<{ id: 'all' | 'shortcuts' | 'helpers' | 'analytics' | 'actions' | 'other'; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'shortcuts', label: 'Shortcuts' },
    { id: 'helpers', label: 'Helpers' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'actions', label: 'Actions' },
    { id: 'other', label: 'Other' },
  ]

  const filtered = widgets.filter((w) => {
    const q = query.trim().toLowerCase()
    const inCategory = category === 'all' || w.category === category
    const matches = !q || w.title.toLowerCase().includes(q) || w.id.includes(q)
    return inCategory && matches
  })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">Add widget</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add a widget</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input placeholder="Search widgets..." value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="flex flex-wrap gap-1">
              {categories.map((c) => (
                <Button key={c.id} variant={category === c.id ? 'default' : 'ghost'} size="sm" onClick={() => setCategory(c.id)}>
                  {c.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div>Default size</div>
            <div className="flex items-center gap-2">
              <ToggleGroup type="single" value={defaultSpan} onValueChange={(v) => v && setDefaultSpan(v as any)}>
                {(['1','2','3','4'] as const).map((n) => (
                  <ToggleGroupItem key={n} value={n} size="sm" aria-label={`Col span ${n}`}>C{n}</ToggleGroupItem>
                ))}
              </ToggleGroup>
              <ToggleGroup type="single" value={defaultRowSpan} onValueChange={(v) => v && setDefaultRowSpan(v as any)}>
                {(['1','2','3'] as const).map((n) => (
                  <ToggleGroupItem key={n} value={n} size="sm" aria-label={`Row span ${n}`}>R{n}</ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((w) => (
              <button
                key={w.id}
                onClick={() => { addWidget(w, Number(defaultSpan) as any, Number(defaultRowSpan) as any); setOpen(false) }}
                className="p-3 rounded-lg glass hover:bg-muted/40 hover-lift text-left transition-colors"
              >
                <div className="font-medium">{w.title}</div>
                <div className="text-xs text-muted-foreground">{w.category}</div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full empty-bubble p-6 text-center text-muted-foreground">No widgets match your search</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}


