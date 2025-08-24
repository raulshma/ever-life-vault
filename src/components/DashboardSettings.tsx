import React, { useState, useEffect } from 'react';
import { Layout, Grid, Zap, Clock, Save, RotateCcw } from 'lucide-react';
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
import { DashboardConfig, DEFAULT_DASHBOARD_CONFIG } from '@/types/systemSettings';

interface DashboardSettingsProps {
  onUnsavedChanges?: (hasChanges: boolean) => void;
}

export function DashboardSettings({ onUnsavedChanges }: DashboardSettingsProps) {
  const { dashboardConfig, setDashboardConfig } = useSettings();
  const { toast } = useToast();
  const [localConfig, setLocalConfig] = useState<DashboardConfig>(dashboardConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Sync local config with global config
  useEffect(() => {
    setLocalConfig(dashboardConfig);
    setIsDirty(false);
  }, [dashboardConfig]);

  // Notify parent of unsaved changes
  useEffect(() => {
    onUnsavedChanges?.(isDirty);
  }, [isDirty, onUnsavedChanges]);

  const updateConfig = (updates: Partial<DashboardConfig>) => {
    setLocalConfig(prev => ({ ...prev, ...updates }));
    setIsDirty(true);
  };

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      const success = await setDashboardConfig(localConfig);
      if (success) {
        setIsDirty(false);
        toast({
          title: 'Settings Saved',
          description: 'Dashboard configuration has been updated successfully'
        });
      } else {
        toast({
          title: 'Save Failed',
          description: 'Failed to save dashboard configuration',
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
    setLocalConfig(DEFAULT_DASHBOARD_CONFIG);
    setIsDirty(true);
  };

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layout className="h-5 w-5 text-primary" />
          <span className="font-medium">Dashboard & Widgets Configuration</span>
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

      {/* Layout Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Layout Settings</CardTitle>
          <CardDescription>
            Configure dashboard layout behavior and persistence
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="autoSaveLayout">Auto-save layout</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically save layout changes as you make them
                </p>
              </div>
              <Switch
                id="autoSaveLayout"
                checked={localConfig.auto_save_layout}
                onCheckedChange={(checked) => updateConfig({ auto_save_layout: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="enableGridSnap">Grid snap</Label>
                <p className="text-sm text-muted-foreground">
                  Snap widgets to grid when resizing and moving
                </p>
              </div>
              <Switch
                id="enableGridSnap"
                checked={localConfig.enable_grid_snap}
                onCheckedChange={(checked) => updateConfig({ enable_grid_snap: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="showWidgetBorders">Widget borders</Label>
                <p className="text-sm text-muted-foreground">
                  Show borders around dashboard widgets
                </p>
              </div>
              <Switch
                id="showWidgetBorders"
                checked={localConfig.show_widget_borders}
                onCheckedChange={(checked) => updateConfig({ show_widget_borders: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="animationEnabled">Animations</Label>
                <p className="text-sm text-muted-foreground">
                  Enable smooth animations for layout changes
                </p>
              </div>
              <Switch
                id="animationEnabled"
                checked={localConfig.animation_enabled}
                onCheckedChange={(checked) => updateConfig({ animation_enabled: checked })}
              />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Auto-save interval (seconds)</Label>
              <div className="space-y-2">
                <Slider
                  value={[localConfig.auto_save_interval_seconds]}
                  onValueChange={([value]) => updateConfig({ auto_save_interval_seconds: value })}
                  min={5}
                  max={120}
                  step={5}
                  className="w-full"
                />
                <div className="text-sm text-muted-foreground text-center">
                  {localConfig.auto_save_interval_seconds} seconds
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxWidgets">Max widgets per dashboard</Label>
              <Input
                id="maxWidgets"
                type="number"
                min="5"
                max="50"
                value={localConfig.max_widgets_per_dashboard}
                onChange={(e) => updateConfig({ max_widgets_per_dashboard: parseInt(e.target.value) || 20 })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Widget Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Widget Settings</CardTitle>
          <CardDescription>
            Configure widget behavior and performance settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="compactMode">Compact mode</Label>
                <p className="text-sm text-muted-foreground">
                  Use smaller spacing and compact widget layouts
                </p>
              </div>
              <Switch
                id="compactMode"
                checked={localConfig.compact_mode}
                onCheckedChange={(checked) => updateConfig({ compact_mode: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="enableWidgetCaching">Widget caching</Label>
                <p className="text-sm text-muted-foreground">
                  Cache widget data to improve performance
                </p>
              </div>
              <Switch
                id="enableWidgetCaching"
                checked={localConfig.enable_widget_caching}
                onCheckedChange={(checked) => updateConfig({ enable_widget_caching: checked })}
              />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Default refresh interval (seconds)</Label>
              <div className="space-y-2">
                <Slider
                  value={[localConfig.default_refresh_interval_seconds]}
                  onValueChange={([value]) => updateConfig({ default_refresh_interval_seconds: value })}
                  min={30}
                  max={1800}
                  step={30}
                  className="w-full"
                />
                <div className="text-sm text-muted-foreground text-center">
                  {localConfig.default_refresh_interval_seconds} seconds 
                  ({Math.round(localConfig.default_refresh_interval_seconds / 60)} minutes)
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Default cache time (minutes)</Label>
              <div className="space-y-2">
                <Slider
                  value={[localConfig.default_cache_time_minutes]}
                  onValueChange={([value]) => updateConfig({ default_cache_time_minutes: value })}
                  min={1}
                  max={60}
                  step={1}
                  className="w-full"
                  disabled={!localConfig.enable_widget_caching}
                />
                <div className="text-sm text-muted-foreground text-center">
                  {localConfig.default_cache_time_minutes} minutes
                </div>
              </div>
            </div>
          </div>

          {!localConfig.enable_widget_caching && (
            <Alert>
              <AlertDescription>
                Widget caching is disabled. Enable caching to improve performance for widgets that fetch external data.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Performance Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Performance Tips</CardTitle>
          <CardDescription>
            Optimize your dashboard for better performance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">Widget Optimization</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Enable caching for external API widgets</li>
                <li>• Use longer refresh intervals for static data</li>
                <li>• Limit the number of widgets per dashboard</li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Grid className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Layout Optimization</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Enable auto-save to prevent data loss</li>
                <li>• Use compact mode for more widgets</li>
                <li>• Disable animations on slower devices</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Configuration Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuration Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Layout mode:</span>
              <br />
              <span className="font-medium">
                {localConfig.enable_grid_snap ? 'Grid' : 'Free'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Auto-save:</span>
              <br />
              <span className="font-medium">
                {localConfig.auto_save_layout ? `${localConfig.auto_save_interval_seconds}s` : 'Disabled'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Refresh rate:</span>
              <br />
              <span className="font-medium">
                {Math.round(localConfig.default_refresh_interval_seconds / 60)}m
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Max widgets:</span>
              <br />
              <span className="font-medium">
                {localConfig.max_widgets_per_dashboard}
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