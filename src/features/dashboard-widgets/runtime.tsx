import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'
import { useWidgetRegistry, registerBuiltInWidgets } from './registry'
import type { DashboardLayoutRecord, WidgetDefinition, WidgetInstanceId, WidgetProps, WidgetState } from './types'
import type { LayoutTree, GridLayout, MosaicTree, GridColSpan } from './types'
import { useDrag, useDrop } from 'react-dnd'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type WidgetStateMap = Record<WidgetInstanceId, WidgetState<any>>

const DND_WIDGET_ITEM = 'dashboard-widget-item'

interface RuntimeContextValue {
  // Grid-first layout state
  layout: LayoutTree | null
  widgets: WidgetStateMap
  spans: Record<WidgetInstanceId, GridColSpan>
  setLayout: (t: LayoutTree | null) => void
  setWidgets: React.Dispatch<React.SetStateAction<WidgetStateMap>>
  addWidget: (def: WidgetDefinition<any>, initialSpan?: GridColSpan) => void
  removeWidget: (id: WidgetInstanceId) => void
  updateWidgetConfig: <T>(id: WidgetInstanceId, next: T) => void
  reorderWidgets: (order: WidgetInstanceId[]) => void
  setSpan: (id: WidgetInstanceId, span: GridColSpan) => void
  resetLayout: () => void
  exportLayout: () => string
  importLayout: (json: string) => void
}

const RuntimeContext = createContext<RuntimeContextValue | undefined>(undefined)

function useDebounced<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  const timeoutRef = useRef<number | null>(null)
  const fnRef = useRef(fn)
  useEffect(() => { fnRef.current = fn }, [fn])
  const wrapped = useCallback((...args: any[]) => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => fnRef.current(...args), delay)
  }, [delay]) as T
  useEffect(() => () => { if (timeoutRef.current) window.clearTimeout(timeoutRef.current) }, [])
  return wrapped
}

function generateId(): WidgetInstanceId {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2)
}

async function loadRecord(userId: string): Promise<DashboardLayoutRecord | null> {
  const { data, error } = await supabase
    .from('dashboard_layouts')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return null
  return (data as unknown as DashboardLayoutRecord) || null
}

async function upsertRecord(userId: string, layout: LayoutTree | null, widgetState: WidgetStateMap): Promise<DashboardLayoutRecord | null> {
  const payload = {
    user_id: userId,
    layout_tree: layout as unknown as Json,
    widget_state: widgetState as unknown as Json,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase
    .from('dashboard_layouts')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .maybeSingle()
  if (error) return null
  return (data as unknown as DashboardLayoutRecord) || null
}

export function DashboardRuntimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const registry = useWidgetRegistry()
  const [layout, setLayout] = useState<LayoutTree | null>(null)
  const [widgets, setWidgets] = useState<WidgetStateMap>({})
  const [spans, setSpans] = useState<Record<WidgetInstanceId, GridColSpan>>({})
  const initialLoadedRef = useRef(false)

  useEffect(() => {
    registerBuiltInWidgets()
  }, [])

  const saveDebounced = useDebounced(async (nextLayout: LayoutTree | null, nextWidgets: WidgetStateMap, nextSpans?: Record<WidgetInstanceId, GridColSpan>) => {
    if (!user) return
    await upsertRecord(user.id, nextLayout, nextWidgets)
    // Persist spans client-side for now
    try { localStorage.setItem('dashboard:spans', JSON.stringify(nextSpans ?? spans)) } catch {}
  }, 800)

  useEffect(() => {
    if (!user || initialLoadedRef.current) return
    ;(async () => {
      const rec = await loadRecord(user.id)
      const raw = rec?.layout_tree as any
      if (raw) {
        // If legacy mosaic tree, convert to grid order on load
        if (typeof raw === 'string' || (raw && (raw.first || raw.second))) {
          const ids = collectLeafIds(raw as MosaicTree)
          setLayout({ kind: 'grid', order: ids })
        } else if (raw && raw.kind === 'grid') {
          setLayout(raw as GridLayout)
        } else {
          setLayout(null)
        }
      }
      if (rec?.widget_state) setWidgets(rec.widget_state as any)
      try {
        const saved = localStorage.getItem('dashboard:spans')
        if (saved) setSpans(JSON.parse(saved))
      } catch {}
      initialLoadedRef.current = true
    })().catch(() => {})
  }, [user])

  const addWidget = useCallback((def: WidgetDefinition<any>, initialSpan: GridColSpan = 1) => {
    const id = generateId()
    const nextWidgets = { ...widgets, [id]: { type: def.id, version: def.version, config: def.defaultConfig } }
    setWidgets(nextWidgets)
    const nextSpans = { ...spans, [id]: initialSpan }
    setSpans(nextSpans)
    // Grid-first behavior: append to order, converting legacy mosaic to grid if needed
    let nextLayout: LayoutTree | null = layout
    if (!layout) {
      nextLayout = { kind: 'grid', order: [id] }
    } else if ((layout as any).kind === 'grid') {
      nextLayout = { kind: 'grid', order: [ ...(layout as GridLayout).order, id ] }
    } else {
      const ids = collectLeafIds(layout as MosaicTree)
      nextLayout = { kind: 'grid', order: [ ...ids, id ] }
    }
    setLayout(nextLayout)
    saveDebounced(nextLayout, nextWidgets, nextSpans)
  }, [saveDebounced, layout, widgets, spans])

  const removeWidget = useCallback((id: WidgetInstanceId) => {
    setWidgets((prev) => {
      const next = { ...prev }
      delete next[id]
      let nextLayout: LayoutTree | null = layout
      if (!layout) {
        nextLayout = { kind: 'grid', order: [] }
      } else if ((layout as any).kind === 'grid') {
        nextLayout = { kind: 'grid', order: (layout as GridLayout).order.filter((x) => x !== id) }
      } else {
        const ids = collectLeafIds(layout as MosaicTree)
        nextLayout = { kind: 'grid', order: ids.filter((x) => x !== id) }
      }
      setLayout(nextLayout)
      const nextSpans = { ...spans }
      delete nextSpans[id]
      setSpans(nextSpans)
      saveDebounced(nextLayout, next, nextSpans)
      return next
    })
  }, [saveDebounced, layout, spans])

  const updateWidgetConfig = useCallback(<T,>(id: WidgetInstanceId, nextConfig: T) => {
    setWidgets((prev) => {
      const entry = prev[id]
      if (!entry) return prev
      const next = { ...prev, [id]: { ...entry, config: nextConfig } }
      saveDebounced(layout, next, spans)
      return next
    })
  }, [saveDebounced, layout, spans])

  const reorderWidgets = useCallback((order: WidgetInstanceId[]) => {
    const nextLayout: GridLayout = { kind: 'grid', order }
    setLayout(nextLayout)
    saveDebounced(nextLayout, widgets, spans)
  }, [saveDebounced, widgets, spans])

  const setSpan = useCallback((id: WidgetInstanceId, span: GridColSpan) => {
    setSpans((prev) => {
      const next = { ...prev, [id]: span }
      saveDebounced(layout, widgets, next)
      return next
    })
  }, [layout, widgets, saveDebounced])

  const value = useMemo(() => ({
    layout,
    widgets,
    spans,
    setLayout: (t: LayoutTree | null) => { setLayout(t); saveDebounced(t, widgets) },
    setWidgets,
    addWidget,
    removeWidget,
    updateWidgetConfig,
    reorderWidgets,
    setSpan,
    resetLayout: () => {},
    exportLayout: () => '',
    importLayout: () => {},
  }) as RuntimeContextValue, [layout, widgets, saveDebounced, addWidget, removeWidget, updateWidgetConfig, reorderWidgets, setWidgets])
  
  const resetLayout = useCallback(() => {
    setLayout(null)
    setWidgets({})
    saveDebounced(null, {})
  }, [saveDebounced])

  const exportLayout = useCallback(() => {
    try {
      return JSON.stringify({ layout, widgets })
    } catch {
      return '{}'
    }
  }, [layout, widgets])

  const importLayout = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json) as { layout: LayoutTree | null; widgets: WidgetStateMap }
      setLayout(parsed.layout || null)
      setWidgets(parsed.widgets || {})
      saveDebounced(parsed.layout || null, parsed.widgets || {})
    } catch {
      // ignore invalid
    }
  }, [saveDebounced])

  return (
    <RuntimeContext.Provider value={{ ...value, resetLayout, exportLayout, importLayout }}>
      {children}
    </RuntimeContext.Provider>
  )
}

