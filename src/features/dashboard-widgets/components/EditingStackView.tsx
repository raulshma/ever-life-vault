import React from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { useDashboardRuntime } from '../runtime'
import { useWidgetRegistry } from '../registry'
import type { GridColSpan, GridLayout, GridRowSpan, MosaicTree, WidgetInstanceId, WidgetProps } from '../types'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useDrag, useDrop } from 'react-dnd'

const DND_WIDGET_ITEM = 'dashboard-widget-item'

export default function EditingStackView() {
  return (
    <DndProvider backend={HTML5Backend}>
      <EditingStackInner />
    </DndProvider>
  )
}

function EditingStackInner() {
  const { layout, widgets, spans, rowSpans, setSpan, setRowSpan, updateWidgetConfig, reorderWidgets, removeWidget } = useDashboardRuntime()
  const registry = useWidgetRegistry()

  const orderedIds = React.useMemo(() => {
    if (layout && (layout as any).kind === 'grid') {
      const ord = (layout as GridLayout).order
      const known = ord.filter((id) => widgets[id])
      const remaining = Object.keys(widgets).filter((id) => !known.includes(id))
      return [...known, ...remaining]
    }
    const fromTree = collectLeafIds((layout && (layout as any).kind !== 'grid') ? (layout as MosaicTree) : null)
    const known = fromTree.filter((id) => widgets[id])
    const remaining = Object.keys(widgets).filter((id) => !known.includes(id))
    return [...known, ...remaining]
  }, [layout, widgets])

  if (orderedIds.length === 0) {
    return <div className="empty-bubble p-6 text-center text-muted-foreground">Add widgets to get started</div>
  }

  const spanToClass = (s: GridColSpan): string => {
    switch (s) {
      case 4: return 'col-span-1 sm:col-span-2 lg:col-span-3 2xl:col-span-4'
      case 3: return 'col-span-1 sm:col-span-2 lg:col-span-3'
      case 2: return 'col-span-1 sm:col-span-2'
      default: return 'col-span-1'
    }
  }
  const rowSpanToClass = (s: GridRowSpan): string => {
    switch (s) {
      case 3: return 'row-span-3'
      case 2: return 'row-span-2'
      default: return 'row-span-1'
    }
  }

  return (
    <div className="grid w-full min-w-0 overflow-visible auto-rows-[minmax(6rem,auto)] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
      {orderedIds.map((id, index) => {
        const state = widgets[id]
        if (!state) return null
        const def = registry.get(state.type)
        if (!def) return null
        const Component = def.component as React.ComponentType<WidgetProps<any>>
        const currentSpan = (spans[id] || 1) as GridColSpan
        const currentRowSpan = (rowSpans[id] || 1) as GridRowSpan
        return (
          <SortableWidgetTile
            key={id}
            id={id}
            index={index}
            moveItem={(from, to) => {
              if (from === to) return
              const next = [...orderedIds]
              const [moved] = next.splice(from, 1)
              next.splice(to, 0, moved)
              reorderWidgets(next)
            }}
            onRemove={() => removeWidget(id)}
            gridClassName={`${spanToClass(currentSpan)} ${rowSpanToClass(currentRowSpan)}`}
            currentSpan={currentSpan}
            onSpanChange={(s) => setSpan(id, s)}
            currentRowSpan={currentRowSpan}
            onRowSpanChange={(s) => setRowSpan(id, s)}
          >
            <React.Suspense fallback={<div className="glass rounded-xl p-4">Loading...</div>}>
              <Component id={id} config={state.config} onConfigChange={(next) => updateWidgetConfig(id, next)} />
            </React.Suspense>
          </SortableWidgetTile>
        )
      })}
    </div>
  )
}

function collectLeafIds(node: MosaicTree | null): WidgetInstanceId[] {
  if (!node) return []
  if (typeof node === 'string') return [node]
  const branch = node as unknown as { first: MosaicTree; second: MosaicTree }
  return [...collectLeafIds(branch.first), ...collectLeafIds(branch.second)]
}

function SortableWidgetTile({
  id,
  index,
  moveItem,
  onRemove,
  gridClassName,
  currentSpan,
  onSpanChange,
  currentRowSpan,
  onRowSpanChange,
  children,
}: {
  id: WidgetInstanceId
  index: number
  moveItem: (fromIndex: number, toIndex: number) => void
  onRemove: () => void
  gridClassName?: string
  currentSpan: GridColSpan
  onSpanChange: (span: GridColSpan) => void
  currentRowSpan: GridRowSpan
  onRowSpanChange: (span: GridRowSpan) => void
  children: React.ReactNode
}) {
  const ref = React.useRef<HTMLDivElement | null>(null)

  const [, drop] = useDrop({
    accept: DND_WIDGET_ITEM,
    hover(item: { id: WidgetInstanceId; index: number }) {
      if (!ref.current) return
      const dragIndex = item.index
      const hoverIndex = index
      if (dragIndex === hoverIndex) return
      moveItem(dragIndex, hoverIndex)
      item.index = hoverIndex
    },
  })

  const [{ isDragging }, drag] = useDrag({
    type: DND_WIDGET_ITEM,
    item: { id, index },
    canDrag: () => true,
    collect: (monitor) => ({ isDragging: !!monitor.isDragging() }),
  })

  drag(drop(ref))

  return (
    <div ref={ref} className={(isDragging ? 'opacity-60 ' : '') + 'min-w-0 ' + (gridClassName || '')}>
      <div className="relative">
        <div className="absolute inset-x-0 -top-2 z-10 px-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs rounded bg-card/80 px-2 py-0.5 border">Drag to reorder</div>
            <div className="ml-auto flex items-center gap-1 overflow-x-auto">
              <ToggleGroup type="single" value={String(currentSpan)} onValueChange={(v) => v && onSpanChange(Number(v) as GridColSpan)}>
                {[1,2,3,4].map((n) => (
                  <ToggleGroupItem key={n} value={String(n)} size="sm" aria-label={`Span ${n} columns`}>
                    {n}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <ToggleGroup type="single" value={String(currentRowSpan)} onValueChange={(v) => v && onRowSpanChange(Number(v) as GridRowSpan)}>
                {[1,2,3].map((n) => (
                  <ToggleGroupItem key={n} value={String(n)} size="sm" aria-label={`Row span ${n}`}>
                    R{n}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <button
                aria-label="Remove widget"
                className="rounded bg-destructive/90 text-destructive-foreground px-2 py-0.5 text-xs hover:bg-destructive"
                onClick={onRemove}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}


