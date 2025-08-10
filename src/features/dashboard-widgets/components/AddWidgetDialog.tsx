import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useWidgetRegistry } from '../registry'
import { useDashboardRuntime } from '../runtime'

export function AddWidgetDialog() {
  const registry = useWidgetRegistry()
  const { addWidget } = useDashboardRuntime()
  const widgets = registry.list()
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default">Add widget</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a widget</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-auto">
          {widgets.map((w) => (
            <button
              key={w.id}
              onClick={() => { addWidget(w); setOpen(false) }}
              className="p-3 rounded-md border hover:bg-muted text-left"
            >
              <div className="font-medium">{w.title}</div>
              <div className="text-xs text-muted-foreground">{w.category}</div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}