export function useDashboardRuntime(): RuntimeContextValue {
  const ctx = useContext(RuntimeContext)
  if (!ctx) throw new Error('useDashboardRuntime must be used within DashboardRuntimeProvider')
  return ctx
}

// Derive an ordered list of leaf widget ids from the mosaic tree (left-to-right)
function collectLeafIds(node: MosaicTree | null): WidgetInstanceId[] {
  if (!node) return []
  if (typeof node === 'string') return [node]
  const branch = node as unknown as { first: MosaicTree; second: MosaicTree }
  return [...collectLeafIds(branch.first), ...collectLeafIds(branch.second)]
}

// Mobile-friendly stacked view (cards)
export function DashboardStackView({ isEditing = false }: { isEditing?: boolean }) {
  const { layout, widgets, spans, setSpan, updateWidgetConfig, reorderWidgets, removeWidget } = useDashboardRuntime()
  const registry = useWidgetRegistry()

  const orderedIds = useMemo(() => {
    // Prefer grid order when available
    if (layout && (layout as any).kind === 'grid') {
      const ord = (layout as GridLayout).order
      const known = ord.filter((id) => widgets[id])
      const remaining = Object.keys(widgets).filter((id) => !known.includes(id))
      return [...known, ...remaining]
    }
    // Fallback to legacy mosaic order
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

  return (
    <div className="grid w-full min-w-0 overflow-visible grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
      {orderedIds.map((id, index) => {
        const state = widgets[id]
        if (!state) return null
        const def = registry.get(state.type)
        if (!def) return null
        const Component = def.component as React.ComponentType<WidgetProps<any>>
        const currentSpan = spans[id] || 1
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
            isEditing={isEditing}
            onRemove={() => removeWidget(id)}
            gridClassName={spanToClass(currentSpan as GridColSpan)}
            currentSpan={currentSpan as GridColSpan}
            onSpanChange={(s) => setSpan(id, s)}
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

function SortableWidgetTile({
  id,
  index,
  moveItem,
  isEditing,
  onRemove,
  gridClassName,
  currentSpan,
  onSpanChange,
  children,
}: {
  id: WidgetInstanceId
  index: number
  moveItem: (fromIndex: number, toIndex: number) => void
  isEditing: boolean
  onRemove: () => void
  gridClassName?: string
  currentSpan: GridColSpan
  onSpanChange: (span: GridColSpan) => void
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
    canDrag: () => isEditing,
    collect: (monitor) => ({ isDragging: !!monitor.isDragging() }),
  })

  drag(drop(ref))

  return (
    <div ref={ref} className={(isDragging ? 'opacity-60 ' : '') + 'min-w-0 ' + (gridClassName || '')}>
      <div className="relative">
        {isEditing && (
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
        )}
        {children}
      </div>
    </div>
  )
}


