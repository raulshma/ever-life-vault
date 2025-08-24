import { SupabaseClient } from '@supabase/supabase-js';
import { SecretsService } from './SecretsService.js';

export interface AIProviderConfig {
  provider: 'google' | 'openrouter' | 'custom';
  model: string;
  use_system_key: boolean;
  endpoint_url?: string;
  temperature?: number;
  max_tokens?: number;
  timeout_seconds?: number;
  retry_attempts?: number;
  confidence_threshold?: number;
  enable_quick_analysis?: boolean;
  enable_document_analysis?: boolean;
  auto_categorization?: boolean;
}

export interface TestConnectionParams {
  provider: string;
  model: string;
  apiKey: string;
  endpointUrl?: string;
}

export interface TestConnectionResult {
  success: boolean;
  error?: string;
  latency?: number;
  details?: {
    configurationValid: boolean;
    apiKeyPresent: boolean;
    providerReachable: boolean;
    modelAvailable: boolean;
  };
}

export const SYSTEM_AI_PROVIDERS = {
  google: {
    name: 'Google Gemini',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', recommended: true },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
    ],
    requiresApiKey: true
  },
  openrouter: {
    name: 'OpenRouter',
    models: [
      { id: 'openai/gpt-4o', name: 'GPT-4O', recommended: true },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4O Mini' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' }
    ],
    requiresApiKey: true
  },
  custom: {
    name: 'Custom Provider',
    models: [
      { id: 'custom-model', name: 'Custom Model' }
    ],
    requiresApiKey: true
  }
};

