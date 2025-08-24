import React, { useState, useEffect } from 'react';
import { Plug, Globe, Clock, Shield, RefreshCw, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/use-toast';
import { IntegrationConfig, DEFAULT_INTEGRATION_CONFIG } from '@/types/systemSettings';

interface IntegrationSettingsProps {
  onUnsavedChanges?: (hasChanges: boolean) => void;
}

export function IntegrationSettings({ onUnsavedChanges }: IntegrationSettingsProps) {
  const { integrationConfig, setIntegrationConfig } = useSettings();
  const { toast } = useToast();
  const [localConfig, setLocalConfig] = useState<IntegrationConfig>(integrationConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Sync local config with global config
  useEffect(() => {
    setLocalConfig(integrationConfig);
    setIsDirty(false);
  }, [integrationConfig]);

  // Notify parent of unsaved changes
  useEffect(() => {
    onUnsavedChanges?.(isDirty);
  }, [isDirty, onUnsavedChanges]);

  const updateConfig = (updates: Partial<IntegrationConfig>) => {
    setLocalConfig(prev => ({ ...prev, ...updates }));
    setIsDirty(true);
  };

  const updateNestedConfig = <T extends keyof IntegrationConfig>(
    section: T,
    updates: Partial<IntegrationConfig[T]>
  ) => {
    setLocalConfig(prev => {
      const sectionData = prev[section];
      if (typeof sectionData === 'object' && sectionData !== null) {
        return {
          ...prev,
          [section]: { ...sectionData, ...updates }
        };
      }
      return prev;
    });
    setIsDirty(true);
  };

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      const success = await setIntegrationConfig(localConfig);
      if (success) {
        setIsDirty(false);
        toast({
          title: 'Settings Saved',
          description: 'Integration configuration has been updated successfully'
        });
      } else {
        toast({
          title: 'Save Failed',
          description: 'Failed to save integration configuration',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Save Error',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetConfig = () => {
    setLocalConfig(DEFAULT_INTEGRATION_CONFIG);
    setIsDirty(true);
  };

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plug className="h-5 w-5 text-primary" />
          <span className="font-medium">Integration Configuration</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={resetConfig} disabled={isSaving}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={saveConfig} disabled={!isDirty || isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* General Integration Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">General Settings</CardTitle>
          <CardDescription>
            Configure global integration timeouts and retry behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="autoRefreshTokens">Auto-refresh tokens</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically refresh OAuth tokens before expiry
                </p>
              </div>
              <Switch
                id="autoRefreshTokens"
                checked={localConfig.auto_refresh_tokens}
                onCheckedChange={(checked) => updateConfig({ auto_refresh_tokens: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="enableCaching">Integration caching</Label>
                <p className="text-sm text-muted-foreground">
                  Cache integration responses to reduce API calls
                </p>
              </div>
              <Switch
                id="enableCaching"
                checked={localConfig.enable_integration_caching}
                onCheckedChange={(checked) => updateConfig({ enable_integration_caching: checked })}
              />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Default timeout (seconds)</Label>
              <div className="space-y-2">
                <Slider
                  value={[localConfig.default_timeout_seconds]}
                  onValueChange={([value]) => updateConfig({ default_timeout_seconds: value })}
                  min={10}
                  max={120}
                  step={5}
                  className="w-full"
                />
                <div className="text-sm text-muted-foreground text-center">
                  {localConfig.default_timeout_seconds} seconds
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>OAuth callback timeout (seconds)</Label>
              <div className="space-y-2">
                <Slider
                  value={[localConfig.oauth_callback_timeout_seconds]}
                  onValueChange={([value]) => updateConfig({ oauth_callback_timeout_seconds: value })}
                  min={30}
                  max={300}
                  step={10}
                  className="w-full"
                />
                <div className="text-sm text-muted-foreground text-center">
                  {localConfig.oauth_callback_timeout_seconds} seconds 
                  ({Math.round(localConfig.oauth_callback_timeout_seconds / 60)} minutes)
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cache duration (minutes)</Label>
              <div className="space-y-2">
                <Slider
                  value={[localConfig.cache_duration_minutes]}
                  onValueChange={([value]) => updateConfig({ cache_duration_minutes: value })}
                  min={5}
                  max={180}
                  step={5}
                  className="w-full"
                  disabled={!localConfig.enable_integration_caching}
                />
                <div className="text-sm text-muted-foreground text-center">
                  {localConfig.cache_duration_minutes} minutes
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxRetries">Max retry attempts</Label>
              <Input
                id="maxRetries"
                type="number"
                min="1"
                max="10"
                value={localConfig.max_retry_attempts}
                onChange={(e) => updateConfig({ max_retry_attempts: parseInt(e.target.value) || 3 })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Retry delay (seconds)</Label>
            <div className="space-y-2">
              <Slider
                value={[localConfig.retry_delay_seconds]}
                onValueChange={([value]) => updateConfig({ retry_delay_seconds: value })}
                min={1}
                max={30}
                step={1}
                className="w-full"
              />
              <div className="text-sm text-muted-foreground text-center">
                {localConfig.retry_delay_seconds} seconds
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Steam Integration Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Steam Integration</CardTitle>
          <CardDescription>
            Configure Steam profile and data fetching preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="steamPrivateWarning">Private profile warning</Label>
                <p className="text-sm text-muted-foreground">
                  Show warning when Steam profile is private
                </p>
              </div>
              <Switch
                id="steamPrivateWarning"
                checked={localConfig.steam.show_private_profile_warning}
                onCheckedChange={(checked) => 
                  updateNestedConfig('steam', { show_private_profile_warning: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Steam cache duration (hours)</Label>
              <div className="space-y-2">
                <Slider
                  value={[localConfig.steam.cache_duration_hours]}
                  onValueChange={([value]) => 
                    updateNestedConfig('steam', { cache_duration_hours: value })
                  }
                  min={1}
                  max={48}
                  step={1}
                  className="w-full"
                  disabled={!localConfig.enable_integration_caching}
                />
                <div className="text-sm text-muted-foreground text-center">
                  {localConfig.steam.cache_duration_hours} hours
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MyAnimeList Integration Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">MyAnimeList Integration</CardTitle>
          <CardDescription>
            Configure MAL list management and synchronization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="defaultListStatus">Default list status</Label>
              <Select
                value={localConfig.mal.default_list_status}
                onValueChange={(value: 'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch') => 
                  updateNestedConfig('mal', { default_list_status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select default status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="watching">Watching</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="dropped">Dropped</SelectItem>
                  <SelectItem value="plan_to_watch">Plan to Watch</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="autoUpdateProgress">Auto-update progress</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically update watch progress when possible
                </p>
              </div>
              <Switch
                id="autoUpdateProgress"
                checked={localConfig.mal.auto_update_progress}
                onCheckedChange={(checked) => 
                  updateNestedConfig('mal', { auto_update_progress: checked })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RSS/Feed Aggregator Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">RSS/Feed Aggregator</CardTitle>
          <CardDescription>
            Configure RSS feed fetching and aggregation settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxItemsPerFeed">Max items per feed</Label>
              <Input
                id="maxItemsPerFeed"
                type="number"
                min="10"
                max="500"
                value={localConfig.aggregator.max_items_per_feed}
                onChange={(e) => 
                  updateNestedConfig('aggregator', { 
                    max_items_per_feed: parseInt(e.target.value) || 50 
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Refresh interval (minutes)</Label>
              <div className="space-y-2">
                <Slider
                  value={[localConfig.aggregator.refresh_interval_minutes]}
                  onValueChange={([value]) => 
                    updateNestedConfig('aggregator', { refresh_interval_minutes: value })
                  }
                  min={15}
                  max={1440}
                  step={15}
                  className="w-full"
                />
                <div className="text-sm text-muted-foreground text-center">
                  {localConfig.aggregator.refresh_interval_minutes} minutes 
                  ({Math.round(localConfig.aggregator.refresh_interval_minutes / 60)} hours)
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Performance Tips</CardTitle>
          <CardDescription>
            Optimize integration performance and reliability
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Timeout Optimization</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Use shorter timeouts for frequently called APIs</li>
                <li>• Increase timeouts for slow external services</li>
                <li>• Enable auto-retry for transient failures</li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Caching Strategy</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Enable caching for static data sources</li>
                <li>• Use longer cache durations for rare updates</li>
                <li>• Disable caching for real-time data</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuration Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Timeout:</span>
              <br />
              <span className="font-medium">{localConfig.default_timeout_seconds}s</span>
            </div>
            <div>
              <span className="text-muted-foreground">Retries:</span>
              <br />
              <span className="font-medium">{localConfig.max_retry_attempts}x</span>
            </div>
            <div>
              <span className="text-muted-foreground">Caching:</span>
              <br />
              <span className="font-medium">
                {localConfig.enable_integration_caching ? `${localConfig.cache_duration_minutes}m` : 'Disabled'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">OAuth timeout:</span>
              <br />
              <span className="font-medium">
                {Math.round(localConfig.oauth_callback_timeout_seconds / 60)}m
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {isDirty && (
        <Alert>
          <AlertDescription>
            You have unsaved changes. Make sure to save your settings before leaving this page.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}