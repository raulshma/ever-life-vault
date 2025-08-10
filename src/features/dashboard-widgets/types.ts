import React from 'react'

export type WidgetInstanceId = string

export type MosaicTree = import('react-mosaic-component').MosaicNode<WidgetInstanceId>

export interface WidgetState<TConfig = unknown> {
  type: string
  version: string
  config: TConfig
}

export interface DashboardLayoutRecord<TState extends Record<WidgetInstanceId, WidgetState> = Record<WidgetInstanceId, WidgetState>> {
  id: string
  user_id: string
  layout_tree: MosaicTree | null
  widget_state: TState
  updated_at: string
}

export interface WidgetProps<TConfig> {
  id: WidgetInstanceId
  config: TConfig
  onConfigChange: (next: TConfig) => void
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
}


