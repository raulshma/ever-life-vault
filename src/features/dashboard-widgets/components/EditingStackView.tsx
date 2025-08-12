import React from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { TouchBackend } from 'react-dnd-touch-backend'
import { useDashboardRuntime } from '../runtime'
import { useWidgetRegistry } from '../registry'
import type { GridColSpan, GridLayout, GridRowSpan, MosaicTree, WidgetInstanceId, WidgetProps } from '../types'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useDrag, useDrop, useDragLayer } from 'react-dnd'
import { Button } from '@/components/ui/button'
import { GripVertical } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const DND_WIDGET_ITEM = 'dashboard-widget-item'

export default function EditingStackView() {
  const isTouch = React.useMemo(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
    const maxTouchPoints = (navigator as any).maxTouchPoints ?? 0
    const hasTouchEvent = 'ontouchstart' in window
    const hasCoarsePointer = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
    // Be liberal in detecting touch so we reliably use the TouchBackend on mobile
    return maxTouchPoints > 0 || hasTouchEvent || hasCoarsePointer
  }, [])
  const backend = isTouch ? (TouchBackend as any) : (HTML5Backend as any)
  const options = isTouch
    ? ({
        enableMouseEvents: true,
        ignoreContextMenu: true,
        delayTouchStart: 200,
        delayMouseStart: 0,
        touchSlop: 8,
        scrollAngleRanges: [{ start: 30, end: 150 }],
      } as any)
    : undefined
  return (
    <DndProvider backend={backend} options={options}>
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
            <React.Suspense fallback={<div className="glass rounded-xl p-4"><div className=\"space-y-2\"><div className=\"h-5 w-1/3 bg-muted rounded\" /><div className=\"h-4 w-2/3 bg-muted rounded\" /></div></div>}>
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
  const [hoverSide, setHoverSide] = React.useState<'top' | 'bottom' | 'left' | 'right' | null>(null)

  const [{ isOver }, drop] = useDrop({
    accept: DND_WIDGET_ITEM,
    // Trigger reorder when crossing midpoint horizontally OR vertically to support grid layouts
    hover(item: { id: WidgetInstanceId; index: number }, monitor) {
      if (!ref.current) return
      const dragIndex = item.index
      const hoverIndex = index
      if (dragIndex === hoverIndex) return
      const hoverBoundingRect = ref.current.getBoundingClientRect()
      const clientOffset = monitor.getClientOffset()
      if (!clientOffset) return
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2
      const hoverMiddleX = (hoverBoundingRect.right - hoverBoundingRect.left) / 2
      const hoverClientY = clientOffset.y - hoverBoundingRect.top
      const hoverClientX = clientOffset.x - hoverBoundingRect.left
      // Determine visual insert hint side
      const nextSide = Math.abs(hoverClientX - hoverMiddleX) > Math.abs(hoverClientY - hoverMiddleY)
        ? (hoverClientX < hoverMiddleX ? 'left' : 'right')
        : (hoverClientY < hoverMiddleY ? 'top' : 'bottom')
      if (nextSide !== hoverSide) setHoverSide(nextSide)
      const crossedYForward = hoverClientY >= hoverMiddleY
      const crossedYBackward = hoverClientY <= hoverMiddleY
      const crossedXForward = hoverClientX >= hoverMiddleX
      const crossedXBackward = hoverClientX <= hoverMiddleX
      // Allow move when crossing either axis midpoint, supporting horizontal moves across columns
      if (dragIndex < hoverIndex && !(crossedYForward || crossedXForward)) return
      if (dragIndex > hoverIndex && !(crossedYBackward || crossedXBackward)) return
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

  // Connect drop to the tile container; connect drag to the visible handle only
  drop(ref)

  // Clear hover side when no longer over
  React.useEffect(() => {
    if (!isOver && hoverSide) setHoverSide(null)
  }, [isOver, hoverSide])

  return (
    <div
      ref={ref}
      className={
        (isDragging
          ? 'opacity-70 z-20 scale-[0.98] shadow-lg shadow-primary/20 cursor-grabbing '
          : 'cursor-grab ') +
        'min-w-0 ' +
        (gridClassName || '') +
        ' select-none transition-all duration-150 ease-out'
      }
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
        {/* Insert position indicator */}
        {dragActive && isOver && hoverSide && (
          <div className="pointer-events-none absolute inset-0">
            {hoverSide === 'top' && (
              <div className="absolute left-1 right-1 top-0 h-1 rounded-full bg-primary/70 animate-pulse" />
            )}
            {hoverSide === 'bottom' && (
              <div className="absolute left-1 right-1 bottom-0 h-1 rounded-full bg-primary/70 animate-pulse" />
            )}
            {hoverSide === 'left' && (
              <div className="absolute top-1 bottom-1 left-0 w-1 rounded-full bg-primary/70 animate-pulse" />
            )}
            {hoverSide === 'right' && (
              <div className="absolute top-1 bottom-1 right-0 w-1 rounded-full bg-primary/70 animate-pulse" />
            )}
          </div>
        )}
        <div className="absolute inset-x-0 -top-2 z-10 px-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <div
                aria-label="Drag handle"
                role="button"
                className="h-6 w-6 flex items-center justify-center rounded-md border bg-card/90 hover:bg-card/100 active:bg-card text-muted-foreground/90 select-none"
                style={{ touchAction: 'none' }}
                ref={drag as unknown as React.Ref<HTMLDivElement>}
              >
                <GripVertical className="h-3.5 w-3.5" />
              </div>
              <div className="text-xs rounded bg-card/80 px-2 py-0.5 border">
                {isDragging ? 'Reordering…' : 'Drag to reorder'}
              </div>
            </div>
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


