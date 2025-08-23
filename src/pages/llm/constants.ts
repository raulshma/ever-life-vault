import {
  Crown,
  Shield,
  Flame,
  Gem,
  Rocket,
  Gauge,
  Sparkles,
  Brain
} from 'lucide-react'

export const PROVIDER_COLORS: Record<string, string> = {
  'OpenRouter': '#8B5CF6',
  'OpenAI': '#10B981',
  'Anthropic': '#F97316',
  'Google': '#3B82F6',
  'Meta': '#F59E0B',
  'xAI': '#EF4444',
  'Cohere': '#06B6D4',
  'Mistral': '#8B5CF6',
  'HuggingFace': '#F59E0B',
  'Replicate': '#10B981',
  'Together': '#F97316',
  'Anyscale': '#EF4444'
}

export const CAPABILITY_COLORS: Record<string, string> = {
  text: '#10B981',
  vision: '#8B5CF6',
  function_calling: '#F97316',
  streaming: '#3B82F6',
  coding: '#EF4444',
  multimodal: '#06B6D4',
  tool_use: '#8B5CF6',
  reasoning: '#F59E0B',
  memory: '#10B981',
  fine_tuning: '#F97316'
}

// Enhanced gradient backgrounds
export const GRADIENT_BACKGROUNDS = {
  primary: 'bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 dark:from-violet-950/20 dark:via-purple-950/20 dark:to-indigo-950/20',
  secondary: 'bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/20 dark:via-teal-950/20 dark:to-cyan-950/20',
  accent: 'bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-amber-950/20 dark:via-orange-950/20 dark:to-red-950/20',
  neutral: 'bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50 dark:from-slate-950/20 dark:via-gray-950/20 dark:to-zinc-950/20',
  success: 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-950/20 dark:via-emerald-950/20 dark:to-teal-950/20',
  warning: 'bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 dark:from-yellow-950/20 dark:via-amber-950/20 dark:to-orange-950/20',
  danger: 'bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 dark:from-red-950/20 dark:via-rose-950/20 dark:to-pink-950/20'
}

// Model quality indicators
export const QUALITY_ICONS = {
  premium: Crown,
  enterprise: Shield,
  experimental: Flame,
  stable: Gem,
  fast: Rocket,
  balanced: Gauge,
  creative: Sparkles,
  analytical: Brain
}

// Performance metrics colors
export const METRIC_COLORS = {
  excellent: '#10B981',
  good: '#3B82F6',
  average: '#F59E0B',
  poor: '#EF4444',
  unknown: '#6B7280'
}

// Cache configuration
export const CACHE_CONFIG = {
  key: 'llm_models_page',
  duration: 10 * 60 * 1000 // 10 minutes
}

// Default filter values
export const DEFAULT_FILTERS = {
  provider: 'all',
  company: 'all',
  capability: 'all'
}

// Default sort values
export const DEFAULT_SORT = {
  by: 'name' as const,
  order: 'asc' as const
}

// Tab configuration
export const TAB_CONFIG = {
  overview: 'overview',
  analytics: 'analytics',
  comparison: 'comparison',
  resources: 'resources',
  timeline: 'timeline'
}
