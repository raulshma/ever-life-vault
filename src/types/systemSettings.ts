// Types and interfaces for AI provider configuration system
// This file defines the structure for configurable AI providers and settings

export type AIProvider = 'google' | 'openrouter' | 'custom';

export type APIKeySource = 'system' | 'user' | 'none';

export interface AIProviderInfo {
  id: AIProvider;
  name: string;
  description: string;
  icon?: string;
  supportedModels: AIModel[];
  requiresApiKey: boolean;
  supportsCustomApiKey: boolean;
  defaultModel?: string;
  pricing?: {
    inputCostPer1K?: number;
    outputCostPer1K?: number;
    currency?: string;
  };
  capabilities: AICapability[];
  documentationUrl?: string;
}

export interface AIModel {
  id: string;
  name: string;
  description?: string;
  provider: AIProvider;
  contextLength?: number;
  pricing?: {
    input?: number;
    output?: number;
    image?: number;
    request?: number;
  };
  capabilities?: string[];
  isRecommended?: boolean;
  isDeprecated?: boolean;
}

export interface AICapability {
  id: string;
  name: string;
  description: string;
  required: boolean;
}

export interface ReceiptAIConfig {
  provider: AIProvider;
  model: string;
  api_key_source: APIKeySource;
  custom_endpoint?: string; // For custom providers
  enable_quick_analysis: boolean;
  enable_document_analysis: boolean;
  auto_categorization: boolean;
  confidence_threshold: number;
  fallback_provider?: AIProvider;
  fallback_model?: string;
  retry_attempts: number;
  timeout_seconds: number;
  temperature?: number;
  max_tokens?: number;
  custom_prompts?: {
    quick_analysis?: string;
    document_analysis?: string;
    categorization?: string;
  };
}

export interface SystemSettingsFeature {
  category: string;
  name: string;
  description: string;
  icon?: string;
  settings: SystemSetting[];
}

export interface SystemSetting {
  key: string;
  name: string;
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect' | 'object' | 'encrypted';
  defaultValue: unknown;
  required?: boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: Array<{ value: unknown; label: string; description?: string }>;
  };
  dependsOn?: {
    setting: string;
    value: unknown;
  };
  sensitive?: boolean;
  category?: string;
}

export interface SystemSettingsData {
  user_id: string;
  feature_category: string;
  setting_key: string;
  setting_value: Record<string, unknown>;
  is_encrypted: boolean;
  created_at: string;
  updated_at: string;
}

export interface SystemSettingsUpdate {
  feature_category: string;
  setting_key: string;
  setting_value: Record<string, unknown>;
  is_encrypted?: boolean;
}

export interface SystemSettingsResponse {
  success: boolean;
  data?: SystemSettingsData | SystemSettingsData[];
  error?: string;
}

