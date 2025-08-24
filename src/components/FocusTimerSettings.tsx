import React, { useState, useEffect } from 'react';
import { Timer, Play, Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/use-toast';
import { FocusTimerConfig, FocusMode, DEFAULT_FOCUS_TIMER_CONFIG } from '@/types/systemSettings';

interface FocusTimerSettingsProps {
  onUnsavedChanges?: (hasChanges: boolean) => void;
}

const FOCUS_MODES: Array<{ value: FocusMode; label: string; description: string }> = [
  { value: 'pomodoro_25_5', label: 'Pomodoro 25/5', description: '25 min focus, 5 min break' },
  { value: 'pomodoro_30_5', label: 'Pomodoro 30/5', description: '30 min focus, 5 min break' },
  { value: 'pomodoro_45_15', label: 'Pomodoro 45/15', description: '45 min focus, 15 min break' },
  { value: 'pomodoro_50_10', label: 'Pomodoro 50/10', description: '50 min focus, 10 min break' },
  { value: 'pomodoro_60_15', label: 'Pomodoro 60/15', description: '60 min focus, 15 min break' },
  { value: 'fiftytwo_17', label: '52-17 Method', description: '52 min focus, 17 min break' },
  { value: 'flow_90', label: 'Flow State 90', description: '90 min deep focus' },
  { value: 'flow_120_15', label: 'Flow State 120/15', description: '120 min focus, 15 min break' },
  { value: 'ultradian_90_20', label: 'Ultradian 90/20', description: '90 min focus, 20 min break' },
  { value: 'custom', label: 'Custom', description: 'Set your own timing' }
];

export function FocusTimerSettings({ onUnsavedChanges }: FocusTimerSettingsProps) {
  const { focusTimerConfig, setFocusTimerConfig } = useSettings();
  const { toast } = useToast();
  const [localConfig, setLocalConfig] = useState<FocusTimerConfig>(focusTimerConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Sync local config with global config
  useEffect(() => {
    setLocalConfig(focusTimerConfig);
    setIsDirty(false);
  }, [focusTimerConfig]);

  // Notify parent of unsaved changes
  useEffect(() => {
    onUnsavedChanges?.(isDirty);
  }, [isDirty, onUnsavedChanges]);

  const updateConfig = (updates: Partial<FocusTimerConfig>) => {
    setLocalConfig(prev => ({ ...prev, ...updates }));
    setIsDirty(true);
  };

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      const success = await setFocusTimerConfig(localConfig);
      if (success) {
        setIsDirty(false);
        toast({
          title: 'Settings Saved',
          description: 'Focus timer configuration has been updated successfully'
        });
      } else {
        toast({
          title: 'Save Failed',
          description: 'Failed to save focus timer configuration',
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
    setLocalConfig(DEFAULT_FOCUS_TIMER_CONFIG);
    setIsDirty(true);
  };

  const addCustomProfile = () => {
    const newProfile = {
      id: `custom_${Date.now()}`,
      name: 'New Profile',
      bpm: 120,
      accentEvery: 4,
      subdivisions: 1
    };
    updateConfig({
      preferred_profiles: [...localConfig.preferred_profiles, newProfile]
    });
  };

  const updateProfile = (index: number, updates: Partial<typeof localConfig.preferred_profiles[0]>) => {
    const newProfiles = [...localConfig.preferred_profiles];
    newProfiles[index] = { ...newProfiles[index], ...updates };
    updateConfig({ preferred_profiles: newProfiles });
  };

  const removeProfile = (index: number) => {
    const newProfiles = localConfig.preferred_profiles.filter((_, i) => i !== index);
    updateConfig({ preferred_profiles: newProfiles });
  };

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-primary" />
          <span className="font-medium">Focus Timer Configuration</span>
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

      {/* Default Timer Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Default Timer Settings</CardTitle>
          <CardDescription>
            Configure your default timer mode and durations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="defaultMode">Default Focus Mode</Label>
              <Select
                value={localConfig.default_mode}
                onValueChange={(value: FocusMode) => updateConfig({ default_mode: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select focus mode" />
                </SelectTrigger>
                <SelectContent>
                  {FOCUS_MODES.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      <div>
                        <div className="font-medium">{mode.label}</div>
                        <div className="text-xs text-muted-foreground">{mode.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dailyGoal">Daily Goal (minutes)</Label>
              <Input
                id="dailyGoal"
                type="number"
                min="30"
                max="480"
                value={localConfig.daily_goal_minutes}
                onChange={(e) => updateConfig({ daily_goal_minutes: parseInt(e.target.value) || 120 })}
              />
            </div>
          </div>

          {localConfig.default_mode === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
              <div className="space-y-2">
                <Label htmlFor="focusMinutes">Focus Duration (minutes)</Label>
                <Input
                  id="focusMinutes"
                  type="number"
                  min="5"
                  max="180"
                  value={localConfig.default_focus_minutes}
                  onChange={(e) => updateConfig({ default_focus_minutes: parseInt(e.target.value) || 25 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="breakMinutes">Break Duration (minutes)</Label>
                <Input
                  id="breakMinutes"
                  type="number"
                  min="1"
                  max="60"
                  value={localConfig.default_break_minutes}
                  onChange={(e) => updateConfig({ default_break_minutes: parseInt(e.target.value) || 5 })}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Metronome Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Metronome Settings</CardTitle>
          <CardDescription>
            Configure the built-in metronome for focus sessions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Default BPM</Label>
              <div className="space-y-2">
                <Slider
                  value={[localConfig.default_bpm]}
                  onValueChange={([value]) => updateConfig({ default_bpm: value })}
                  min={60}
                  max={180}
                  step={5}
                  className="w-full"
                />
                <div className="text-sm text-muted-foreground text-center">
                  {localConfig.default_bpm} BPM
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accentEvery">Accent Every</Label>
              <Input
                id="accentEvery"
                type="number"
                min="2"
                max="8"
                value={localConfig.default_accent_every}
                onChange={(e) => updateConfig({ default_accent_every: parseInt(e.target.value) || 4 })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subdivisions">Subdivisions</Label>
              <Input
                id="subdivisions"
                type="number"
                min="1"
                max="4"
                value={localConfig.default_subdivisions}
                onChange={(e) => updateConfig({ default_subdivisions: parseInt(e.target.value) || 1 })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session Behavior */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Session Behavior</CardTitle>
          <CardDescription>
            Configure how focus sessions behave automatically
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="autoStartBreaks">Auto-start breaks</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically start break timers after focus sessions
                </p>
              </div>
              <Switch
                id="autoStartBreaks"
                checked={localConfig.auto_start_breaks}
                onCheckedChange={(checked) => updateConfig({ auto_start_breaks: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="autoStartFocus">Auto-start focus</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically start focus sessions after breaks
                </p>
              </div>
              <Switch
                id="autoStartFocus"
                checked={localConfig.auto_start_focus}
                onCheckedChange={(checked) => updateConfig({ auto_start_focus: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="trackSessions">Track sessions</Label>
                <p className="text-sm text-muted-foreground">
                  Save focus session data for analytics
                </p>
              </div>
              <Switch
                id="trackSessions"
                checked={localConfig.track_sessions}
                onCheckedChange={(checked) => updateConfig({ track_sessions: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="muteByDefault">Mute by default</Label>
                <p className="text-sm text-muted-foreground">
                  Start timers with audio muted
                </p>
              </div>
              <Switch
                id="muteByDefault"
                checked={localConfig.mute_by_default}
                onCheckedChange={(checked) => updateConfig({ mute_by_default: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notifications</CardTitle>
          <CardDescription>
            Configure how you're notified about focus sessions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-1">
              <Label htmlFor="notificationSound">Notification sounds</Label>
              <p className="text-sm text-muted-foreground">
                Play audio notifications when sessions complete
              </p>
            </div>
            <Switch
              id="notificationSound"
              checked={localConfig.notification_sound}
              onCheckedChange={(checked) => updateConfig({ notification_sound: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Metronome Profiles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Metronome Profiles</CardTitle>
          <CardDescription>
            Create custom metronome profiles for different focus styles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {localConfig.preferred_profiles.map((profile, index) => (
              <div key={profile.id} className="flex items-center gap-4 p-4 border rounded-lg">
                <Input
                  value={profile.name}
                  onChange={(e) => updateProfile(index, { name: e.target.value })}
                  placeholder="Profile name"
                  className="flex-1"
                />
                <div className="flex items-center gap-2">
                  <Label className="text-xs">BPM:</Label>
                  <Input
                    type="number"
                    min="60"
                    max="180"
                    value={profile.bpm}
                    onChange={(e) => updateProfile(index, { bpm: parseInt(e.target.value) || 120 })}
                    className="w-20"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Accent:</Label>
                  <Input
                    type="number"
                    min="2"
                    max="8"
                    value={profile.accentEvery}
                    onChange={(e) => updateProfile(index, { accentEvery: parseInt(e.target.value) || 4 })}
                    className="w-16"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeProfile(index)}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
          
          <Button variant="outline" onClick={addCustomProfile} className="w-full">
            <Play className="h-4 w-4 mr-2" />
            Add Custom Profile
          </Button>
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