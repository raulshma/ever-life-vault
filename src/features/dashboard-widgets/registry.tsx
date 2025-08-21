import React, { createContext, useContext } from 'react'
import type { WidgetDefinition } from './types'

// Type-safe registry that preserves widget configuration types
class WidgetRegistry {
  private widgets = new Map<string, WidgetDefinition<any>>()

  register<TConfig>(def: WidgetDefinition<TConfig>): void {
    if (this.widgets.has(def.id)) throw new Error(`Widget '${def.id}' already registered`)
    this.widgets.set(def.id, def)
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

// Helper function to create properly typed widget definitions
function createWidgetDefinition<TConfig>(
  def: Omit<WidgetDefinition<TConfig>, 'component'> & {
    component: React.LazyExoticComponent<React.ComponentType<{ id: string; config: TConfig; onConfigChange: (next: TConfig) => void; isEditing?: boolean }>>
  }
): WidgetDefinition<TConfig> {
  return def as WidgetDefinition<TConfig>
}

// Register first-party widgets here (lazy)
export function registerBuiltInWidgets() {
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'quick-stats',
      title: 'Quick Stats',
      category: 'analytics',
      version: '1.0.0',
      defaultConfig: {},
      component: React.lazy(() => import('./widgets/QuickStatsWidget')),
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'module-grid',
      title: 'Module Grid',
      category: 'shortcuts',
      version: '1.0.0',
      defaultConfig: {},
      component: React.lazy(() => import('./widgets/ModuleGridWidget')),
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'recent-activity',
      title: 'Recent Activity',
      category: 'analytics',
      version: '1.0.0',
      defaultConfig: {},
      component: React.lazy(() => import('./widgets/RecentActivityWidget')),
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'shortcuts',
      title: 'Shortcuts',
      category: 'actions',
      version: '1.0.0',
      defaultConfig: { items: [] as Array<{ label: string; href: string }> },
      component: React.lazy(() => import('./widgets/ShortcutsWidget')),
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'tasks',
      title: 'Tasks',
      category: 'actions',
      version: '1.0.0',
      defaultConfig: { max: 6 },
      component: React.lazy(() => import('./widgets/TasksWidget')),
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'focus',
      title: 'Focus',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: {},
      component: React.lazy(() => import('./widgets/FocusWidget')),
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'notes',
      title: 'Notes',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { max: 5 },
      component: React.lazy(() => import('./widgets/NotesWidget')),
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'documents',
      title: 'Documents',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { max: 6 },
      component: React.lazy(() => import('./widgets/DocumentsWidget')),
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'inventory',
      title: 'Inventory',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { max: 6 },
      component: React.lazy(() => import('./widgets/InventoryWidget')),
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'vault',
      title: 'Vault',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: {},
      component: React.lazy(() => import('./widgets/VaultWidget')),
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'feeds',
      title: 'Feeds',
      category: 'analytics',
      version: '1.0.0',
      defaultConfig: { max: 6 },
      component: React.lazy(() => import('./widgets/FeedsWidget')),
    }))
  } catch {}
  // Steam widgets
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'steam-profile',
      title: 'Steam Profile',
      category: 'helpers',
      version: '0.1.0',
      defaultConfig: { cacheTimeMs: 5 * 60 * 1000 },
      component: React.lazy(() => import('./widgets/SteamProfileWidget')),
      usesExternalApis: true,
      defaultCacheTimeMs: 5 * 60 * 1000,
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'steam-recent',
      title: 'Steam Recently Played',
      category: 'analytics',
      version: '0.1.0',
      defaultConfig: { max: 10, cacheTimeMs: 5 * 60 * 1000 },
      component: React.lazy(() => import('./widgets/SteamRecentlyPlayedWidget')),
      usesExternalApis: true,
      defaultCacheTimeMs: 5 * 60 * 1000,
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'steam-backlog',
      title: 'Steam Backlog',
      category: 'analytics',
      version: '0.1.0',
      defaultConfig: { max: 10, cacheTimeMs: 5 * 60 * 1000 },
      component: React.lazy(() => import('./widgets/SteamBacklogWidget')),
      usesExternalApis: true,
      defaultCacheTimeMs: 5 * 60 * 1000,
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'steam-game',
      title: 'Steam Game Detail',
      category: 'helpers',
      version: '0.1.0',
      defaultConfig: { appid: undefined, cacheTimeMs: 5 * 60 * 1000 },
      component: React.lazy(() => import('./widgets/SteamGameDetailWidget')),
      usesExternalApis: true,
      defaultCacheTimeMs: 5 * 60 * 1000,
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'jellyfin',
      title: 'Jellyfin',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { cacheTimeMs: 30 * 1000 },
      component: React.lazy(() => import('./widgets/JellyfinWidget')),
      usesExternalApis: true,
      defaultCacheTimeMs: 30 * 1000,
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'jellyseerr',
      title: 'Jellyseerr',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { cacheTimeMs: 30 * 1000 },
      component: React.lazy(() => import('./widgets/JellyseerrWidget')),
      usesExternalApis: true,
      defaultCacheTimeMs: 30 * 1000,
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'karakeep',
      title: 'Karakeep',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { cacheTimeMs: 30 * 1000 },
      component: React.lazy(() => import('./widgets/KarakeepWidget')),
      usesExternalApis: true,
      defaultCacheTimeMs: 30 * 1000,
    }))
  } catch {}
  // New utility widgets
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'world-clocks',
      title: 'World Clocks',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { cities: [], hour12: false },
      component: React.lazy(() => import('./widgets/WorldClocksWidget')),
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'countdown',
      title: 'Countdown Timer',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { label: '', targetIso: undefined, autoRepeatDays: null },
      component: React.lazy(() => import('./widgets/CountdownTimerWidget')),
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'password-generator',
      title: 'Password Generator',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { length: 16, useLower: true, useUpper: true, useDigits: true, useSymbols: false },
      component: React.lazy(() => import('./widgets/PasswordGeneratorWidget')),
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'random-id',
      title: 'Random ID',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { variant: 'uuid', length: 21 },
      component: React.lazy(() => import('./widgets/RandomIdWidget')),
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'scratchpad',
      title: 'Scratchpad',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { autoClearMs: 0, historySize: 10 },
      component: React.lazy(() => import('./widgets/ClipboardScratchpadWidget')),
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'unit-converter',
      title: 'Unit Converter',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { category: 'length', from: 'm', to: 'km', precision: 2 },
      component: React.lazy(() => import('./widgets/UnitConverterWidget')),
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'currency-converter',
      title: 'Currency Converter',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { base: 'USD', quote: 'EUR', cacheTimeMs: 15 * 60 * 1000 },
      component: React.lazy(() => import('./widgets/CurrencyConverterWidget')),
      usesExternalApis: true,
      defaultCacheTimeMs: 15 * 60 * 1000,
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'otp-helper',
      title: 'OTP/TOTP Helper',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { accounts: [] },
      component: React.lazy(() => import('./widgets/OTPHelperWidget')),
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'ip-network',
      title: 'IP & Network',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { redact: true, endpoints: [], cacheTimeMs: 15 * 60 * 1000 },
      component: React.lazy(() => import('./widgets/IPNetworkWidget')),
      usesExternalApis: true,
      defaultCacheTimeMs: 15 * 60 * 1000,
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'qr',
      title: 'QR',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { size: 256, errorCorrectionLevel: 'M' },
      component: React.lazy(() => import('./widgets/QRWidget')),
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'feature-flags',
      title: 'Feature Flags',
      category: 'actions',
      version: '1.0.0',
      defaultConfig: {},
      component: React.lazy(() => import('./widgets/FeatureFlagsWidget')),
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'webhook-tester',
      title: 'Webhook Tester',
      category: 'actions',
      version: '1.0.0',
      defaultConfig: { method: 'GET' },
      component: React.lazy(() => import('./widgets/WebhookTesterWidget')),
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'quotes',
      title: 'Quote',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { source: 'local', cacheTimeMs: 30 * 60 * 1000 },
      component: React.lazy(() => import('./widgets/QuotesWidget')),
      usesExternalApis: true,
      defaultCacheTimeMs: 30 * 60 * 1000,
    }))
  } catch {}
  // Weather widgets
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'air-quality',
      title: 'Air Quality',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { lat: undefined, lon: undefined, scale: 'us', cacheTimeMs: 5 * 60 * 1000 },
      component: React.lazy(() => import('./widgets/AirQualityWidget')),
      usesExternalApis: true,
      defaultCacheTimeMs: 5 * 60 * 1000,
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'precip-nowcast',
      title: 'Precip Nowcast',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { lat: undefined, lon: undefined, cacheTimeMs: 2 * 60 * 1000 },
      component: React.lazy(() => import('./widgets/PrecipNowcastWidget')),
      usesExternalApis: true,
      defaultCacheTimeMs: 2 * 60 * 1000,
    }))
  } catch {}
  // Weather/health utilities
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'sun-phases',
      title: 'Sun Phases',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { lat: undefined, lon: undefined, mode: 'official', cacheTimeMs: 60 * 60 * 1000 },
      component: React.lazy(() => import('./widgets/SunPhasesWidget')),
      usesExternalApis: true,
      defaultCacheTimeMs: 60 * 60 * 1000,
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'wind-focus',
      title: 'Wind Focus',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { lat: undefined, lon: undefined, units: 'kmh', cacheTimeMs: 5 * 60 * 1000 },
      component: React.lazy(() => import('./widgets/WindFocusWidget')),
      usesExternalApis: true,
      defaultCacheTimeMs: 5 * 60 * 1000,
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'mood-checkin',
      title: 'Mood Check-in',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { emojis: ['😀', '🙂', '😐', '🙁', '😞'] },
      component: React.lazy(() => import('./widgets/MoodCheckinWidget')),
    }))
  } catch {}
  // Location switcher and dev ops
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'locations',
      title: 'Locations',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: {},
      component: React.lazy(() => import('./widgets/MultiLocationSwitcherWidget')),
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'habits',
      title: 'Habits',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: {},
      component: React.lazy(() => import('./widgets/HabitTrackerWidget')),
    }))
  } catch {}
  try {
    widgetRegistry.register(createWidgetDefinition({
      id: 'cron-status',
      title: 'CRON Scheduler',
      category: 'analytics',
      version: '1.0.0',
      defaultConfig: { jobs: [] },
      component: React.lazy(() => import('./widgets/CronSchedulerStatusWidget')),
    }))
  } catch {}
  // homelab-static widgets removed: servers, monitoring, network, storage
}