// AI Provider configurations
export const AI_PROVIDERS: Record<AIProvider, AIProviderInfo> = {
  google: {
    id: 'google',
    name: 'Google Gemini',
    description: 'Google\'s advanced AI model with excellent vision capabilities for receipt analysis',
    supportedModels: [
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Latest fast model with excellent accuracy',
        provider: 'google',
        contextLength: 1048576,
        isRecommended: true,
        capabilities: ['text', 'vision', 'function_calling']
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: 'High-accuracy model for complex documents',
        provider: 'google',
        contextLength: 2097152,
        capabilities: ['text', 'vision', 'function_calling']
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        description: 'Fast model for quick analysis',
        provider: 'google',
        contextLength: 1048576,
        capabilities: ['text', 'vision', 'function_calling']
      }
    ],
    requiresApiKey: true,
    supportsCustomApiKey: true,
    defaultModel: 'gemini-2.5-flash',
    capabilities: [
      { id: 'text', name: 'Text Analysis', description: 'Extract text from receipts', required: true },
      { id: 'vision', name: 'Image Processing', description: 'Process receipt images', required: true },
      { id: 'structure', name: 'Data Structuring', description: 'Structure extracted data', required: true },
      { id: 'categorization', name: 'Auto Categorization', description: 'Suggest expense categories', required: false }
    ],
    documentationUrl: 'https://ai.google.dev/docs'
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Access multiple AI providers through a unified API with competitive pricing',
    supportedModels: [
      {
        id: 'openai/gpt-4o',
        name: 'GPT-4O',
        description: 'OpenAI\'s latest multimodal model with excellent vision capabilities',
        provider: 'openrouter',
        contextLength: 128000,
        isRecommended: true,
        capabilities: ['text', 'vision', 'function_calling']
      },
      {
        id: 'openai/gpt-4o-mini',
        name: 'GPT-4O Mini',
        description: 'Smaller, faster version of GPT-4O with vision support',
        provider: 'openrouter',
        contextLength: 128000,
        capabilities: ['text', 'vision', 'function_calling']
      },
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        description: 'Anthropic\'s advanced model with excellent reasoning and vision',
        provider: 'openrouter',
        contextLength: 200000,
        capabilities: ['text', 'vision', 'function_calling']
      },
      {
        id: 'google/gemini-pro-1.5',
        name: 'Gemini Pro 1.5 (OpenRouter)',
        description: 'Google\'s Gemini Pro via OpenRouter',
        provider: 'openrouter',
        contextLength: 1048576,
        capabilities: ['text', 'vision', 'function_calling']
      },
      {
        id: 'meta-llama/llama-3.2-90b-vision-instruct',
        name: 'Llama 3.2 90B Vision',
        description: 'Meta\'s open-source vision model',
        provider: 'openrouter',
        contextLength: 131072,
        capabilities: ['text', 'vision']
      }
    ],
    requiresApiKey: true,
    supportsCustomApiKey: true,
    defaultModel: 'openai/gpt-4o',
    capabilities: [
      { id: 'text', name: 'Text Analysis', description: 'Extract text from receipts', required: true },
      { id: 'vision', name: 'Image Processing', description: 'Process receipt images (model dependent)', required: false },
      { id: 'structure', name: 'Data Structuring', description: 'Structure extracted data', required: true },
      { id: 'categorization', name: 'Auto Categorization', description: 'Suggest expense categories', required: false }
    ],
    documentationUrl: 'https://openrouter.ai/docs'
  },
  custom: {
    id: 'custom',
    name: 'Custom Provider',
    description: 'Configure a custom AI provider with your own API endpoint',
    supportedModels: [
      {
        id: 'custom-model',
        name: 'Custom Model',
        description: 'Your custom AI model',
        provider: 'custom',
        capabilities: ['text', 'vision']
      }
    ],
    requiresApiKey: true,
    supportsCustomApiKey: true,
    defaultModel: 'custom-model',
    capabilities: [
      { id: 'text', name: 'Text Analysis', description: 'Extract text from receipts', required: true },
      { id: 'vision', name: 'Image Processing', description: 'Process receipt images', required: false },
      { id: 'structure', name: 'Data Structuring', description: 'Structure extracted data', required: true }
    ]
  }
};

// Focus Timer Configuration Types
export type FocusMode = 
  | 'pomodoro_25_5' | 'pomodoro_30_5' | 'pomodoro_45_15' | 'pomodoro_50_10' | 'pomodoro_60_15'
  | 'fiftytwo_17' | 'flow_90' | 'flow_120_15' | 'ultradian_90_20' | 'custom';

export interface FocusProfile {
  id: string;
  name: string;
  bpm: number;
  accentEvery: number;
  subdivisions: number;
}

export interface FocusTimerConfig {
  default_mode: FocusMode;
  default_focus_minutes: number;
  default_break_minutes: number;
  default_bpm: number;
  default_accent_every: number;
  default_subdivisions: number;
  auto_start_breaks: boolean;
  auto_start_focus: boolean;
  mute_by_default: boolean;
  track_sessions: boolean;
  notification_sound: boolean;
  daily_goal_minutes: number;
  preferred_profiles: FocusProfile[];
}

// Dashboard & Widgets Configuration Types
export interface DashboardConfig {
  auto_save_layout: boolean;
  auto_save_interval_seconds: number;
  compact_mode: boolean;
  animation_enabled: boolean;
  default_refresh_interval_seconds: number;
  max_widgets_per_dashboard: number;
  enable_widget_caching: boolean;
  default_cache_time_minutes: number;
  show_widget_borders: boolean;
  enable_grid_snap: boolean;
}

// Notifications & UI Configuration Types
export interface NotificationConfig {
  receipt_analysis_complete: boolean;
  budget_alerts: boolean;
  integration_errors: boolean;
  system_updates: boolean;
  focus_session_complete: boolean;
  daily_goal_achieved: boolean;
  toast_duration_seconds: number;
  enable_sound_notifications: boolean;
  enable_browser_notifications: boolean;
}

export interface UIConfig {
  theme_mode: 'light' | 'dark' | 'amoled' | 'system';
  view_transitions_enabled: boolean;
  auto_categorize_sidebar: boolean;
  reduce_motion: boolean;
  high_contrast: boolean;
  compact_ui: boolean;
  sidebar_collapsed_by_default: boolean;
}

