import React, { createContext, useContext } from 'react'
import type { WidgetDefinition } from './types'

class WidgetRegistry {
  private widgets = new Map<string, WidgetDefinition<any>>()

  register<TConfig>(def: WidgetDefinition<TConfig>): void {
    if (this.widgets.has(def.id)) throw new Error(`Widget '${def.id}' already registered`)
    this.widgets.set(def.id, def as WidgetDefinition<any>)
  }

  get<TConfig = unknown>(id: string): WidgetDefinition<TConfig> | undefined {
    return this.widgets.get(id) as WidgetDefinition<TConfig> | undefined
  }

  list(): WidgetDefinition<any>[] {
    return Array.from(this.widgets.values())
  }
}

export const widgetRegistry = new WidgetRegistry()

const RegistryContext = createContext<WidgetRegistry>(widgetRegistry)

export function useWidgetRegistry(): WidgetRegistry {
  return useContext(RegistryContext)
}

export function RegistryProvider({ children }: { children: React.ReactNode }) {
  return <RegistryContext.Provider value={widgetRegistry}>{children}</RegistryContext.Provider>
}

// Register first-party widgets here (lazy)
export function registerBuiltInWidgets() {
  try {
    widgetRegistry.register({
      id: 'quick-stats',
      title: 'Quick Stats',
      category: 'analytics',
      version: '1.0.0',
      defaultConfig: {},
      component: React.lazy(() => import('./widgets/QuickStatsWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'module-grid',
      title: 'Module Grid',
      category: 'shortcuts',
      version: '1.0.0',
      defaultConfig: {},
      component: React.lazy(() => import('./widgets/ModuleGridWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'recent-activity',
      title: 'Recent Activity',
      category: 'analytics',
      version: '1.0.0',
      defaultConfig: {},
      component: React.lazy(() => import('./widgets/RecentActivityWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'shortcuts',
      title: 'Shortcuts',
      category: 'actions',
      version: '1.0.0',
      defaultConfig: { items: [] as Array<{ label: string; href: string }> },
      component: React.lazy(() => import('./widgets/ShortcutsWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'tasks',
      title: 'Tasks',
      category: 'actions',
      version: '1.0.0',
      defaultConfig: { max: 6 },
      component: React.lazy(() => import('./widgets/TasksWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'focus',
      title: 'Focus',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: {},
      component: React.lazy(() => import('./widgets/FocusWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'notes',
      title: 'Notes',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { max: 5 },
      component: React.lazy(() => import('./widgets/NotesWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'documents',
      title: 'Documents',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { max: 6 },
      component: React.lazy(() => import('./widgets/DocumentsWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'inventory',
      title: 'Inventory',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { max: 6 },
      component: React.lazy(() => import('./widgets/InventoryWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'vault',
      title: 'Vault',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: {},
      component: React.lazy(() => import('./widgets/VaultWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'feeds',
      title: 'Feeds',
      category: 'analytics',
      version: '1.0.0',
      defaultConfig: { max: 6 },
      component: React.lazy(() => import('./widgets/FeedsWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'jellyfin',
      title: 'Jellyfin',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: {},
      component: React.lazy(() => import('./widgets/JellyfinWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'jellyseerr',
      title: 'Jellyseerr',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: {},
      component: React.lazy(() => import('./widgets/JellyseerrWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'karakeep',
      title: 'Karakeep',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: {},
      component: React.lazy(() => import('./widgets/KarakeepWidget')),
    })
  } catch {}
  // homelab-static widgets removed: servers, monitoring, network, storage
}


