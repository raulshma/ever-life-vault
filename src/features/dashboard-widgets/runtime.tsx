import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { MosaicNode } from 'react-mosaic-component'
import { Mosaic, MosaicWindow } from 'react-mosaic-component'
import { X } from 'lucide-react'
import 'react-mosaic-component/react-mosaic-component.css'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'
import { useToast } from '@/hooks/use-toast'
import { useWidgetRegistry, registerBuiltInWidgets } from './registry'
import type { DashboardLayoutRecord, WidgetDefinition, WidgetInstanceId, WidgetProps, WidgetState } from './types'

type WidgetStateMap = Record<WidgetInstanceId, WidgetState<any>>

interface RuntimeContextValue {
  tree: MosaicNode<WidgetInstanceId> | null
  widgets: WidgetStateMap
  setTree: (t: MosaicNode<WidgetInstanceId> | null) => void
  setWidgets: React.Dispatch<React.SetStateAction<WidgetStateMap>>
  addWidget: (def: WidgetDefinition<any>) => void
  removeWidget: (id: WidgetInstanceId) => void
  updateWidgetConfig: <T>(id: WidgetInstanceId, next: T) => void
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

async function upsertRecord(userId: string, tree: MosaicNode<WidgetInstanceId> | null, widgetState: WidgetStateMap): Promise<DashboardLayoutRecord | null> {
  const payload = {
    user_id: userId,
    layout_tree: tree as unknown as Json,
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
  const { toast } = useToast()
  const registry = useWidgetRegistry()
  const [tree, setTree] = useState<MosaicNode<WidgetInstanceId> | null>(null)
  const [widgets, setWidgets] = useState<WidgetStateMap>({})
  const initialLoadedRef = useRef(false)

  useEffect(() => {
    registerBuiltInWidgets()
  }, [])

  const saveDebounced = useDebounced(async (nextTree: MosaicNode<WidgetInstanceId> | null, nextWidgets: WidgetStateMap) => {
    if (!user) return
    await upsertRecord(user.id, nextTree, nextWidgets)
  }, 800)

  useEffect(() => {
    if (!user || initialLoadedRef.current) return
    (async () => {
      const rec = await loadRecord(user.id)
      if (rec?.layout_tree) setTree(rec.layout_tree as any)
      if (rec?.widget_state) setWidgets(rec.widget_state as any)
      initialLoadedRef.current = true
    })().catch(() => {})
  }, [user])

  const addWidget = useCallback((def: WidgetDefinition<any>) => {
    const id = generateId()
    setWidgets((prev) => ({ ...prev, [id]: { type: def.id, version: def.version, config: def.defaultConfig } }))
    setTree((prev) => {
      // If no tree, start with single leaf
      if (!prev) return id
      // Otherwise, split the current root horizontally and place new widget on the right
      return { direction: 'row', first: prev, second: id, splitPercentage: 60 }
    })
    const nextTree = (!tree ? id : { direction: 'row', first: tree, second: id, splitPercentage: 60 }) as MosaicNode<WidgetInstanceId>
    const nextWidgets = { ...widgets, [id]: { type: def.id, version: def.version, config: def.defaultConfig } }
    saveDebounced(nextTree, nextWidgets)
  }, [saveDebounced, tree, widgets])

  const removeWidget = useCallback((id: WidgetInstanceId) => {
    function removeFromTree(node: MosaicNode<WidgetInstanceId> | null): MosaicNode<WidgetInstanceId> | null {
      if (!node) return null
      if (typeof node === 'string') return node === id ? null : node
      const branch = node as unknown as { direction: 'row' | 'column'; first: MosaicNode<WidgetInstanceId>; second: MosaicNode<WidgetInstanceId>; splitPercentage?: number }
      const first = removeFromTree(branch.first)
      const second = removeFromTree(branch.second)
      if (first && second) return { ...branch, first, second }
      if (first) return first
      if (second) return second
      return null
    }

    setWidgets((prev) => {
      const next = { ...prev }
      delete next[id]
      const nextTree = removeFromTree(tree)
      setTree(nextTree)
      saveDebounced(nextTree, next)
      return next
    })
  }, [saveDebounced, tree])

  const updateWidgetConfig = useCallback(<T,>(id: WidgetInstanceId, nextConfig: T) => {
    setWidgets((prev) => {
      const entry = prev[id]
      if (!entry) return prev
      const next = { ...prev, [id]: { ...entry, config: nextConfig } }
      saveDebounced(tree, next)
      return next
    })
  }, [saveDebounced, tree])

  const value = useMemo(() => ({
    tree,
    widgets,
    setTree: (t: MosaicNode<WidgetInstanceId> | null) => { setTree(t); saveDebounced(t, widgets) },
    setWidgets,
    addWidget,
    removeWidget,
    updateWidgetConfig,
    resetLayout: () => {},
    exportLayout: () => '',
    importLayout: () => {}
  }) as RuntimeContextValue, [tree, widgets, saveDebounced, addWidget, removeWidget, updateWidgetConfig, setWidgets])
  
  const resetLayout = useCallback(() => {
    setTree(null)
    setWidgets({})
    saveDebounced(null, {})
  }, [saveDebounced])

  const exportLayout = useCallback(() => {
    try {
      return JSON.stringify({ tree, widgets })
    } catch {
      return '{}'
    }
  }, [tree, widgets])

  const importLayout = useCallback((json: string) => {
    try {
      const parsed = JSON.parse(json) as { tree: MosaicNode<WidgetInstanceId> | null; widgets: WidgetStateMap }
      setTree(parsed.tree || null)
      setWidgets(parsed.widgets || {})
      saveDebounced(parsed.tree || null, parsed.widgets || {})
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

export function DashboardMosaicView() {
  const { tree, setTree, widgets, updateWidgetConfig, removeWidget } = useDashboardRuntime()
  const registry = useWidgetRegistry()

  const renderTile = useCallback((id: WidgetInstanceId, path: any) => {
    const state = widgets[id]
    if (!state) return <div className="p-4">Unknown widget</div>
    const def = registry.get(state.type)
    if (!def) return <div className="p-4">Unregistered widget: {state.type}</div>
    const Component = def.component as React.ComponentType<WidgetProps<any>>
    return (
      <MosaicWindow<WidgetInstanceId>
        path={path}
        title={def?.title || state.type}
        renderToolbar={() => (
          <div className="mosaic-window-toolbar mosaic-blueprint-theme">
            <div className="mosaic-window-title" title={def?.title || state.type}>
              {def?.title || state.type}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <button
                aria-label="Remove widget"
                className="action-ghost"
                onClick={() => removeWidget(id)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      >
        <React.Suspense fallback={<div className="p-4">Loading...</div>}>
          <Component id={id} config={state.config} onConfigChange={(next) => updateWidgetConfig(id, next)} />
        </React.Suspense>
      </MosaicWindow>
    )
  }, [registry, updateWidgetConfig, widgets, removeWidget])

  return (
    <div className="mosaic-container h-full">
      <Mosaic<WidgetInstanceId>
        renderTile={renderTile}
        value={tree}
        onChange={setTree}
        className="mosaic-blueprint-theme h-full"
      />
    </div>
  )
}

// Derive an ordered list of leaf widget ids from the mosaic tree (left-to-right)
function collectLeafIds(node: MosaicNode<WidgetInstanceId> | null): WidgetInstanceId[] {
  if (!node) return []
  if (typeof node === 'string') return [node]
  const branch = node as unknown as { first: MosaicNode<WidgetInstanceId>; second: MosaicNode<WidgetInstanceId> }
  return [...collectLeafIds(branch.first), ...collectLeafIds(branch.second)]
}

// Mobile-friendly stacked view (cards)
export function DashboardStackView() {
  const { tree, widgets, updateWidgetConfig } = useDashboardRuntime()
  const registry = useWidgetRegistry()

  const orderedIds = useMemo(() => {
    const fromTree = collectLeafIds(tree)
    const known = fromTree.filter((id) => widgets[id])
    const remaining = Object.keys(widgets).filter((id) => !known.includes(id))
    return [...known, ...remaining]
  }, [tree, widgets])

  if (orderedIds.length === 0) {
    return <div className="empty-bubble p-6 text-center text-muted-foreground">Add widgets to get started</div>
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-4">
      {orderedIds.map((id) => {
        const state = widgets[id]
        if (!state) return null
        const def = registry.get(state.type)
        if (!def) return null
        const Component = def.component as React.ComponentType<WidgetProps<any>>
        return (
          <React.Suspense key={id} fallback={<div className="glass rounded-xl p-4">Loading...</div>}>
            <Component id={id} config={state.config} onConfigChange={(next) => updateWidgetConfig(id, next)} />
          </React.Suspense>
        )
      })}
    </div>
  )
}