// Integration Configuration Types
export interface IntegrationConfig {
  default_timeout_seconds: number;
  auto_refresh_tokens: boolean;
  oauth_callback_timeout_seconds: number;
  enable_integration_caching: boolean;
  cache_duration_minutes: number;
  max_retry_attempts: number;
  retry_delay_seconds: number;
  steam: {
    show_private_profile_warning: boolean;
    cache_duration_hours: number;
  };
  mal: {
    default_list_status: 'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch';
    auto_update_progress: boolean;
  };
  aggregator: {
    max_items_per_feed: number;
    refresh_interval_minutes: number;
  };
}

// Security & Vault Configuration Types
export interface SecurityConfig {
  vault_session_timeout_minutes: number;
  require_master_password_confirmation: boolean;
  auto_lock_on_idle: boolean;
  idle_timeout_minutes: number;
  backup_frequency_days: number;
  max_backup_count: number;
  encrypt_local_storage: boolean;
  require_2fa: boolean;
  password_requirements: {
    min_length: number;
    require_uppercase: boolean;
    require_lowercase: boolean;
    require_numbers: boolean;
    require_symbols: boolean;
  };
}

// Default configurations
export const DEFAULT_RECEIPT_AI_CONFIG: ReceiptAIConfig = {
  provider: 'openrouter',
  model: 'openai/gpt-4o',
  api_key_source: 'system',
  custom_endpoint: undefined,
  enable_quick_analysis: true,
  enable_document_analysis: true,
  auto_categorization: true,
  confidence_threshold: 0.8,
  fallback_provider: 'google',
  fallback_model: 'gemini-2.5-flash',
  retry_attempts: 3,
  timeout_seconds: 60,
  temperature: 0.1,
  max_tokens: undefined
};

export const DEFAULT_FOCUS_TIMER_CONFIG: FocusTimerConfig = {
  default_mode: 'pomodoro_25_5',
  default_focus_minutes: 25,
  default_break_minutes: 5,
  default_bpm: 120,
  default_accent_every: 4,
  default_subdivisions: 1,
  auto_start_breaks: false,
  auto_start_focus: false,
  mute_by_default: false,
  track_sessions: true,
  notification_sound: true,
  daily_goal_minutes: 120,
  preferred_profiles: [
    { id: 'relaxed', name: 'Relaxed', bpm: 60, accentEvery: 4, subdivisions: 1 },
    { id: 'moderate', name: 'Moderate', bpm: 120, accentEvery: 4, subdivisions: 1 },
    { id: 'energetic', name: 'Energetic', bpm: 140, accentEvery: 2, subdivisions: 1 }
  ]
};

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  auto_save_layout: true,
  auto_save_interval_seconds: 30,
  compact_mode: false,
  animation_enabled: true,
  default_refresh_interval_seconds: 300,
  max_widgets_per_dashboard: 20,
  enable_widget_caching: true,
  default_cache_time_minutes: 5,
  show_widget_borders: true,
  enable_grid_snap: true
};

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  receipt_analysis_complete: true,
  budget_alerts: true,
  integration_errors: true,
  system_updates: false,
  focus_session_complete: true,
  daily_goal_achieved: true,
  toast_duration_seconds: 5,
  enable_sound_notifications: true,
  enable_browser_notifications: false
};

export const DEFAULT_UI_CONFIG: UIConfig = {
  theme_mode: 'system',
  view_transitions_enabled: true,
  auto_categorize_sidebar: false,
  reduce_motion: false,
  high_contrast: false,
  compact_ui: false,
  sidebar_collapsed_by_default: false
};

export const DEFAULT_INTEGRATION_CONFIG: IntegrationConfig = {
  default_timeout_seconds: 30,
  auto_refresh_tokens: true,
  oauth_callback_timeout_seconds: 300,
  enable_integration_caching: true,
  cache_duration_minutes: 15,
  max_retry_attempts: 3,
  retry_delay_seconds: 2,
  steam: {
    show_private_profile_warning: true,
    cache_duration_hours: 1
  },
  mal: {
    default_list_status: 'watching',
    auto_update_progress: false
  },
  aggregator: {
    max_items_per_feed: 50,
    refresh_interval_minutes: 30
  }
};

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  vault_session_timeout_minutes: 60,
  require_master_password_confirmation: true,
  auto_lock_on_idle: true,
  idle_timeout_minutes: 15,
  backup_frequency_days: 7,
  max_backup_count: 10,
  encrypt_local_storage: true,
  require_2fa: false,
  password_requirements: {
    min_length: 12,
    require_uppercase: true,
    require_lowercase: true,
    require_numbers: true,
    require_symbols: false
  }
};

