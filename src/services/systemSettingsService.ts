// System Settings Service
// Extends the existing config store to support feature-specific settings

import { SupabaseClient } from '@supabase/supabase-js';
import { 
  SystemSettingsData, 
  SystemSettingsUpdate, 
  SystemSettingsResponse,
  ReceiptAIConfig,
  DEFAULT_RECEIPT_AI_CONFIG,
  FocusTimerConfig,
  DEFAULT_FOCUS_TIMER_CONFIG,
  DashboardConfig,
  DEFAULT_DASHBOARD_CONFIG,
  NotificationConfig,
  DEFAULT_NOTIFICATION_CONFIG,
  UIConfig,
  DEFAULT_UI_CONFIG,
  IntegrationConfig,
  DEFAULT_INTEGRATION_CONFIG,
  SecurityConfig,
  DEFAULT_SECURITY_CONFIG,
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
          setting_value: DEFAULT_RECEIPT_AI_CONFIG as any,
          is_encrypted: false
        }];
      
      case 'focus_timer':
        return [{
          feature_category: 'focus_timer',
          setting_key: 'timer_config',
          setting_value: DEFAULT_FOCUS_TIMER_CONFIG as any,
          is_encrypted: false
        }];

      case 'dashboard':
        return [{
          feature_category: 'dashboard',
          setting_key: 'dashboard_config',
          setting_value: DEFAULT_DASHBOARD_CONFIG as any,
          is_encrypted: false
        }];

      case 'notifications':
        return [{
          feature_category: 'notifications',
          setting_key: 'notification_config',
          setting_value: DEFAULT_NOTIFICATION_CONFIG as any,
          is_encrypted: false
        }, {
          feature_category: 'notifications',
          setting_key: 'ui_config',
          setting_value: DEFAULT_UI_CONFIG as any,
          is_encrypted: false
        }];

      case 'integrations':
        return [{
          feature_category: 'integrations',
          setting_key: 'integration_config',
          setting_value: DEFAULT_INTEGRATION_CONFIG as any,
          is_encrypted: false
        }];

      case 'security':
        return [{
          feature_category: 'security',
          setting_key: 'security_config',
          setting_value: DEFAULT_SECURITY_CONFIG as any,
          is_encrypted: false
        }];

      default:
        return [];
    }
  }

  /**
   * Validate and set receipt AI configuration (without API keys)
   */
  async setReceiptAIConfig(config: Partial<ReceiptAIConfig>): Promise<{
    success: boolean;
    error?: string;
    validationErrors?: string[];
  }> {
    // Basic frontend validation
    const validation = validateReceiptAIConfig(config);
    if (!validation.isValid) {
      return {
        success: false,
        error: 'Configuration validation failed',
        validationErrors: validation.errors
      };
    }

    // Remove sensitive fields before sending to backend
    const sanitizedConfig = {
      provider: config.provider,
      model: config.model,
      use_system_key: config.api_key_source === 'system',
      endpoint_url: config.custom_endpoint,
      temperature: config.temperature,
      max_tokens: config.max_tokens,
      timeout_seconds: config.timeout_seconds,
      retry_attempts: config.retry_attempts,
      confidence_threshold: config.confidence_threshold,
      enable_quick_analysis: config.enable_quick_analysis,
      enable_document_analysis: config.enable_document_analysis,
      auto_categorization: config.auto_categorization
    };

    try {
      const response = await fetch('/api/ai-providers/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await this.supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify(sanitizedConfig)
      });

      const result = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Failed to save configuration',
          validationErrors: result.validation_errors
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Get receipt AI configuration (without sensitive API keys)
   */
  async getReceiptAIConfig(): Promise<ReceiptAIConfig> {
    try {
      const response = await fetch('/api/ai-providers/config', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${(await this.supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      if (!response.ok) {
        // Fallback to default if API fails
        return DEFAULT_RECEIPT_AI_CONFIG;
      }

      const config = await response.json();
      
      // Convert backend format to frontend format
      return {
        ...DEFAULT_RECEIPT_AI_CONFIG,
        provider: config.provider,
        model: config.model,
        api_key_source: config.use_system_key ? 'system' : 'user',
        custom_endpoint: config.endpoint_url,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        timeout_seconds: config.timeout_seconds,
        retry_attempts: config.retry_attempts,
        confidence_threshold: config.confidence_threshold,
        enable_quick_analysis: config.enable_quick_analysis,
        enable_document_analysis: config.enable_document_analysis,
        auto_categorization: config.auto_categorization
      };
    } catch (error) {
      console.error('Failed to load receipt AI config:', error);
      return DEFAULT_RECEIPT_AI_CONFIG;
    }
  }

  /**
   * Test AI provider connection with comprehensive validation (using backend)
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
    try {
      const testData = {
        provider: config.provider,
        model: config.model,
        use_system_key: config.api_key_source === 'system',
        endpoint_url: config.custom_endpoint
      };

      const response = await fetch('/api/ai-providers/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await this.supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify(testData)
      });

      const result = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Connection test failed'
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Store user API key securely on backend
   */
  async storeAPIKey(provider: string, apiKey: string, endpointUrl?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const body: any = { provider, api_key: apiKey };
      if (endpointUrl) {
        body.endpoint_url = endpointUrl;
      }

      const response = await fetch('/api/ai-providers/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await this.supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify(body)
      });

      const result = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Failed to store API key'
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Delete user API key from backend
   */
  async deleteAPIKey(provider: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`/api/ai-providers/api-keys/${provider}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${(await this.supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      const result = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Failed to delete API key'
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Check API key status for a provider
   */
  async getAPIKeyStatus(provider: string): Promise<{
    hasUserKey: boolean;
    hasSystemKey: boolean;
    error?: string;
  }> {
    try {
      const response = await fetch(`/api/ai-providers/api-keys/${provider}/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${(await this.supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      if (!response.ok) {
        return {
          hasUserKey: false,
          hasSystemKey: false,
          error: 'Failed to check API key status'
        };
      }

      const result = await response.json();
      return {
        hasUserKey: result.has_user_key,
        hasSystemKey: result.has_system_key
      };
    } catch (error) {
      return {
        hasUserKey: false,
        hasSystemKey: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
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
      // Check API key availability through backend
      try {
        const keyStatus = await this.getAPIKeyStatus(config.provider);
        
        if (config.api_key_source === 'system' && !keyStatus.hasSystemKey) {
          errors.push('System API key not available');
        }
        
        if (config.api_key_source === 'user' && !keyStatus.hasUserKey) {
          errors.push('User API key not configured');
        }
      } catch (error) {
        warnings.push('Could not verify API key availability');
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
    if (config.timeout_seconds && config.timeout_seconds < 30) {
      warnings.push('Timeout is set quite low - may cause issues with complex receipts');
    }
    
    if (config.retry_attempts && config.retry_attempts > 5) {
      warnings.push('High retry count may cause slow responses');
    }

    if (config.confidence_threshold && config.confidence_threshold < 0.5) {
      warnings.push('Low confidence threshold may result in inaccurate results');
    }

    // Feature recommendations
    if (!config.enable_quick_analysis && !config.enable_document_analysis) {
      warnings.push('Both quick and document analysis are disabled');
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

  // Generic configuration methods for all setting types

  /**
   * Get Focus Timer configuration
   */
  async getFocusTimerConfig(): Promise<FocusTimerConfig> {
    const config = await this.getSetting<FocusTimerConfig>('focus_timer', 'timer_config');
    return config || DEFAULT_FOCUS_TIMER_CONFIG;
  }

  /**
   * Set Focus Timer configuration
   */
  async setFocusTimerConfig(config: Partial<FocusTimerConfig>): Promise<{
    success: boolean;
    error?: string;
  }> {
    const fullConfig = { ...DEFAULT_FOCUS_TIMER_CONFIG, ...config };
    const result = await this.setSetting('focus_timer', 'timer_config', fullConfig as any);
    return { success: result.success, error: result.error };
  }

  /**
   * Get Dashboard configuration
   */
  async getDashboardConfig(): Promise<DashboardConfig> {
    const config = await this.getSetting<DashboardConfig>('dashboard', 'dashboard_config');
    return config || DEFAULT_DASHBOARD_CONFIG;
  }

  /**
   * Set Dashboard configuration
   */
  async setDashboardConfig(config: Partial<DashboardConfig>): Promise<{
    success: boolean;
    error?: string;
  }> {
    const fullConfig = { ...DEFAULT_DASHBOARD_CONFIG, ...config };
    const result = await this.setSetting('dashboard', 'dashboard_config', fullConfig as any);
    return { success: result.success, error: result.error };
  }

  /**
   * Get Notification configuration
   */
  async getNotificationConfig(): Promise<NotificationConfig> {
    const config = await this.getSetting<NotificationConfig>('notifications', 'notification_config');
    return config || DEFAULT_NOTIFICATION_CONFIG;
  }

  /**
   * Set Notification configuration
   */
  async setNotificationConfig(config: Partial<NotificationConfig>): Promise<{
    success: boolean;
    error?: string;
  }> {
    const fullConfig = { ...DEFAULT_NOTIFICATION_CONFIG, ...config };
    const result = await this.setSetting('notifications', 'notification_config', fullConfig as any);
    return { success: result.success, error: result.error };
  }

  /**
   * Get UI configuration
   */
  async getUIConfig(): Promise<UIConfig> {
    const config = await this.getSetting<UIConfig>('notifications', 'ui_config');
    return config || DEFAULT_UI_CONFIG;
  }

  /**
   * Set UI configuration
   */
  async setUIConfig(config: Partial<UIConfig>): Promise<{
    success: boolean;
    error?: string;
  }> {
    const fullConfig = { ...DEFAULT_UI_CONFIG, ...config };
    const result = await this.setSetting('notifications', 'ui_config', fullConfig as any);
    return { success: result.success, error: result.error };
  }

  /**
   * Get Integration configuration
   */
  async getIntegrationConfig(): Promise<IntegrationConfig> {
    const config = await this.getSetting<IntegrationConfig>('integrations', 'integration_config');
    return config || DEFAULT_INTEGRATION_CONFIG;
  }

  /**
   * Set Integration configuration
   */
  async setIntegrationConfig(config: Partial<IntegrationConfig>): Promise<{
    success: boolean;
    error?: string;
  }> {
    const fullConfig = { ...DEFAULT_INTEGRATION_CONFIG, ...config };
    const result = await this.setSetting('integrations', 'integration_config', fullConfig as any);
    return { success: result.success, error: result.error };
  }

  /**
   * Get Security configuration
   */
  async getSecurityConfig(): Promise<SecurityConfig> {
    const config = await this.getSetting<SecurityConfig>('security', 'security_config');
    return config || DEFAULT_SECURITY_CONFIG;
  }

  /**
   * Set Security configuration
   */
  async setSecurityConfig(config: Partial<SecurityConfig>): Promise<{
    success: boolean;
    error?: string;
  }> {
    const fullConfig = { ...DEFAULT_SECURITY_CONFIG, ...config };
    const result = await this.setSetting('security', 'security_config', fullConfig as any);
    return { success: result.success, error: result.error };
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