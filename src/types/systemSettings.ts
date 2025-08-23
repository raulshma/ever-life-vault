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
  custom_api_key?: string;
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

// Default AI configuration
export const DEFAULT_RECEIPT_AI_CONFIG: ReceiptAIConfig = {
  provider: 'openrouter',
  model: 'openai/gpt-4o',
  api_key_source: 'system',
  custom_api_key: undefined,
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
    category: 'dashboard',
    name: 'Dashboard Settings',
    description: 'Customize dashboard behavior and appearance',
    icon: 'Layout',
    settings: [
      {
        key: 'layout_config',
        name: 'Layout Configuration',
        type: 'object',
        defaultValue: {
          auto_save_layout: true,
          compact_mode: false,
          animation_enabled: true,
          refresh_interval: 300
        }
      }
    ]
  },
  {
    category: 'notifications',
    name: 'Notifications',
    description: 'Configure application notifications and alerts',
    icon: 'Bell',
    settings: [
      {
        key: 'preferences',
        name: 'Notification Preferences',
        type: 'object',
        defaultValue: {
          receipt_analysis_complete: true,
          budget_alerts: true,
          integration_errors: true,
          system_updates: false
        }
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

  if (config.api_key_source === 'user' && !config.custom_api_key) {
    errors.push('Custom API key is required when using user-provided key');
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
  
  if (config.api_key_source === 'system') {
    // System key should be available (will be checked at runtime)
    return true;
  }
  
  if (config.api_key_source === 'user') {
    return !!(config.custom_api_key?.trim());
  }

  return false;
}