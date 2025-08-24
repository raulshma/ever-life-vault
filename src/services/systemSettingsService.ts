// System Settings Service
// Extends the existing config store to support feature-specific settings

import { SupabaseClient } from '@supabase/supabase-js';
import { 
  ReceiptAIConfig, 
  SystemSettingsData, 
  SystemSettingsUpdate, 
  SystemSettingsResponse,
  FocusTimerConfig,
  DashboardConfig,
  NotificationConfig,
  UIConfig,
  IntegrationConfig,
  SecurityConfig,
  DEFAULT_RECEIPT_AI_CONFIG,
  DEFAULT_FOCUS_TIMER_CONFIG,
  DEFAULT_DASHBOARD_CONFIG,
  DEFAULT_NOTIFICATION_CONFIG,
  DEFAULT_UI_CONFIG,
  DEFAULT_INTEGRATION_CONFIG,
  DEFAULT_SECURITY_CONFIG
} from '@/types/systemSettings';

// Types matching the backend
interface AIProviderConfig {
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

interface TestConnectionResult {
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

interface APIKeyStatus {
  has_user_key: boolean;
  has_system_key: boolean;
  provider: string;
}

interface CachedAIModel {
  id: string;
  name: string;
  description?: string | null;
  context_length?: number | null;
  pricing?: any;
  is_recommended?: boolean;
}

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
      const { data, error } = await this.supabase
        .from('system_settings')
        .delete()
        .eq('feature_category', featureCategory)
        .eq('setting_key', settingKey)
        .select();

      if (error) {
        console.error('Error deleting system setting:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error in deleteSetting:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get settings organized by feature category
   */
  async getSettingsByFeature(): Promise<Record<string, Record<string, unknown>>> {
    const response = await this.getSettings();
    if (!response.success || !response.data) {
      return {};
    }

    const result: Record<string, Record<string, unknown>> = {};
    
    // Handle both single item and array responses
    const settingsData = Array.isArray(response.data) ? response.data : [response.data];
    
    for (const setting of settingsData) {
      if (!result[setting.feature_category]) {
        result[setting.feature_category] = {};
      }
      result[setting.feature_category][setting.setting_key] = setting.setting_value;
    }
    
    return result;
  }

  // Get receipt AI configuration
  async getReceiptAIConfig(): Promise<AIProviderConfig> {
    try {
      const response = await fetch('/api/ai-providers/config', {
        headers: {
          'Authorization': `Bearer ${await this.supabase.auth.getSession().then(session => session.data.session?.access_token)}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch AI configuration');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting AI config:', error);
      throw new Error('Failed to load AI configuration');
    }
  }

  // Set receipt AI configuration
  async setReceiptAIConfig(config: Partial<AIProviderConfig>): Promise<{ success: boolean; error?: string; validationErrors?: string[] }> {
    try {
      const response = await fetch('/api/ai-providers/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.supabase.auth.getSession().then(session => session.data.session?.access_token)}`
        },
        body: JSON.stringify(config)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to save configuration' };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error setting AI config:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Store API key for a provider
  async storeAPIKey(provider: string, apiKey: string, endpointUrl?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('/api/ai-providers/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.supabase.auth.getSession().then(session => session.data.session?.access_token)}`
        },
        body: JSON.stringify({ provider, api_key: apiKey, endpoint_url: endpointUrl })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to store API key' };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error storing API key:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Delete API key for a provider
  async deleteAPIKey(provider: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`/api/ai-providers/api-keys/${provider}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${await this.supabase.auth.getSession().then(session => session.data.session?.access_token)}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to delete API key' };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting API key:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Get API key status for a provider
  async getAPIKeyStatus(provider: string): Promise<APIKeyStatus> {
    try {
      const response = await fetch(`/api/ai-providers/api-keys/${provider}/status`, {
        headers: {
          'Authorization': `Bearer ${await this.supabase.auth.getSession().then(session => session.data.session?.access_token)}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to get API key status');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting API key status:', error);
      throw new Error('Failed to check API key status');
    }
  }

  // Test AI provider connection
  async testAIProviderConnection(config: Partial<AIProviderConfig>): Promise<TestConnectionResult> {
    try {
      const response = await fetch('/api/ai-providers/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.supabase.auth.getSession().then(session => session.data.session?.access_token)}`
        },
        body: JSON.stringify({
          provider: config.provider,
          model: config.model,
          use_system_key: config.use_system_key,
          endpoint_url: config.endpoint_url
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Connection test failed' };
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error testing connection:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection test failed' 
      };
    }
  }

  // Validate configuration
  async validateConfiguration(config: Partial<AIProviderConfig>): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    recommendations: string[];
  }> {
    const result = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[],
      recommendations: [] as string[]
    };

    // Provider validation
    if (!config.provider || !['google', 'openrouter', 'custom'].includes(config.provider)) {
      result.errors.push('Invalid AI provider selected');
      result.isValid = false;
    }

    // Model validation
    if (!config.model || typeof config.model !== 'string') {
      result.errors.push('Model must be specified');
      result.isValid = false;
    }

    // Temperature validation
    if (config.temperature !== undefined) {
      if (typeof config.temperature !== 'number' || config.temperature < 0 || config.temperature > 2) {
        result.errors.push('Temperature must be between 0 and 2');
        result.isValid = false;
      }
    }

    // Confidence threshold validation
    if (config.confidence_threshold !== undefined) {
      if (typeof config.confidence_threshold !== 'number' || config.confidence_threshold < 0 || config.confidence_threshold > 1) {
        result.errors.push('Confidence threshold must be between 0 and 1');
        result.isValid = false;
      }
    }

    // Retry attempts validation
    if (config.retry_attempts !== undefined) {
      if (typeof config.retry_attempts !== 'number' || config.retry_attempts < 0 || config.retry_attempts > 10) {
        result.errors.push('Retry attempts must be between 0 and 10');
        result.isValid = false;
      }
    }

    // Timeout validation
    if (config.timeout_seconds !== undefined) {
      if (typeof config.timeout_seconds !== 'number' || config.timeout_seconds < 10 || config.timeout_seconds > 300) {
        result.errors.push('Timeout must be between 10 and 300 seconds');
        result.isValid = false;
      }
    }

    // Add warnings and recommendations
    if (config.provider === 'openrouter' && config.model) {
      if (!config.model.includes('/')) {
        result.warnings.push('OpenRouter models typically use the format "provider/model-name"');
      }
    }

    if (config.provider === 'google' && config.model) {
      const recommendedModels = ['gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
      if (!recommendedModels.includes(config.model)) {
        result.recommendations.push('Consider using one of the recommended Google models for better performance');
      }
    }

    return result;
  }

  // Get OpenRouter models from cache
  async getOpenRouterModels(): Promise<CachedAIModel[]> {
    try {
      const response = await fetch('/api/ai-providers/openrouter/models', {
        headers: {
          'Authorization': `Bearer ${await this.supabase.auth.getSession().then(session => session.data.session?.access_token)}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch OpenRouter models');
      }
      
      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('Error getting OpenRouter models:', error);
      return [];
    }
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