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
  // New utility widgets
  try {
    widgetRegistry.register({
      id: 'world-clocks',
      title: 'World Clocks',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { cities: [], hour12: false },
      component: React.lazy(() => import('./widgets/WorldClocksWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'countdown',
      title: 'Countdown Timer',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { label: '', targetIso: undefined, autoRepeatDays: null },
      component: React.lazy(() => import('./widgets/CountdownTimerWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'password-generator',
      title: 'Password Generator',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { length: 16, useLower: true, useUpper: true, useDigits: true, useSymbols: false },
      component: React.lazy(() => import('./widgets/PasswordGeneratorWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'random-id',
      title: 'Random ID',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { variant: 'uuid', length: 21 },
      component: React.lazy(() => import('./widgets/RandomIdWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'scratchpad',
      title: 'Scratchpad',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { autoClearMs: 0, historySize: 10 },
      component: React.lazy(() => import('./widgets/ClipboardScratchpadWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'unit-converter',
      title: 'Unit Converter',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { category: 'length', from: 'm', to: 'km', precision: 2 },
      component: React.lazy(() => import('./widgets/UnitConverterWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'currency-converter',
      title: 'Currency Converter',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { base: 'USD', quote: 'EUR' },
      component: React.lazy(() => import('./widgets/CurrencyConverterWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'otp-helper',
      title: 'OTP/TOTP Helper',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { accounts: [] },
      component: React.lazy(() => import('./widgets/OTPHelperWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'ip-network',
      title: 'IP & Network',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { redact: true, endpoints: [] },
      component: React.lazy(() => import('./widgets/IPNetworkWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'qr',
      title: 'QR',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { size: 256, errorCorrectionLevel: 'M' },
      component: React.lazy(() => import('./widgets/QRWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'feature-flags',
      title: 'Feature Flags',
      category: 'actions',
      version: '1.0.0',
      defaultConfig: {},
      component: React.lazy(() => import('./widgets/FeatureFlagsWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'webhook-tester',
      title: 'Webhook Tester',
      category: 'actions',
      version: '1.0.0',
      defaultConfig: { method: 'GET' },
      component: React.lazy(() => import('./widgets/WebhookTesterWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'quotes',
      title: 'Quote',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { source: 'local' },
      component: React.lazy(() => import('./widgets/QuotesWidget')),
    })
  } catch {}
  // Weather widgets
  try {
    widgetRegistry.register({
      id: 'air-quality',
      title: 'Air Quality',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { lat: undefined, lon: undefined, scale: 'us' },
      component: React.lazy(() => import('./widgets/AirQualityWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'precip-nowcast',
      title: 'Precip Nowcast',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { lat: undefined, lon: undefined },
      component: React.lazy(() => import('./widgets/PrecipNowcastWidget')),
    })
  } catch {}
  // Weather/health utilities
  try {
    widgetRegistry.register({
      id: 'sun-phases',
      title: 'Sun Phases',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { lat: undefined, lon: undefined, mode: 'official' },
      component: React.lazy(() => import('./widgets/SunPhasesWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'wind-focus',
      title: 'Wind Focus',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { lat: undefined, lon: undefined, units: 'kmh' },
      component: React.lazy(() => import('./widgets/WindFocusWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'mood-checkin',
      title: 'Mood Check-in',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: { emojis: ['😀', '🙂', '😐', '🙁', '😞'] },
      component: React.lazy(() => import('./widgets/MoodCheckinWidget')),
    })
  } catch {}
  // Location switcher and dev ops
  try {
    widgetRegistry.register({
      id: 'locations',
      title: 'Locations',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: {},
      component: React.lazy(() => import('./widgets/MultiLocationSwitcherWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'habits',
      title: 'Habits',
      category: 'helpers',
      version: '1.0.0',
      defaultConfig: {},
      component: React.lazy(() => import('./widgets/HabitTrackerWidget')),
    })
  } catch {}
  try {
    widgetRegistry.register({
      id: 'cron-status',
      title: 'CRON Scheduler',
      category: 'analytics',
      version: '1.0.0',
      defaultConfig: { jobs: [] },
      component: React.lazy(() => import('./widgets/CronSchedulerStatusWidget')),
    })
  } catch {}
  // homelab-static widgets removed: servers, monitoring, network, storage
}