export class SystemSettingsService {
  private supabase: SupabaseClient;
  private secretsService: SecretsService;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.secretsService = new SecretsService(supabase);
  }

  /**
   * Get AI configuration for user (without sensitive API keys)
   */
  async getReceiptAIConfig(): Promise<AIProviderConfig> {
    try {
      // Get the current user from the authenticated Supabase client
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await this.supabase
        .from('system_settings')
        .select('setting_value')
        .eq('user_id', user.id)
        .eq('feature_category', 'receipt_ai')
        .eq('setting_key', 'provider_config')
        .single();

      if (error || !data) {
        // Return default configuration
        return {
          provider: 'openrouter',
          model: 'openai/gpt-4o',
          use_system_key: true,
          temperature: 0.1,
          timeout_seconds: 60,
          retry_attempts: 3,
          confidence_threshold: 0.8,
          enable_quick_analysis: true,
          enable_document_analysis: true,
          auto_categorization: true
        };
      }

      return data.setting_value as AIProviderConfig;
    } catch (error) {
      console.error('Error getting AI config:', error);
      throw new Error('Failed to load AI configuration');
    }
  }

  /**
   * Set AI configuration (without API keys)
   */
  async setReceiptAIConfig(config: Partial<AIProviderConfig>): Promise<{
    success: boolean;
    error?: string;
    validationErrors?: string[];
  }> {
    try {
      // Get the current user from the authenticated Supabase client
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      
      if (userError || !user) {
        return {
          success: false,
          error: 'User not authenticated'
        };
      }

      // Validate configuration
      const validation = this.validateConfig(config);
      if (!validation.isValid) {
        return {
          success: false,
          error: 'Configuration validation failed',
          validationErrors: validation.errors
        };
      }

      // Get current config and merge
      const currentConfig = await this.getReceiptAIConfig();
      const mergedConfig = { ...currentConfig, ...config };

      // Store configuration
      const { error } = await this.supabase
        .from('system_settings')
        .upsert({
          user_id: user.id,
          feature_category: 'receipt_ai',
          setting_key: 'provider_config',
          setting_value: mergedConfig,
          is_encrypted: false,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,feature_category,setting_key'
        });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error setting AI config:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get API key for a provider (used by backend only)
   * Now uses the unified API key management system
   */
  async getProviderAPIKey(provider: string, useSystemKey: boolean, systemKeys: { google?: string; openrouter?: string }): Promise<string | null> {
    try {
      if (useSystemKey) {
        // Use system API key from the unified management system
        // The system keys are now managed through the API key management service
        // and will be automatically initialized during server startup
        return systemKeys[provider as keyof typeof systemKeys] || null;
      }

      // Get the current user from the authenticated Supabase client
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Use user API key
      const secretKey = `ai_provider_${provider}_api_key`;
      return await this.secretsService.retrieveSecret(secretKey, user.id);
    } catch (error) {
      console.error('Error getting provider API key:', error);
      return null;
    }
  }

  /**
   * Get endpoint URL for custom provider
   */
  async getProviderEndpoint(provider: string): Promise<string | null> {
    if (provider !== 'custom') return null;

    try {
      // Get the current user from the authenticated Supabase client
      const { data: { user }, error: userError } = await this.supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      const secretKey = `ai_provider_${provider}_endpoint`;
      return await this.secretsService.retrieveSecret(secretKey, user.id);
    } catch (error) {
      console.error('Error getting provider endpoint:', error);
      return null;
    }
  }

  /**
   * Test provider connection
   */
  async testProviderConnection(params: TestConnectionParams): Promise<TestConnectionResult> {
    const startTime = Date.now();
    const details = {
      configurationValid: false,
      apiKeyPresent: false,
      providerReachable: false,
      modelAvailable: false
    };

    try {
      // Basic validation
      if (!params.provider || !params.model || !params.apiKey) {
        return {
          success: false,
          error: 'Missing required parameters',
          details
        };
      }
      details.configurationValid = true;
      details.apiKeyPresent = true;

      // Provider-specific testing
      let testResult: { success: boolean; error?: string };

      switch (params.provider) {
        case 'google':
          testResult = await this.testGoogleConnection(params.apiKey, params.model);
          break;
        case 'openrouter':
          testResult = await this.testOpenRouterConnection(params.apiKey, params.model);
          break;
        case 'custom':
          testResult = await this.testCustomConnection(params.apiKey, params.endpointUrl);
          break;
        default:
          return {
            success: false,
            error: `Unsupported provider: ${params.provider}`,
            details
          };
      }

      if (!testResult.success) {
        return {
          success: false,
          error: testResult.error,
          latency: Date.now() - startTime,
          details
        };
      }

      details.providerReachable = true;
      details.modelAvailable = true;

      return {
        success: true,
        latency: Date.now() - startTime,
        details
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        latency: Date.now() - startTime,
        details
      };
    }
  }

  /**
   * Test Google AI connection
   */
  private async testGoogleConnection(apiKey: string, model: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Basic API key format validation
      if (!apiKey.startsWith('AIza') || apiKey.length < 35) {
        return { success: false, error: 'Invalid Google API key format' };
      }

      // Make a simple API call to validate
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}?key=${apiKey}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Invalid API key' };
        }
        if (response.status === 404) {
          return { success: false, error: 'Model not found' };
        }
        return { success: false, error: `API error: ${response.status}` };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }

  /**
   * Test OpenRouter connection
   */
  private async testOpenRouterConnection(apiKey: string, model: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Basic API key format validation
      if (!apiKey.startsWith('sk-or-') || apiKey.length < 20) {
        return { success: false, error: 'Invalid OpenRouter API key format' };
      }

      // Make a simple API call to validate
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          return { success: false, error: 'Invalid API key' };
        }
        return { success: false, error: `API error: ${response.status}` };
      }

      const data = await response.json();
      const modelExists = data.data?.some((m: any) => m.id === model);
      
      if (!modelExists) {
        return { success: false, error: 'Model not available' };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }

  /**
   * Test custom provider connection
   */
  private async testCustomConnection(apiKey: string, endpointUrl?: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!endpointUrl) {
        return { success: false, error: 'Custom endpoint URL is required' };
      }

      // Basic endpoint validation
      try {
        new URL(endpointUrl);
      } catch {
        return { success: false, error: 'Invalid endpoint URL' };
      }

      // Simple health check
      const response = await fetch(endpointUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok && response.status !== 404) {
        return { success: false, error: `Endpoint unreachable: ${response.status}` };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }

  /**
   * Get OpenRouter models from cache
   */
  async getOpenRouterModels(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('llm_models_cache')
        .select('*')
        .eq('provider', 'OpenRouter')
        .gt('updated_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // 1 hour
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error fetching OpenRouter models from cache:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Transform cached data to match expected format
      return data.map(model => ({
        id: model.id,
        name: model.data.name || model.id,
        description: model.data.description || null,
        context_length: model.data.context_length || null,
        pricing: model.data.pricing || null,
        is_recommended: model.data.is_recommended || false
      }));
    } catch (error) {
      console.error('Error getting OpenRouter models:', error);
      return [];
    }
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: Partial<AIProviderConfig>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.provider && !['google', 'openrouter', 'custom'].includes(config.provider)) {
      errors.push('Invalid provider');
    }

    if (config.model && typeof config.model !== 'string') {
      errors.push('Model must be a string');
    }

    if (config.temperature !== undefined) {
      if (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2) {
        errors.push('Temperature must be between 0 and 2');
      }
    }

    if (config.confidence_threshold !== undefined) {
      if (typeof config.confidence_threshold !== 'number' || config.confidence_threshold < 0 || config.confidence_threshold > 1) {
        errors.push('Confidence threshold must be between 0 and 1');
      }
    }

    if (config.retry_attempts !== undefined) {
      if (typeof config.retry_attempts !== 'number' || config.retry_attempts < 0 || config.retry_attempts > 10) {
        errors.push('Retry attempts must be between 0 and 10');
      }
    }

    if (config.timeout_seconds !== undefined) {
      if (typeof config.timeout_seconds !== 'number' || config.timeout_seconds < 10 || config.timeout_seconds > 300) {
        errors.push('Timeout must be between 10 and 300 seconds');
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}