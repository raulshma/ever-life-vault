import React, { useState, useEffect } from 'react';
import { Bell, Palette, Volume2, VolumeX, Eye, EyeOff, Save, RotateCcw, Monitor, Sun, Moon, Smartphone } from 'lucide-react';
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
import { NotificationConfig, UIConfig, DEFAULT_NOTIFICATION_CONFIG, DEFAULT_UI_CONFIG } from '@/types/systemSettings';

interface NotificationsUISettingsProps {
  onUnsavedChanges?: (hasChanges: boolean) => void;
}

export function NotificationsUISettings({ onUnsavedChanges }: NotificationsUISettingsProps) {
  const { notificationConfig, setNotificationConfig, uiConfig, setUIConfig, themeMode, setThemeMode } = useSettings();
  const { toast } = useToast();
  const [localNotificationConfig, setLocalNotificationConfig] = useState<NotificationConfig>(notificationConfig);
  const [localUIConfig, setLocalUIConfig] = useState<UIConfig>(uiConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Sync local configs with global configs
  useEffect(() => {
    setLocalNotificationConfig(notificationConfig);
    setLocalUIConfig(uiConfig);
    setIsDirty(false);
  }, [notificationConfig, uiConfig]);

  // Notify parent of unsaved changes
  useEffect(() => {
    onUnsavedChanges?.(isDirty);
  }, [isDirty, onUnsavedChanges]);

  const updateNotificationConfig = (updates: Partial<NotificationConfig>) => {
    setLocalNotificationConfig(prev => ({ ...prev, ...updates }));
    setIsDirty(true);
  };

  const updateUIConfig = (updates: Partial<UIConfig>) => {
    setLocalUIConfig(prev => ({ ...prev, ...updates }));
    setIsDirty(true);
  };

  const saveConfigs = async () => {
    setIsSaving(true);
    try {
      const [notificationSuccess, uiSuccess] = await Promise.all([
        setNotificationConfig(localNotificationConfig),
        setUIConfig(localUIConfig)
      ]);

      if (notificationSuccess && uiSuccess) {
        setIsDirty(false);
        
        // Apply theme changes immediately
        if (localUIConfig.theme_mode !== themeMode) {
          setThemeMode(localUIConfig.theme_mode);
        }
        
        toast({
          title: 'Settings Saved',
          description: 'Notification and UI configuration has been updated successfully'
        });
      } else {
        toast({
          title: 'Save Failed',
          description: 'Failed to save some configuration settings',
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

  const resetConfigs = () => {
    setLocalNotificationConfig(DEFAULT_NOTIFICATION_CONFIG);
    setLocalUIConfig(DEFAULT_UI_CONFIG);
    setIsDirty(true);
  };

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          <span className="font-medium">Notifications & UI Configuration</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={resetConfigs} disabled={isSaving}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={saveConfigs} disabled={!isDirty || isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Configure when and how you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="receiptAnalysisComplete">Receipt analysis complete</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when AI receipt analysis finishes
                </p>
              </div>
              <Switch
                id="receiptAnalysisComplete"
                checked={localNotificationConfig.receipt_analysis_complete}
                onCheckedChange={(checked) => updateNotificationConfig({ receipt_analysis_complete: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="budgetAlerts">Budget alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when approaching budget limits
                </p>
              </div>
              <Switch
                id="budgetAlerts"
                checked={localNotificationConfig.budget_alerts}
                onCheckedChange={(checked) => updateNotificationConfig({ budget_alerts: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="integrationErrors">Integration errors</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when external service errors occur
                </p>
              </div>
              <Switch
                id="integrationErrors"
                checked={localNotificationConfig.integration_errors}
                onCheckedChange={(checked) => updateNotificationConfig({ integration_errors: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="systemUpdates">System updates</Label>
                <p className="text-sm text-muted-foreground">
                  Notify about application updates
                </p>
              </div>
              <Switch
                id="systemUpdates"
                checked={localNotificationConfig.system_updates}
                onCheckedChange={(checked) => updateNotificationConfig({ system_updates: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="focusSessionComplete">Focus session complete</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when focus timer sessions end
                </p>
              </div>
              <Switch
                id="focusSessionComplete"
                checked={localNotificationConfig.focus_session_complete}
                onCheckedChange={(checked) => updateNotificationConfig({ focus_session_complete: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="dailyGoalAchieved">Daily goal achieved</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when daily focus goals are met
                </p>
              </div>
              <Switch
                id="dailyGoalAchieved"
                checked={localNotificationConfig.daily_goal_achieved}
                onCheckedChange={(checked) => updateNotificationConfig({ daily_goal_achieved: checked })}
              />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="enableSoundNotifications">Sound notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Play audio for important notifications
                </p>
              </div>
              <Switch
                id="enableSoundNotifications"
                checked={localNotificationConfig.enable_sound_notifications}
                onCheckedChange={(checked) => updateNotificationConfig({ enable_sound_notifications: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="enableBrowserNotifications">Browser notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Show system notifications in browser
                </p>
              </div>
              <Switch
                id="enableBrowserNotifications"
                checked={localNotificationConfig.enable_browser_notifications}
                onCheckedChange={(checked) => updateNotificationConfig({ enable_browser_notifications: checked })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Toast duration (seconds)</Label>
            <div className="space-y-2">
              <Slider
                value={[localNotificationConfig.toast_duration_seconds]}
                onValueChange={([value]) => updateNotificationConfig({ toast_duration_seconds: value })}
                min={2}
                max={15}
                step={1}
                className="w-full"
              />
              <div className="text-sm text-muted-foreground text-center">
                {localNotificationConfig.toast_duration_seconds} seconds
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* UI & Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="h-5 w-5" />
            UI & Theme Preferences
          </CardTitle>
          <CardDescription>
            Customize the user interface appearance and behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="themeMode">Theme mode</Label>
              <Select
                value={localUIConfig.theme_mode}
                onValueChange={(value: 'light' | 'dark' | 'amoled' | 'system') => {
                  updateUIConfig({ theme_mode: value });
                  // Apply theme immediately for preview
                  setThemeMode(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4" />
                      Light
                    </div>
                  </SelectItem>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      Dark
                    </div>
                  </SelectItem>
                  <SelectItem value="amoled">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      AMOLED
                    </div>
                  </SelectItem>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      System
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="viewTransitionsEnabled">View transitions</Label>
                <p className="text-sm text-muted-foreground">
                  Enable smooth page transitions
                </p>
              </div>
              <Switch
                id="viewTransitionsEnabled"
                checked={localUIConfig.view_transitions_enabled}
                onCheckedChange={(checked) => updateUIConfig({ view_transitions_enabled: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="autoCategorizeSidebar">Auto-categorize sidebar</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically organize navigation items
                </p>
              </div>
              <Switch
                id="autoCategorizeSidebar"
                checked={localUIConfig.auto_categorize_sidebar}
                onCheckedChange={(checked) => updateUIConfig({ auto_categorize_sidebar: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="reduceMotion">Reduce motion</Label>
                <p className="text-sm text-muted-foreground">
                  Reduce animations for accessibility
                </p>
              </div>
              <Switch
                id="reduceMotion"
                checked={localUIConfig.reduce_motion}
                onCheckedChange={(checked) => updateUIConfig({ reduce_motion: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="highContrast">High contrast</Label>
                <p className="text-sm text-muted-foreground">
                  Increase contrast for better visibility
                </p>
              </div>
              <Switch
                id="highContrast"
                checked={localUIConfig.high_contrast}
                onCheckedChange={(checked) => updateUIConfig({ high_contrast: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="compactUI">Compact UI</Label>
                <p className="text-sm text-muted-foreground">
                  Use smaller spacing and compact layouts
                </p>
              </div>
              <Switch
                id="compactUI"
                checked={localUIConfig.compact_ui}
                onCheckedChange={(checked) => updateUIConfig({ compact_ui: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="sidebarCollapsedByDefault">Collapse sidebar by default</Label>
                <p className="text-sm text-muted-foreground">
                  Start with collapsed navigation sidebar
                </p>
              </div>
              <Switch
                id="sidebarCollapsedByDefault"
                checked={localUIConfig.sidebar_collapsed_by_default}
                onCheckedChange={(checked) => updateUIConfig({ sidebar_collapsed_by_default: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accessibility Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Accessibility
          </CardTitle>
          <CardDescription>
            Settings to improve accessibility and usability
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>• <strong>Reduce motion:</strong> Minimizes animations for users with vestibular disorders</p>
            <p>• <strong>High contrast:</strong> Improves visibility for users with visual impairments</p>
            <p>• <strong>Compact UI:</strong> Better for users who prefer dense information layouts</p>
            <p>• <strong>Browser notifications:</strong> Requires permission from your browser</p>
          </div>
          <Alert>
            <AlertDescription>
              Make sure to allow notifications in your browser settings for the best experience.
            </AlertDescription>
          </Alert>
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