import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'
import { useWidgetRegistry, registerBuiltInWidgets } from './registry'
import type { DashboardLayoutRecord, WidgetDefinition, WidgetInstanceId, WidgetProps, WidgetState } from './types'
import type { LayoutTree, GridLayout, MosaicTree, GridColSpan, GridRowSpan } from './types'
import { getConfigValue, setConfigValue, batchConfigOperations } from '@/integrations/supabase/configStore'
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
  // Never persist SQL NULL into layout_tree (column is NOT NULL). Use an empty grid layout instead.
  const safeLayout: Json = ((layout ?? { kind: 'grid', order: [] }) as unknown) as Json
  const payload = {
    user_id: userId,
    layout_tree: safeLayout,
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

// Migration function to add default cache settings to existing widgets
function migrateWidgetConfigs(widgetState: WidgetStateMap, registry: any): WidgetStateMap {
  const migrated = { ...widgetState }
  let hasChanges = false
  let migratedCount = 0
  
  console.log('[Migration] Starting widget config migration...')
  console.log('[Migration] Registry has', registry.list().length, 'widget definitions')
  console.log('[Migration] Raw widget state:', widgetState)
  
  // First pass: fix corrupted widget types
  for (const [id, state] of Object.entries(migrated)) {
    if (!state.type || state.type === 'undefined') {
      console.log(`[Migration] Widget ${id} has corrupted type: ${state.type}`)
      console.log(`[Migration] Widget ${id} config:`, state.config)
      
      // Try to infer the widget type from the config structure
      let inferredType = null
      
      if (state.config && typeof state.config === 'object') {
        console.log(`[Migration] Widget ${id} config properties:`, Object.keys(state.config))
        
        // Check for location-based widgets
        if (state.config.lat !== undefined && state.config.lon !== undefined) {
          console.log(`[Migration] Widget ${id} has lat/lon:`, { lat: state.config.lat, lon: state.config.lon, scale: state.config.scale })
          if (state.config.scale === 'us') {
            inferredType = 'air-quality'
          } else if (state.config.units === 'kmh') {
            inferredType = 'wind-focus'
          } else if (state.config.mode === 'official') {
            inferredType = 'sun-phases'
          }
        }
        
        // Check for other widget types based on config structure
        if (state.config.max !== undefined && state.config.cacheTimeMs === 300000) {
          // This looks like a Steam widget with 5-minute cache
          if (state.config.appid !== undefined) {
            inferredType = 'steam-game'
          } else {
            inferredType = 'steam-recent'
          }
        }
      }
      
      if (inferredType) {
        console.log(`[Migration] Inferred widget type for ${id}: ${inferredType}`)
        const inferredDef = registry.get(inferredType)
        console.log(`[Migration] Registry lookup for ${inferredType}:`, { 
          found: !!inferredDef, 
          def: inferredDef ? { id: inferredDef.id, title: inferredDef.title } : null 
        })
        if (inferredDef) {
          // Update the widget with the correct type
          migrated[id] = {
            ...state,
            type: inferredType
          }
          hasChanges = true
          console.log(`[Migration] Fixed widget type for ${id}: ${inferredType}`)
          console.log(`[Migration] Updated widget state:`, migrated[id])
        } else {
          console.log(`[Migration] Inferred type ${inferredType} not found in registry`)
          console.log(`[Migration] Available registry types:`, registry.list().map(w => w.id))
        }
      } else {
        console.log(`[Migration] Could not infer widget type for ${id}`)
      }
    }
  }
  
  // Second pass: add cache settings
  for (const [id, state] of Object.entries(migrated)) {
    console.log(`[Migration] Processing widget ${id} (${state.type}):`, state)
    
    const def = registry.get(state.type)
    if (!def) {
      console.log(`[Migration] Widget ${id} has unknown type: ${state.type}`)
      continue
    }
    
    console.log(`[Migration] Processing widget ${id} (${def.title}):`, {
      type: def.type,
      usesExternalApis: def.usesExternalApis,
      defaultCacheTimeMs: def.defaultCacheTimeMs,
      currentCacheTimeMs: state.config?.cacheTimeMs
    })
    
    // Check if widget uses external APIs and has a default cache time
    if (def.usesExternalApis && def.defaultCacheTimeMs && !state.config?.cacheTimeMs) {
      // Add default cache settings to existing widget configs
      migrated[id] = {
        ...state,
        config: {
          ...state.config,
          cacheTimeMs: def.defaultCacheTimeMs
        }
      }
      hasChanges = true
      migratedCount++
      console.log(`[Widget Migration] Added cache settings to ${def.title} (${id}): ${def.defaultCacheTimeMs}ms`)
    } else if (def.usesExternalApis && def.defaultCacheTimeMs) {
      console.log(`[Migration] Widget ${def.title} (${id}) already has cache settings: ${state.config?.cacheTimeMs}ms`)
    } else if (def.usesExternalApis) {
      console.log(`[Migration] Widget ${def.title} (${id}) uses external APIs but has no default cache time`)
    } else {
      console.log(`[Migration] Widget ${def.title} (${id}) does not use external APIs`)
    }
  }
  
  if (migratedCount > 0) {
    console.log(`[Widget Migration] Migrated ${migratedCount} widgets with cache settings`)
  } else {
    console.log(`[Widget Migration] No widgets needed migration`)
  }
  
  return migrated
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
    try {
      await upsertRecord(user.id, nextLayout, nextWidgets)
    } catch {}
    // Persist spans client-side for now
    try {
      localStorage.setItem('dashboard:spans', JSON.stringify(nextSpans ?? spans))
      localStorage.setItem('dashboard:rowspans', JSON.stringify(nextRowSpans ?? rowSpans))
    } catch {}
          // Persist spans to DB for cross-device sync
      try {
        const safeSpans = Object.fromEntries(Object.entries((nextSpans ?? spans) || {}).map(([k, v]) => [k, Math.max(1, Math.min(4, Number(v) || 1))]))
        const safeRowSpans = Object.fromEntries(Object.entries((nextRowSpans ?? rowSpans) || {}).map(([k, v]) => [k, Math.max(1, Math.min(3, Number(v) || 1))]))
        await batchConfigOperations([], [
          { namespace: 'dashboard', key: 'spans', value: safeSpans },
          { namespace: 'dashboard', key: 'rowspans', value: safeRowSpans }
        ])
      } catch {}
  }, 800)

  useEffect(() => {
    if (!user || initialLoadedRef.current) return
    ;(async () => {
      // First ensure widgets are registered
      if (registry.list().length === 0) {
        console.log('[Dashboard] Waiting for widgets to register...')
        // Wait for widgets to register
        let attempts = 0
        while (registry.list().length === 0 && attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 200))
          attempts++
          console.log(`[Dashboard] Registry check attempt ${attempts}: ${registry.list().length} widgets`)
        }
        
        if (registry.list().length === 0) {
          console.error('[Dashboard] Failed to register widgets after multiple attempts')
          return
        }
      }
      
      console.log('[Dashboard] Widgets registered, proceeding with data load...')
      
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
      
      // Load and migrate widget states
      if (rec?.widget_state) {
        const widgetState = rec.widget_state as any
        console.log('[Dashboard] Loading widget states:', Object.keys(widgetState).length, 'widgets')
        console.log('[Dashboard] Registry state before migration:', {
          registrySize: registry.list().length,
          availableWidgets: registry.list().map(w => ({ id: w.id, title: w.title, usesExternalApis: w.usesExternalApis }))
        })
        
        const migratedWidgets = migrateWidgetConfigs(widgetState, registry)
        setWidgets(migratedWidgets)
        
        // Save migrated configs if any changes were made
        if (JSON.stringify(migratedWidgets) !== JSON.stringify(widgetState)) {
          console.log('[Dashboard] Widget configs migrated, saving to database...')
          try {
            await upsertRecord(user.id, raw ? (raw.kind === 'grid' ? raw : { kind: 'grid', order: collectLeafIds(raw as MosaicTree) }) : { kind: 'grid', order: [] }, migratedWidgets)
            console.log('[Dashboard] Widget configs saved successfully')
          } catch (error) {
            console.error('[Dashboard] Failed to save migrated widget configs:', error)
          }
        } else {
          console.log('[Dashboard] No widget config migration needed')
        }
      } else {
        console.log('[Dashboard] No existing widget states found')
      }
      
      try {
        const saved = localStorage.getItem('dashboard:spans')
        if (saved) setSpans(JSON.parse(saved))
        const savedRow = localStorage.getItem('dashboard:rowspans')
        if (savedRow) setRowSpans(JSON.parse(savedRow))
      } catch {}
      // Load DB-synced spans
      try {
        const results = await batchConfigOperations([
          { namespace: 'dashboard', key: 'spans' },
          { namespace: 'dashboard', key: 'rowspans' }
        ])
        
        const dbSpans = results.gets.find(r => r.key === 'spans')?.value
        const dbRowSpans = results.gets.find(r => r.key === 'rowspans')?.value
        
        if (dbSpans && typeof dbSpans === 'object') {
          const safe = Object.fromEntries(Object.entries(dbSpans).map(([k, v]) => [k, Math.max(1, Math.min(4, Number(v) || 1))])) as Record<WidgetInstanceId, GridColSpan>
          setSpans(safe)
        }
        if (dbRowSpans && typeof dbRowSpans === 'object') {
          const safe = Object.fromEntries(Object.entries(dbRowSpans).map(([k, v]) => [k, Math.max(1, Math.min(3, Number(v) || 1))])) as Record<WidgetInstanceId, GridRowSpan>
          setRowSpans(safe)
        }
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
    console.log(`[updateWidgetConfig] Updating widget ${id}:`, { current: widgets[id]?.config, next: nextConfig })
    setWidgets((prev) => {
      const entry = prev[id]
      if (!entry) {
        console.warn(`[updateWidgetConfig] Widget ${id} not found in current state`)
        return prev
      }
      const next = { ...prev, [id]: { ...entry, config: nextConfig } }
      console.log(`[updateWidgetConfig] New widget state for ${id}:`, next[id])
      saveDebounced(layout, next, spans, rowSpans)
      return next
    })
  }, [saveDebounced, layout, spans, rowSpans, widgets])

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
    // Keep in-memory state minimal but make sure DB gets a non-null layout
    const emptyGrid: LayoutTree = { kind: 'grid', order: [] }
    setLayout(null)
    setWidgets({})
    saveDebounced(emptyGrid, {})
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
        try {
          const state = widgets[id]
          if (!state || !state.type) {
            console.warn(`[DashboardStackView] Widget ${id} has no state or type:`, state)
            return null
          }
          
          console.log(`[DashboardStackView] Rendering widget ${id} of type ${state.type}:`, { state, config: state.config })
          
          const def = registry.get(state.type)
          if (!def) {
            console.warn(`[DashboardStackView] Widget ${id} has unknown type: ${state.type}`)
            return null
          }
          
          const Component = def.component as React.ComponentType<WidgetProps<any>>
          const currentSpan = (spans[id] || 1) as GridColSpan
          const currentRowSpan = (rowSpans[id] || 1) as GridRowSpan
          
          // Prepare component props
          const componentProps = {
            id,
            config: state.config || {},
            onConfigChange: (next: any) => updateWidgetConfig(id, next),
            isEditing: false
          }
          
          console.log(`[DashboardStackView] Component props for ${id}:`, componentProps)
          
          return (
            <div key={id} className={`min-w-0 ${spanToClass(currentSpan)} ${rowSpanToClass(currentRowSpan)}`}>
              <React.Suspense fallback={<div className="glass rounded-xl p-4"><div className="space-y-2"><div className="h-5 w-1/3 bg-muted rounded" /><div className="h-4 w-2/3 bg-muted rounded" /></div></div>}>
                <Component {...componentProps} />
              </React.Suspense>
            </div>
          )
        } catch (error) {
          console.error(`[DashboardStackView] Error rendering widget ${id}:`, error)
          return (
            <div key={id} className="col-span-1 p-4 border border-destructive rounded-lg">
              <div className="text-sm text-destructive">Error rendering widget</div>
              <div className="text-xs text-muted-foreground">ID: {id}</div>
            </div>
          )
        }
      })}
    </div>
  )
}

