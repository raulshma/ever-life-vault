import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'
import { useWidgetRegistry, registerBuiltInWidgets } from './registry'
import type { DashboardLayoutRecord, WidgetDefinition, WidgetInstanceId, WidgetProps, WidgetState } from './types'
import type { LayoutTree, GridLayout, MosaicTree, GridColSpan, GridRowSpan } from './types'
// Note: Drag-and-drop is loaded only in EditingStackView to keep the default view light

type WidgetStateMap = Record<WidgetInstanceId, WidgetState<any>>

// kept in editing-only module

interface RuntimeContextValue {
  // Grid-first layout state
  layout: LayoutTree | null
  widgets: WidgetStateMap
  spans: Record<WidgetInstanceId, GridColSpan>
  rowSpans: Record<WidgetInstanceId, GridRowSpan>
  setLayout: (t: LayoutTree | null) => void
  setWidgets: React.Dispatch<React.SetStateAction<WidgetStateMap>>
  addWidget: (def: WidgetDefinition<any>, initialSpan?: GridColSpan, initialRowSpan?: GridRowSpan) => void
  removeWidget: (id: WidgetInstanceId) => void
  updateWidgetConfig: <T>(id: WidgetInstanceId, next: T) => void
  reorderWidgets: (order: WidgetInstanceId[]) => void
  setSpan: (id: WidgetInstanceId, span: GridColSpan) => void
  setRowSpan: (id: WidgetInstanceId, span: GridRowSpan) => void
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
  const [rowSpans, setRowSpans] = useState<Record<WidgetInstanceId, GridRowSpan>>({})
  const initialLoadedRef = useRef(false)

  useEffect(() => {
    registerBuiltInWidgets()
  }, [])

  const saveDebounced = useDebounced(async (nextLayout: LayoutTree | null, nextWidgets: WidgetStateMap, nextSpans?: Record<WidgetInstanceId, GridColSpan>, nextRowSpans?: Record<WidgetInstanceId, GridRowSpan>) => {
    if (!user) return
    await upsertRecord(user.id, nextLayout, nextWidgets)
    // Persist spans client-side for now
    try {
      localStorage.setItem('dashboard:spans', JSON.stringify(nextSpans ?? spans))
      localStorage.setItem('dashboard:rowspans', JSON.stringify(nextRowSpans ?? rowSpans))
    } catch {}
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
        const savedRow = localStorage.getItem('dashboard:rowspans')
        if (savedRow) setRowSpans(JSON.parse(savedRow))
      } catch {}
      initialLoadedRef.current = true
    })().catch(() => {})
  }, [user])

  const addWidget = useCallback((def: WidgetDefinition<any>, initialSpan: GridColSpan = 1, initialRowSpan: GridRowSpan = 1) => {
    const id = generateId()
    const nextWidgets = { ...widgets, [id]: { type: def.id, version: def.version, config: def.defaultConfig } }
    setWidgets(nextWidgets)
    const nextSpans = { ...spans, [id]: initialSpan }
    const nextRowSpans = { ...rowSpans, [id]: initialRowSpan }
    setSpans(nextSpans)
    setRowSpans(nextRowSpans)
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
    saveDebounced(nextLayout, nextWidgets, nextSpans, nextRowSpans)
  }, [saveDebounced, layout, widgets, spans, rowSpans])

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
      const nextRowSpans = { ...rowSpans }
      delete nextRowSpans[id]
      setRowSpans(nextRowSpans)
      saveDebounced(nextLayout, next, nextSpans, nextRowSpans)
      return next
    })
  }, [saveDebounced, layout, spans, rowSpans])

  const updateWidgetConfig = useCallback(<T,>(id: WidgetInstanceId, nextConfig: T) => {
    setWidgets((prev) => {
      const entry = prev[id]
      if (!entry) return prev
      const next = { ...prev, [id]: { ...entry, config: nextConfig } }
      saveDebounced(layout, next, spans, rowSpans)
      return next
    })
  }, [saveDebounced, layout, spans, rowSpans])

  const reorderWidgets = useCallback((order: WidgetInstanceId[]) => {
    const nextLayout: GridLayout = { kind: 'grid', order }
    setLayout(nextLayout)
    saveDebounced(nextLayout, widgets, spans, rowSpans)
  }, [saveDebounced, widgets, spans, rowSpans])

  const setSpan = useCallback((id: WidgetInstanceId, span: GridColSpan) => {
    setSpans((prev) => {
      const next = { ...prev, [id]: span }
      saveDebounced(layout, widgets, next, rowSpans)
      return next
    })
  }, [layout, widgets, rowSpans, saveDebounced])

  const setRowSpan = useCallback((id: WidgetInstanceId, span: GridRowSpan) => {
    setRowSpans((prev) => {
      const next = { ...prev, [id]: span }
      saveDebounced(layout, widgets, spans, next)
      return next
    })
  }, [layout, widgets, spans, saveDebounced])

  const value = useMemo(() => ({
    layout,
    widgets,
    spans,
    rowSpans,
    setLayout: (t: LayoutTree | null) => { setLayout(t); saveDebounced(t, widgets) },
    setWidgets,
    addWidget,
    removeWidget,
    updateWidgetConfig,
    reorderWidgets,
    setSpan,
    setRowSpan,
    resetLayout: () => {},
    exportLayout: () => '',
    importLayout: () => {},
  }) as RuntimeContextValue, [layout, widgets, spans, rowSpans, saveDebounced, addWidget, removeWidget, updateWidgetConfig, reorderWidgets, setWidgets])
  
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
export function DashboardStackView() {
  const { layout, widgets, spans, rowSpans, updateWidgetConfig } = useDashboardRuntime()
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
  const rowSpanToClass = (s: GridRowSpan): string => {
    switch (s) {
      case 3: return 'row-span-3'
      case 2: return 'row-span-2'
      default: return 'row-span-1'
    }
  }

  return (
    <div className="grid w-full min-w-0 overflow-visible auto-rows-[minmax(6rem,auto)] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
      {orderedIds.map((id) => {
        const state = widgets[id]
        if (!state) return null
        const def = registry.get(state.type)
        if (!def) return null
        const Component = def.component as React.ComponentType<WidgetProps<any>>
        const currentSpan = (spans[id] || 1) as GridColSpan
        const currentRowSpan = (rowSpans[id] || 1) as GridRowSpan
        return (
          <div key={id} className={`min-w-0 ${spanToClass(currentSpan)} ${rowSpanToClass(currentRowSpan)}`}>
            <React.Suspense fallback={<div className="glass rounded-xl p-4">Loading...</div>}>
              <Component id={id} config={state.config} onConfigChange={(next) => updateWidgetConfig(id, next)} />
            </React.Suspense>
          </div>
        )
      })}
    </div>
  )
}

