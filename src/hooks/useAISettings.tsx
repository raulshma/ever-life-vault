import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/use-toast';
import { 
  ReceiptAIConfig,
  AIProvider,
  AIModel,
  AI_PROVIDERS,
  DEFAULT_RECEIPT_AI_CONFIG,
  validateReceiptAIConfig,
  getProviderInfo,
  getAvailableModels,
  isProviderConfigured
} from '@/types/systemSettings';

export interface UseAISettingsReturn {
  // Configuration state
  config: ReceiptAIConfig;
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  
  // Available options
  availableProviders: AIProvider[];
  availableModels: AIModel[];
  
  // Configuration methods
  updateConfig: (updates: Partial<ReceiptAIConfig>) => void;
  saveConfig: () => Promise<boolean>;
  resetConfig: () => void;
  refreshConfig: () => Promise<void>;
  
  // Provider-specific methods
  getProviderModels: (provider: AIProvider) => AIModel[];
  isProviderConfigured: (provider?: AIProvider) => boolean;
  
  // Testing and validation
  testConnection: () => Promise<{ success: boolean; error?: string; latency?: number }>;
  validateCurrentConfig: () => { isValid: boolean; errors: string[] };
}

export function useAISettings(): UseAISettingsReturn {
  const { receiptAIConfig, setReceiptAIConfig, refreshReceiptAIConfig, systemSettingsService } = useSettings();
  const { toast } = useToast();
  
  const [localConfig, setLocalConfig] = useState<ReceiptAIConfig>(receiptAIConfig);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Sync local config with global config
  useEffect(() => {
    setLocalConfig(receiptAIConfig);
    setIsDirty(false);
  }, [receiptAIConfig]);

  // Available providers and models
  const availableProviders = Object.keys(AI_PROVIDERS) as AIProvider[];
  const availableModels = getAvailableModels(localConfig.provider);

  // Update local configuration
  const updateConfig = useCallback((updates: Partial<ReceiptAIConfig>) => {
    setLocalConfig(prev => {
      const newConfig = { ...prev, ...updates };
      
      // Auto-select first available model if provider changed and current model is invalid
      if (updates.provider && updates.provider !== prev.provider) {
        const models = getAvailableModels(updates.provider);
        if (models.length > 0 && !models.find(m => m.id === newConfig.model)) {
          newConfig.model = models.find(m => m.isRecommended)?.id || models[0].id;
        }
      }
      
      return newConfig;
    });
    setIsDirty(true);
  }, []);

  // Save configuration
  const saveConfig = useCallback(async (): Promise<boolean> => {
    if (!systemSettingsService) {
      toast({
        title: 'Error',
        description: 'Settings service not available',
        variant: 'destructive'
      });
      return false;
    }

    // Validate configuration before saving
    const validation = validateReceiptAIConfig(localConfig);
    if (!validation.isValid) {
      toast({
        title: 'Configuration Invalid',
        description: validation.errors.join(', '),
        variant: 'destructive'
      });
      return false;
    }

    setIsSaving(true);
    
    try {
      const success = await setReceiptAIConfig(localConfig);
      
      if (success) {
        setIsDirty(false);
        toast({
          title: 'Settings Saved',
          description: 'AI configuration has been updated successfully'
        });
        return true;
      } else {
        toast({
          title: 'Save Failed',
          description: 'Failed to save AI configuration',
          variant: 'destructive'
        });
        return false;
      }
    } catch (error) {
      toast({
        title: 'Save Error',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [localConfig, systemSettingsService, setReceiptAIConfig, toast]);

  // Reset configuration to saved state
  const resetConfig = useCallback(() => {
    setLocalConfig(receiptAIConfig);
    setIsDirty(false);
  }, [receiptAIConfig]);

  // Refresh configuration from server
  const refreshConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      await refreshReceiptAIConfig();
    } catch (error) {
      toast({
        title: 'Refresh Failed',
        description: 'Failed to refresh configuration',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [refreshReceiptAIConfig, toast]);

  // Get models for a specific provider
  const getProviderModels = useCallback((provider: AIProvider): AIModel[] => {
    return getAvailableModels(provider);
  }, []);

  // Check if provider is properly configured
  const isProviderConfiguredCheck = useCallback((provider?: AIProvider): boolean => {
    const targetProvider = provider || localConfig.provider;
    return isProviderConfigured(targetProvider, localConfig);
  }, [localConfig]);

  // Test connection to AI provider
  const testConnection = useCallback(async (): Promise<{ success: boolean; error?: string; latency?: number }> => {
    if (!systemSettingsService) {
      return { success: false, error: 'Settings service not available' };
    }

    // Validate configuration first
    const validation = validateReceiptAIConfig(localConfig);
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    toast({
      title: 'Testing Connection',
      description: 'Testing AI provider connection...'
    });

    try {
      const result = await systemSettingsService.testAIProviderConnection(localConfig);
      
      if (result.success) {
        toast({
          title: 'Connection Successful',
          description: `Connected to ${localConfig.provider} in ${result.latency}ms`
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: result.error,
          variant: 'destructive'
        });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Test Failed',
        description: errorMessage,
        variant: 'destructive'
      });
      return { success: false, error: errorMessage };
    }
  }, [localConfig, systemSettingsService, toast]);

  // Validate current configuration
  const validateCurrentConfig = useCallback(() => {
    return validateReceiptAIConfig(localConfig);
  }, [localConfig]);

  return {
    // Configuration state
    config: localConfig,
    isLoading,
    isSaving,
    isDirty,
    
    // Available options
    availableProviders,
    availableModels,
    
    // Configuration methods
    updateConfig,
    saveConfig,
    resetConfig,
    refreshConfig,
    
    // Provider-specific methods
    getProviderModels,
    isProviderConfigured: isProviderConfiguredCheck,
    
    // Testing and validation
    testConnection,
    validateCurrentConfig
  };
}

// Hook for quick access to receipt AI configuration
export function useReceiptAIConfig() {
  const { receiptAIConfig } = useSettings();
  return receiptAIConfig;
}

// Hook for checking if AI analysis is available
export function useAIAnalysisAvailable() {
  const { receiptAIConfig } = useSettings();
  
  return {
    isAvailable: isProviderConfigured(receiptAIConfig.provider, receiptAIConfig),
    provider: receiptAIConfig.provider,
    model: receiptAIConfig.model,
    quickAnalysisEnabled: receiptAIConfig.enable_quick_analysis,
    documentAnalysisEnabled: receiptAIConfig.enable_document_analysis
  };
}