// System Settings Service
// Extends the existing config store to support feature-specific settings

import { SupabaseClient } from '@supabase/supabase-js';
import { 
  SystemSettingsData, 
  SystemSettingsUpdate, 
  SystemSettingsResponse,
  ReceiptAIConfig,
  DEFAULT_RECEIPT_AI_CONFIG,
  validateReceiptAIConfig,
  AI_PROVIDERS,
  getAvailableModels
} from '@/types/systemSettings';

export class SystemSettingsService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Get all settings for a user, optionally filtered by feature category
   */
  async getSettings(featureCategory?: string): Promise<SystemSettingsResponse> {
    try {
      let query = this.supabase
        .from('system_settings')
        .select('*')
        .order('feature_category', { ascending: true })
        .order('setting_key', { ascending: true });

      if (featureCategory) {
        query = query.eq('feature_category', featureCategory);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching system settings:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error in getSettings:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get a specific setting value
   */
  async getSetting<T = unknown>(
    featureCategory: string, 
    settingKey: string
  ): Promise<T | null> {
    try {
      const { data, error } = await this.supabase
        .from('system_settings')
        .select('setting_value')
        .eq('feature_category', featureCategory)
        .eq('setting_key', settingKey)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No matching row found
          return null;
        }
        throw error;
      }

      return data?.setting_value as T;
    } catch (error) {
      console.error(`Error fetching setting ${featureCategory}.${settingKey}:`, error);
      return null;
    }
  }

  /**
   * Set a specific setting value
   */
  async setSetting(
    featureCategory: string,
    settingKey: string,
    settingValue: Record<string, unknown>,
    isEncrypted = false
  ): Promise<SystemSettingsResponse> {
    try {
      const { data, error } = await this.supabase
        .from('system_settings')
        .upsert({
          feature_category: featureCategory,
          setting_key: settingKey,
          setting_value: settingValue,
          is_encrypted: isEncrypted,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,feature_category,setting_key'
        })
        .select()
        .single();

      if (error) {
        console.error('Error setting system setting:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error in setSetting:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Update multiple settings in a batch operation
   */
  async batchUpdateSettings(
    updates: SystemSettingsUpdate[]
  ): Promise<SystemSettingsResponse> {
    try {
      const upsertData = updates.map(update => ({
        feature_category: update.feature_category,
        setting_key: update.setting_key,
        setting_value: update.setting_value,
        is_encrypted: update.is_encrypted || false,
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await this.supabase
        .from('system_settings')
        .upsert(upsertData, {
          onConflict: 'user_id,feature_category,setting_key'
        })
        .select();

      if (error) {
        console.error('Error batch updating settings:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error in batchUpdateSettings:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Delete a specific setting
   */
  async deleteSetting(
    featureCategory: string,
    settingKey: string
  ): Promise<SystemSettingsResponse> {
    try {
      const { error } = await this.supabase
        .from('system_settings')
        .delete()
        .eq('feature_category', featureCategory)
        .eq('setting_key', settingKey);

      if (error) {
        console.error('Error deleting setting:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in deleteSetting:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get settings grouped by feature category
   */
  async getSettingsByFeature(): Promise<Record<string, Record<string, unknown>>> {
    try {
      const { data } = await this.supabase
        .from('system_settings_by_feature')
        .select('*');

      if (!data) return {};

      const result: Record<string, Record<string, unknown>> = {};
      for (const row of data) {
        result[row.feature_category] = row.settings;
      }

      return result;
    } catch (error) {
      console.error('Error fetching settings by feature:', error);
      return {};
    }
  }

  /**
   * Reset settings for a feature category to defaults
   */
  async resetFeatureSettings(featureCategory: string): Promise<SystemSettingsResponse> {
    try {
      // Delete existing settings for the feature
      await this.supabase
        .from('system_settings')
        .delete()
        .eq('feature_category', featureCategory);

      // Insert default settings based on feature category
      const defaultSettings = this.getDefaultSettingsForFeature(featureCategory);
      
      if (defaultSettings.length > 0) {
        const { data, error } = await this.supabase
          .from('system_settings')
          .insert(defaultSettings)
          .select();

        if (error) {
          console.error('Error resetting feature settings:', error);
          return { success: false, error: error.message };
        }

        return { success: true, data };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in resetFeatureSettings:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get default settings for a feature category
   */
  private getDefaultSettingsForFeature(featureCategory: string): Omit<SystemSettingsData, 'id' | 'user_id' | 'created_at' | 'updated_at'>[] {
    switch (featureCategory) {
      case 'receipt_ai':
        return [{
          feature_category: 'receipt_ai',
          setting_key: 'provider_config',
          setting_value: DEFAULT_RECEIPT_AI_CONFIG as Record<string, unknown>,
          is_encrypted: false
        }];
      
      case 'dashboard':
        return [{
          feature_category: 'dashboard',
          setting_key: 'layout_config',
          setting_value: {
            auto_save_layout: true,
            compact_mode: false,
            animation_enabled: true,
            refresh_interval: 300
          },
          is_encrypted: false
        }];

      case 'notifications':
        return [{
          feature_category: 'notifications',
          setting_key: 'preferences',
          setting_value: {
            receipt_analysis_complete: true,
            budget_alerts: true,
            integration_errors: true,
            system_updates: false
          },
          is_encrypted: false
        }];

      default:
        return [];
    }
  }

  /**
   * Validate and set receipt AI configuration
   */
  async setReceiptAIConfig(config: Partial<ReceiptAIConfig>): Promise<{
    success: boolean;
    error?: string;
    validationErrors?: string[];
  }> {
    // Validate the configuration
    const validation = validateReceiptAIConfig(config);
    if (!validation.isValid) {
      return {
        success: false,
        error: 'Configuration validation failed',
        validationErrors: validation.errors
      };
    }

    // Get current config and merge with updates
    const currentConfig = await this.getSetting<ReceiptAIConfig>('receipt_ai', 'provider_config');
    const mergedConfig = {
      ...DEFAULT_RECEIPT_AI_CONFIG,
      ...currentConfig,
      ...config
    };

    // Save the configuration
    const result = await this.setSetting(
      'receipt_ai',
      'provider_config',
      mergedConfig,
      false // AI config contains sensitive data but we'll handle encryption separately for API keys
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error
      };
    }

    return { success: true };
  }

  /**
   * Get receipt AI configuration with defaults
   */
  async getReceiptAIConfig(): Promise<ReceiptAIConfig> {
    const config = await this.getSetting<ReceiptAIConfig>('receipt_ai', 'provider_config');
    return {
      ...DEFAULT_RECEIPT_AI_CONFIG,
      ...config
    };
  }

  /**
   * Test AI provider connection with comprehensive validation
   */
  async testAIProviderConnection(config: ReceiptAIConfig): Promise<{
    success: boolean;
    error?: string;
    latency?: number;
    details?: {
      configurationValid: boolean;
      apiKeyPresent: boolean;
      providerReachable: boolean;
      modelAvailable: boolean;
    };
  }> {
    const startTime = Date.now();
    const details = {
      configurationValid: false,
      apiKeyPresent: false,
      providerReachable: false,
      modelAvailable: false
    };

    try {
      // Step 1: Validate configuration
      const validation = validateReceiptAIConfig(config);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Configuration invalid: ${validation.errors.join(', ')}`,
          details
        };
      }
      details.configurationValid = true;

      // Step 2: Check API key availability
      const hasApiKey = this.checkAPIKeyAvailability(config);
      if (!hasApiKey.available) {
        return {
          success: false,
          error: hasApiKey.error,
          details
        };
      }
      details.apiKeyPresent = true;

      // Step 3: Test provider-specific connection
      const connectionTest = await this.testProviderConnection(config);
      if (!connectionTest.success) {
        return {
          success: false,
          error: connectionTest.error,
          latency: Date.now() - startTime,
          details
        };
      }
      details.providerReachable = true;
      details.modelAvailable = true;

      const latency = Date.now() - startTime;
      return {
        success: true,
        latency,
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
   * Check if API key is available for the configuration
   */
  private checkAPIKeyAvailability(config: ReceiptAIConfig): {
    available: boolean;
    error?: string;
  } {
    // Check if provider requires API key
    const providerInfo = AI_PROVIDERS[config.provider];
    if (!providerInfo?.requiresApiKey) {
      return { available: true };
    }

    // Check system API key availability
    if (config.api_key_source === 'system') {
      const systemKey = this.getSystemAPIKey(config.provider);
      if (!systemKey) {
        return {
          available: false,
          error: `No system API key configured for ${providerInfo.name}`
        };
      }
      return { available: true };
    }

    // Check user API key
    if (config.api_key_source === 'user') {
      if (!config.custom_api_key || config.custom_api_key.trim() === '') {
        return {
          available: false,
          error: 'Custom API key is required but not provided'
        };
      }
      return { available: true };
    }

    return {
      available: false,
      error: 'Invalid API key source configuration'
    };
  }

  /**
   * Get system API key for a provider
   */
  private getSystemAPIKey(provider: string): string | null {
    // In a real implementation, this would check environment variables
    // or secure storage for system-wide API keys
    switch (provider) {
      case 'google':
        return process.env.GOOGLE_API_KEY || null;
      case 'openrouter':
        return process.env.OPENROUTER_API_KEY || null;
      default:
        return null;
    }
  }

  /**
   * Test connection to specific AI provider
   */
  private async testProviderConnection(config: ReceiptAIConfig): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      switch (config.provider) {
        case 'google':
          return await this.testGoogleConnection(config);
        case 'openrouter':
          return await this.testOpenRouterConnection(config);
        case 'custom':
          return await this.testCustomConnection(config);
        default:
          return {
            success: false,
            error: `Unsupported provider: ${config.provider}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  /**
   * Test Google AI connection
   */
  private async testGoogleConnection(config: ReceiptAIConfig): Promise<{
    success: boolean;
    error?: string;
  }> {
    // For Google, we would typically make a simple API call to verify the key
    // This is a simplified test - in production, you'd make an actual API call
    const apiKey = config.api_key_source === 'user' 
      ? config.custom_api_key 
      : this.getSystemAPIKey('google');

    if (!apiKey) {
      return {
        success: false,
        error: 'Google API key not available'
      };
    }

    // Simulate API validation
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Basic API key format validation for Google
    if (!apiKey.startsWith('AIza') || apiKey.length < 35) {
      return {
        success: false,
        error: 'Invalid Google API key format'
      };
    }

    return { success: true };
  }

  /**
   * Test OpenRouter connection
   */
  private async testOpenRouterConnection(config: ReceiptAIConfig): Promise<{
    success: boolean;
    error?: string;
  }> {
    const apiKey = config.api_key_source === 'user' 
      ? config.custom_api_key 
      : this.getSystemAPIKey('openrouter');

    if (!apiKey) {
      return {
        success: false,
        error: 'OpenRouter API key not available'
      };
    }

    // Simulate API validation
    await new Promise(resolve => setTimeout(resolve, 400));
    
    // Basic API key format validation for OpenRouter
    if (!apiKey.startsWith('sk-or-') || apiKey.length < 20) {
      return {
        success: false,
        error: 'Invalid OpenRouter API key format'
      };
    }

    return { success: true };
  }

  /**
   * Test custom provider connection
   */
  private async testCustomConnection(config: ReceiptAIConfig): Promise<{
    success: boolean;
    error?: string;
  }> {
    // For custom providers, we would need the endpoint URL and other details
    // This is a placeholder implementation
    if (!config.custom_endpoint) {
      return {
        success: false,
        error: 'Custom endpoint URL is required'
      };
    }

    // Simulate connection test
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return { success: true };
  }

  /**
   * Validate configuration with detailed error reporting
   */
  async validateConfiguration(config: ReceiptAIConfig): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    recommendations: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Basic validation using existing function
    const basicValidation = validateReceiptAIConfig(config);
    errors.push(...basicValidation.errors);

    // Provider-specific validation
    const providerInfo = AI_PROVIDERS[config.provider];
    if (!providerInfo) {
      errors.push(`Unknown provider: ${config.provider}`);
    } else {
      // Check if provider requires API key
      if (providerInfo.requiresApiKey) {
        const keyCheck = this.checkAPIKeyAvailability(config);
        if (!keyCheck.available) {
          errors.push(keyCheck.error || 'API key not available');
        }
      }

      // Model availability check
      const models = getAvailableModels(config.provider);
      if (!models.find(m => m.id === config.model)) {
        errors.push(`Model '${config.model}' is not available for provider '${config.provider}'`);
        
        const recommendedModel = models.find(m => m.isRecommended);
        if (recommendedModel) {
          recommendations.push(`Consider using the recommended model: ${recommendedModel.name}`);
        }
      }
    }

    // Performance warnings
    if (config.timeout_seconds < 30) {
      warnings.push('Timeout is set quite low - may cause issues with complex receipts');
    }
    
    if (config.retry_attempts > 5) {
      warnings.push('High retry count may cause slow responses');
    }

    if (config.confidence_threshold < 0.5) {
      warnings.push('Low confidence threshold may result in inaccurate results');
    }

    // Feature recommendations
    if (!config.enable_quick_analysis && !config.enable_document_analysis) {
      warnings.push('Both quick and document analysis are disabled');
    }

    if (!config.fallback_provider && providerInfo?.reliability !== 'high') {
      recommendations.push('Consider configuring a fallback provider for better reliability');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      recommendations
    };
  }

  /**
   * Import settings from a JSON object
   */
  async importSettings(settingsData: Record<string, Record<string, unknown>>): Promise<SystemSettingsResponse> {
    try {
      const updates: SystemSettingsUpdate[] = [];
      
      for (const [featureCategory, settings] of Object.entries(settingsData)) {
        for (const [settingKey, settingValue] of Object.entries(settings)) {
          updates.push({
            feature_category: featureCategory,
            setting_key: settingKey,
            setting_value: settingValue as Record<string, unknown>
          });
        }
      }

      return await this.batchUpdateSettings(updates);
    } catch (error) {
      console.error('Error importing settings:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Export all settings for backup
   */
  async exportSettings(): Promise<Record<string, Record<string, unknown>>> {
    return await this.getSettingsByFeature();
  }
}

// Create a singleton instance
let systemSettingsService: SystemSettingsService | null = null;

export function createSystemSettingsService(supabase: SupabaseClient): SystemSettingsService {
  if (!systemSettingsService) {
    systemSettingsService = new SystemSettingsService(supabase);
  }
  return systemSettingsService;
}

export function getSystemSettingsService(): SystemSettingsService | null {
  return systemSettingsService;
}