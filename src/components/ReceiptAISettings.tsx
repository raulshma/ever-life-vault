import React, { useState, useEffect } from 'react';
import {
  Brain,
  Key,
  Settings as SettingsIcon,
  TestTube,
  Save,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
  Zap,
  Clock,
  Target
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAISettings } from '@/hooks/useAISettings';
import { useSettings } from '@/hooks/useSettings';
import { AI_PROVIDERS, AIProvider } from '@/types/systemSettings';

interface ReceiptAISettingsProps {
  onUnsavedChanges?: (hasChanges: boolean) => void;
}

export function ReceiptAISettings({ onUnsavedChanges }: ReceiptAISettingsProps) {
  const {
    config,
    isLoading,
    isSaving,
    isDirty,
    availableProviders,
    availableModels,
    updateConfig,
    saveConfig,
    resetConfig,
    getProviderModels,
    isProviderConfigured,
    testConnection,
    validateCurrentConfig,
    updateAPIKey,
    clearAPIKey,
    hasCustomAPIKey
  } = useAISettings();
  
  const { systemSettingsService } = useSettings();

  const [showAPIKey, setShowAPIKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ 
    success: boolean; 
    error?: string; 
    latency?: number;
    details?: {
      configurationValid: boolean;
      apiKeyPresent: boolean;
      providerReachable: boolean;
      modelAvailable: boolean;
    };
  } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validationDetails, setValidationDetails] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    recommendations: string[];
  } | null>(null);

  // Notify parent about unsaved changes
  useEffect(() => {
    onUnsavedChanges?.(isDirty);
  }, [isDirty, onUnsavedChanges]);

  // Handle provider change
  const handleProviderChange = (provider: AIProvider) => {
    updateConfig({ provider });
    setConnectionResult(null);
  };

  // Handle model change
  const handleModelChange = (model: string) => {
    updateConfig({ model });
  };

  // Handle API key update
  const handleAPIKeyUpdate = () => {
    if (apiKeyInput.trim()) {
      updateAPIKey(apiKeyInput.trim());
      setApiKeyInput('');
      setShowAPIKey(false);
    }
  };

  // Handle API key clear
  const handleAPIKeyClear = () => {
    clearAPIKey();
    setApiKeyInput('');
    setConnectionResult(null);
  };

  // Test connection with detailed validation
  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      // First run detailed validation
      if (systemSettingsService) {
        const validation = await systemSettingsService.validateConfiguration(config);
        setValidationDetails(validation);
      }
      
      // Then test the actual connection
      const result = await testConnection();
      setConnectionResult(result);
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Run validation when config changes
  useEffect(() => {
    if (systemSettingsService && !isLoading) {
      systemSettingsService.validateConfiguration(config).then(setValidationDetails);
    }
  }, [config, systemSettingsService, isLoading]);

  // Get provider info
  const currentProvider = AI_PROVIDERS[config.provider];
  const models = getProviderModels(config.provider);
  const validation = validateCurrentConfig();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading AI settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configuration Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Provider Configuration
          </CardTitle>
          <CardDescription>
            Configure which AI provider to use for receipt analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Provider Selection */}
          <div className="space-y-3">
            <Label htmlFor="provider">AI Provider</Label>
            <Select value={config.provider} onValueChange={handleProviderChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableProviders.map((providerId) => {
                  const provider = AI_PROVIDERS[providerId];
                  return (
                    <SelectItem key={providerId} value={providerId}>
                      <div className="flex items-center gap-2">
                        <span>{provider.name}</span>
                        {isProviderConfigured(providerId) && (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {currentProvider && (
              <p className="text-sm text-muted-foreground">
                {currentProvider.description}
                {currentProvider.documentationUrl && (
                  <a
                    href={currentProvider.documentationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Learn more <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </p>
            )}
          </div>

          {/* Model Selection */}
          <div className="space-y-3">
            <Label htmlFor="model">Model</Label>
            <Select value={config.model} onValueChange={handleModelChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center gap-2">
                      <span>{model.name}</span>
                      {model.isRecommended && (
                        <Badge variant="secondary" className="text-xs">Recommended</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {models.find(m => m.id === config.model)?.description && (
              <p className="text-sm text-muted-foreground">
                {models.find(m => m.id === config.model)?.description}
              </p>
            )}
          </div>

          {/* API Key Configuration */}
          {currentProvider?.requiresApiKey && (
            <div className="space-y-3">
              <Label>API Key Source</Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={config.api_key_source === 'system'}
                    onCheckedChange={(checked) => {
                      updateConfig({ 
                        api_key_source: checked ? 'system' : 'user',
                        custom_api_key: checked ? undefined : config.custom_api_key
                      });
                    }}
                  />
                  <Label>Use system API key</Label>
                </div>
                
                {config.api_key_source === 'user' && (
                  <div className="space-y-3 p-4 border rounded-lg">
                    <Label>Custom API Key</Label>
                    {hasCustomAPIKey ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="password"
                          value="••••••••••••••••"
                          disabled
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAPIKeyClear}
                        >
                          Clear
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            type={showAPIKey ? "text" : "password"}
                            placeholder="Enter your API key"
                            value={apiKeyInput}
                            onChange={(e) => setApiKeyInput(e.target.value)}
                            className="flex-1"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowAPIKey(!showAPIKey)}
                          >
                            {showAPIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleAPIKeyUpdate}
                            disabled={!apiKeyInput.trim()}
                          >
                            Save
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Your API key will be securely encrypted and stored.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Configuration Status */}
          <div className="space-y-3">
            <Label>Configuration Status</Label>
            <div className="flex items-center gap-2">
              {isProviderConfigured() ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-700 dark:text-green-400">
                    Provider is properly configured
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm text-orange-700 dark:text-orange-400">
                    Configuration incomplete
                  </span>
                </>
              )}
            </div>

            {!validation.isValid && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Configuration Issues:</strong>
                  <ul className="list-disc list-inside mt-1">
                    {validation.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Test Connection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Connection Test</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={isTestingConnection || !isProviderConfigured()}
              >
                {isTestingConnection ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Test Connection
              </Button>
            </div>
            
            {connectionResult && (
              <div className="space-y-3">
                <Alert>
                  {connectionResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <AlertDescription>
                    {connectionResult.success ? (
                      <span>
                        Connection successful! 
                        {connectionResult.latency && ` (${connectionResult.latency}ms)`}
                      </span>
                    ) : (
                      <span>Connection failed: {connectionResult.error}</span>
                    )}
                  </AlertDescription>
                </Alert>
                
                {/* Detailed test results */}
                {connectionResult.details && (
                  <div className="p-3 border rounded-lg bg-muted/50">
                    <h4 className="text-sm font-medium mb-2">Test Details:</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        {connectionResult.details.configurationValid ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-red-500" />
                        )}
                        <span>Configuration</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {connectionResult.details.apiKeyPresent ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-red-500" />
                        )}
                        <span>API Key</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {connectionResult.details.providerReachable ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-red-500" />
                        )}
                        <span>Provider</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {connectionResult.details.modelAvailable ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : (
                          <AlertCircle className="h-3 w-3 text-red-500" />
                        )}
                        <span>Model</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Validation details */}
            {validationDetails && (validationDetails.warnings.length > 0 || validationDetails.recommendations.length > 0) && (
              <div className="space-y-3">
                {validationDetails.warnings.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    <AlertDescription>
                      <strong>Warnings:</strong>
                      <ul className="list-disc list-inside mt-1">
                        {validationDetails.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                
                {validationDetails.recommendations.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4 text-blue-500" />
                    <AlertDescription>
                      <strong>Recommendations:</strong>
                      <ul className="list-disc list-inside mt-1">
                        {validationDetails.recommendations.map((rec, index) => (
                          <li key={index}>{rec}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Feature Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Feature Configuration
          </CardTitle>
          <CardDescription>
            Enable or disable AI analysis features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Quick Analysis</Label>
                <p className="text-sm text-muted-foreground">
                  Fast analysis for form auto-filling
                </p>
              </div>
              <Switch
                checked={config.enable_quick_analysis}
                onCheckedChange={(checked) => updateConfig({ enable_quick_analysis: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Document Analysis</Label>
                <p className="text-sm text-muted-foreground">
                  Detailed analysis of receipt documents
                </p>
              </div>
              <Switch
                checked={config.enable_document_analysis}
                onCheckedChange={(checked) => updateConfig({ enable_document_analysis: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Auto Categorization</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically suggest expense categories
                </p>
              </div>
              <Switch
                checked={config.auto_categorization}
                onCheckedChange={(checked) => updateConfig({ auto_categorization: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Settings */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                Advanced Settings
                <Badge variant="secondary" className="ml-auto">
                  {showAdvanced ? 'Hide' : 'Show'}
                </Badge>
              </CardTitle>
              <CardDescription>
                Fine-tune AI analysis parameters
              </CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="space-y-6">
              {/* Confidence Threshold */}
              <div className="space-y-3">
                <Label>Confidence Threshold: {config.confidence_threshold}</Label>
                <Slider
                  value={[config.confidence_threshold]}
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  onValueChange={([value]) => updateConfig({ confidence_threshold: value })}
                />
                <p className="text-sm text-muted-foreground">
                  Minimum confidence score required for AI suggestions
                </p>
              </div>

              {/* Retry Attempts */}
              <div className="space-y-3">
                <Label htmlFor="retry-attempts">Retry Attempts</Label>
                <Input
                  id="retry-attempts"
                  type="number"
                  min="1"
                  max="10"
                  value={config.retry_attempts}
                  onChange={(e) => updateConfig({ retry_attempts: parseInt(e.target.value) || 3 })}
                />
                <p className="text-sm text-muted-foreground">
                  Number of times to retry failed AI requests
                </p>
              </div>

              {/* Timeout */}
              <div className="space-y-3">
                <Label htmlFor="timeout">Timeout (seconds)</Label>
                <Input
                  id="timeout"
                  type="number"
                  min="10"
                  max="300"
                  value={config.timeout_seconds}
                  onChange={(e) => updateConfig({ timeout_seconds: parseInt(e.target.value) || 60 })}
                />
                <p className="text-sm text-muted-foreground">
                  Maximum time to wait for AI response
                </p>
              </div>

              {/* Temperature */}
              <div className="space-y-3">
                <Label>Temperature: {config.temperature || 0.1}</Label>
                <Slider
                  value={[config.temperature || 0.1]}
                  min={0}
                  max={2}
                  step={0.1}
                  onValueChange={([value]) => updateConfig({ temperature: value })}
                />
                <p className="text-sm text-muted-foreground">
                  Controls randomness in AI responses (lower = more deterministic)
                </p>
              </div>

              {/* Fallback Provider */}
              <div className="space-y-3">
                <Label htmlFor="fallback-provider">Fallback Provider</Label>
                <Select
                  value={config.fallback_provider || 'none'}
                  onValueChange={(value) => updateConfig({ 
                    fallback_provider: value === 'none' ? undefined : value as AIProvider 
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No fallback</SelectItem>
                    {availableProviders
                      .filter(p => p !== config.provider)
                      .map((providerId) => (
                        <SelectItem key={providerId} value={providerId}>
                          {AI_PROVIDERS[providerId].name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Alternative provider to use if primary provider fails
                </p>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Save/Reset Actions */}
      <div className="flex items-center justify-between pt-4">
        <Button
          variant="outline"
          onClick={resetConfig}
          disabled={!isDirty || isSaving}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset Changes
        </Button>
        
        <Button
          onClick={saveConfig}
          disabled={!isDirty || isSaving || !validation.isValid}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Configuration
        </Button>
      </div>
    </div>
  );
}