// System settings feature definitions
export const SYSTEM_SETTINGS_FEATURES: SystemSettingsFeature[] = [
  {
    category: 'receipt_ai',
    name: 'Receipt AI Analysis',
    description: 'Configure AI providers and settings for receipt analysis',
    icon: 'Brain',
    settings: [
      {
        key: 'provider_config',
        name: 'AI Provider Configuration',
        description: 'Configure which AI provider to use for receipt analysis',
        type: 'object',
        defaultValue: DEFAULT_RECEIPT_AI_CONFIG,
        required: true
      }
    ]
  },
  {
    category: 'focus_timer',
    name: 'Focus Timer',
    description: 'Configure focus timer, metronome, and session preferences',
    icon: 'Timer',
    settings: [
      {
        key: 'timer_config',
        name: 'Focus Timer Configuration',
        description: 'Configure default timer settings and preferences',
        type: 'object',
        defaultValue: DEFAULT_FOCUS_TIMER_CONFIG,
        required: true
      }
    ]
  },
  {
    category: 'dashboard',
    name: 'Dashboard & Widgets',
    description: 'Customize dashboard behavior, layout, and widget settings',
    icon: 'Layout',
    settings: [
      {
        key: 'dashboard_config',
        name: 'Dashboard Configuration',
        description: 'Configure dashboard layout and widget behavior',
        type: 'object',
        defaultValue: DEFAULT_DASHBOARD_CONFIG,
        required: true
      }
    ]
  },
  {
    category: 'notifications',
    name: 'Notifications & UI',
    description: 'Configure application notifications, alerts, and UI preferences',
    icon: 'Bell',
    settings: [
      {
        key: 'notification_config',
        name: 'Notification Preferences',
        description: 'Configure when and how to receive notifications',
        type: 'object',
        defaultValue: DEFAULT_NOTIFICATION_CONFIG,
        required: true
      },
      {
        key: 'ui_config',
        name: 'UI Preferences',
        description: 'Configure user interface behavior and appearance',
        type: 'object',
        defaultValue: DEFAULT_UI_CONFIG,
        required: true
      }
    ]
  },
  {
    category: 'integrations',
    name: 'Integrations & APIs',
    description: 'Configure external service integrations and API settings',
    icon: 'Plug',
    settings: [
      {
        key: 'integration_config',
        name: 'Integration Configuration',
        description: 'Configure external service integration preferences',
        type: 'object',
        defaultValue: DEFAULT_INTEGRATION_CONFIG,
        required: true
      }
    ]
  },
  {
    category: 'security',
    name: 'Security & Vault',
    description: 'Configure security settings, vault behavior, and backup preferences',
    icon: 'Shield',
    settings: [
      {
        key: 'security_config',
        name: 'Security Configuration',
        description: 'Configure security settings and vault behavior',
        type: 'object',
        defaultValue: DEFAULT_SECURITY_CONFIG,
        required: true
      }
    ]
  }
];

// Validation functions
export function validateReceiptAIConfig(config: Partial<ReceiptAIConfig>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.provider || !Object.keys(AI_PROVIDERS).includes(config.provider)) {
    errors.push('Invalid AI provider selected');
  }

  if (!config.model || typeof config.model !== 'string') {
    errors.push('Model must be specified');
  }

  if (config.confidence_threshold !== undefined) {
    if (typeof config.confidence_threshold !== 'number' || 
        config.confidence_threshold < 0 || 
        config.confidence_threshold > 1) {
      errors.push('Confidence threshold must be between 0 and 1');
    }
  }

  if (config.retry_attempts !== undefined) {
    if (typeof config.retry_attempts !== 'number' || 
        config.retry_attempts < 0 || 
        config.retry_attempts > 10) {
      errors.push('Retry attempts must be between 0 and 10');
    }
  }

  if (config.timeout_seconds !== undefined) {
    if (typeof config.timeout_seconds !== 'number' || 
        config.timeout_seconds < 10 || 
        config.timeout_seconds > 300) {
      errors.push('Timeout must be between 10 and 300 seconds');
    }
  }

  if (config.temperature !== undefined) {
    if (typeof config.temperature !== 'number' || 
        config.temperature < 0 || 
        config.temperature > 2) {
      errors.push('Temperature must be between 0 and 2');
    }
  }

  if (config.api_key_source === 'user') {
    // Note: API keys are now handled securely on the backend
    // Frontend no longer validates API key presence
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function getProviderInfo(provider: AIProvider): AIProviderInfo | undefined {
  return AI_PROVIDERS[provider];
}

export function getAvailableModels(provider: AIProvider): AIModel[] {
  return AI_PROVIDERS[provider]?.supportedModels || [];
}

export function isProviderConfigured(provider: AIProvider, config: ReceiptAIConfig): boolean {
  const providerInfo = getProviderInfo(provider);
  if (!providerInfo) return false;

  if (!providerInfo.requiresApiKey) return true;
  
  // API key validation is now handled by the backend
  // Frontend considers provider configured if source is selected
  return config.api_key_source === 'system' || config.api_key_source === 'user';
}