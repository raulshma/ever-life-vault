import React from 'react'

export type WidgetInstanceId = string

// Legacy Mosaic tree (kept only for migration of previously saved layouts)
export type LegacyMosaicNode<T> =
  | T
  | {
      direction: 'row' | 'column'
      first: LegacyMosaicNode<T>
      second: LegacyMosaicNode<T>
      splitPercentage?: number
    }

export type MosaicTree = LegacyMosaicNode<WidgetInstanceId>

export interface GridLayout {
  kind: 'grid'
  order: WidgetInstanceId[]
}

export type GridColSpan = 1 | 2 | 3 | 4
export type GridRowSpan = 1 | 2 | 3

export type LayoutTree = MosaicTree | GridLayout

// Base configuration for widgets that use external APIs
export interface BaseWidgetConfig {
  cacheTimeMs?: number // Cache time in milliseconds, undefined means no caching
}

export interface WidgetState<TConfig = unknown> {
  type: string
  version: string
  config: TConfig
}

export interface DashboardLayoutRecord<TState extends Record<WidgetInstanceId, WidgetState> = Record<WidgetInstanceId, WidgetState>> {
  id: string
  user_id: string
  layout_tree: LayoutTree | null
  widget_state: TState
  updated_at: string
}

export interface WidgetProps<TConfig> {
  id: WidgetInstanceId
  config: TConfig
  onConfigChange: (next: TConfig) => void
  isEditing?: boolean
}

export interface WidgetDefinition<TConfig = unknown> {
  id: string
  title: string
  category: 'shortcuts' | 'helpers' | 'analytics' | 'actions' | 'other'
  version: string
  icon?: React.ComponentType<any>
  defaultSize?: { width: number; height: number }
  defaultConfig: TConfig
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configSchema?: any
  component: React.LazyExoticComponent<React.ComponentType<WidgetProps<TConfig>>>
  // Indicates if this widget uses external APIs and should show cache configuration
  usesExternalApis?: boolean
  // Default cache time for this widget (in milliseconds)
  defaultCacheTimeMs?: number
}


