import React from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { useDashboardRuntime } from '../runtime'
import { useWidgetRegistry } from '../registry'
import type { GridColSpan, GridLayout, GridRowSpan, MosaicTree, WidgetInstanceId, WidgetProps } from '../types'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useDrag, useDrop, useDragLayer } from 'react-dnd'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

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

  // Global drag state to drive visual highlights across all tiles
  const isDragActive = useDragLayer((monitor) => monitor.isDragging())

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
            dragActive={isDragActive}
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
  dragActive,
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
  dragActive: boolean
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

  const [{ isOver }, drop] = useDrop({
    accept: DND_WIDGET_ITEM,
    // Only trigger reorder once the cursor crosses the midpoint of the hovered tile
    hover(item: { id: WidgetInstanceId; index: number }, monitor) {
      if (!ref.current) return
      const dragIndex = item.index
      const hoverIndex = index
      if (dragIndex === hoverIndex) return
      const hoverBoundingRect = ref.current.getBoundingClientRect()
      const clientOffset = monitor.getClientOffset()
      if (!clientOffset) return
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2
      const hoverClientY = clientOffset.y - hoverBoundingRect.top
      // Only perform the move when the mouse has crossed half of the item's height
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return
      moveItem(dragIndex, hoverIndex)
      item.index = hoverIndex
    },
    collect: (monitor) => ({ isOver: monitor.isOver({ shallow: true }) }),
  })

  const [{ isDragging }, drag] = useDrag({
    type: DND_WIDGET_ITEM,
    item: { id, index },
    canDrag: () => true,
    collect: (monitor) => ({ isDragging: !!monitor.isDragging() }),
  })

  drag(drop(ref))

  return (
    <div
      ref={ref}
      className={(isDragging ? 'opacity-60 ' : '') + 'min-w-0 ' + (gridClassName || '') + ' cursor-grab select-none'}
    >
      <div className="relative">
        {/* Drag highlight overlay */}
        {dragActive && (
          <div
            className={
              'pointer-events-none absolute inset-0 rounded-xl ' +
              (isOver ? 'ring-2 ring-primary/70 bg-primary/10' : 'ring-1 ring-primary/30 bg-primary/5')
            }
          />
        )}
        <div className="absolute inset-x-0 -top-2 z-10 px-1">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs rounded bg-card/80 px-2 py-0.5 border">Drag to reorder</div>
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="glass" className="h-7 px-2 text-xs">Size</Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Width</div>
                    <ToggleGroup type="single" value={String(currentSpan)} onValueChange={(v) => v && onSpanChange(Number(v) as GridColSpan)}>
                      {[1,2,3,4].map((n) => (
                        <ToggleGroupItem key={n} value={String(n)} size="sm" aria-label={`Span ${n} columns`}>
                          {n}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    <div className="pt-1 text-xs font-medium text-muted-foreground">Height</div>
                    <ToggleGroup type="single" value={String(currentRowSpan)} onValueChange={(v) => v && onRowSpanChange(Number(v) as GridRowSpan)}>
                      {[1,2,3].map((n) => (
                        <ToggleGroupItem key={n} value={String(n)} size="sm" aria-label={`Row span ${n}`}>
                          R{n}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                </PopoverContent>
              </Popover>
              <Button aria-label="Remove widget" variant="destructive" size="sm" className="h-7 px-2 text-xs" onClick={onRemove}>
                Remove
              </Button>
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}


