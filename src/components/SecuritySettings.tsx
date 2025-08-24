import React, { useState, useEffect } from 'react';
import { Shield, Lock, Key, Database, AlertTriangle, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/use-toast';
import { SecurityConfig, DEFAULT_SECURITY_CONFIG } from '@/types/systemSettings';

interface SecuritySettingsProps {
  onUnsavedChanges?: (hasChanges: boolean) => void;
}

export function SecuritySettings({ onUnsavedChanges }: SecuritySettingsProps) {
  const { securityConfig, setSecurityConfig } = useSettings();
  const { toast } = useToast();
  const [localConfig, setLocalConfig] = useState<SecurityConfig>(securityConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Sync local config with global config
  useEffect(() => {
    setLocalConfig(securityConfig);
    setIsDirty(false);
  }, [securityConfig]);

  // Notify parent of unsaved changes
  useEffect(() => {
    onUnsavedChanges?.(isDirty);
  }, [isDirty, onUnsavedChanges]);

  const updateConfig = (updates: Partial<SecurityConfig>) => {
    setLocalConfig(prev => ({ ...prev, ...updates }));
    setIsDirty(true);
  };

  const updatePasswordRequirements = (updates: Partial<SecurityConfig['password_requirements']>) => {
    setLocalConfig(prev => ({
      ...prev,
      password_requirements: { ...prev.password_requirements, ...updates }
    }));
    setIsDirty(true);
  };

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      const success = await setSecurityConfig(localConfig);
      if (success) {
        setIsDirty(false);
        toast({
          title: 'Settings Saved',
          description: 'Security configuration has been updated successfully'
        });
      } else {
        toast({
          title: 'Save Failed',
          description: 'Failed to save security configuration',
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
    setLocalConfig(DEFAULT_SECURITY_CONFIG);
    setIsDirty(true);
  };

  const getPasswordStrengthIndicator = () => {
    const requirements = localConfig.password_requirements;
    let strength = 0;
    
    if (requirements.min_length >= 12) strength++;
    if (requirements.require_uppercase) strength++;
    if (requirements.require_lowercase) strength++;
    if (requirements.require_numbers) strength++;
    if (requirements.require_symbols) strength++;

    return {
      score: strength,
      level: strength <= 2 ? 'Weak' : strength <= 3 ? 'Medium' : strength <= 4 ? 'Strong' : 'Very Strong',
      color: strength <= 2 ? 'text-red-500' : strength <= 3 ? 'text-yellow-500' : strength <= 4 ? 'text-blue-500' : 'text-green-500'
    };
  };

  const strengthIndicator = getPasswordStrengthIndicator();

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-medium">Security & Vault Configuration</span>
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

      {/* Vault Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vault Security</CardTitle>
          <CardDescription>
            Configure vault access and session management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="requireMasterPassword">Master password confirmation</Label>
                <p className="text-sm text-muted-foreground">
                  Require master password for sensitive operations
                </p>
              </div>
              <Switch
                id="requireMasterPassword"
                checked={localConfig.require_master_password_confirmation}
                onCheckedChange={(checked) => updateConfig({ require_master_password_confirmation: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="autoLockOnIdle">Auto-lock on idle</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically lock vault after idle period
                </p>
              </div>
              <Switch
                id="autoLockOnIdle"
                checked={localConfig.auto_lock_on_idle}
                onCheckedChange={(checked) => updateConfig({ auto_lock_on_idle: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="require2FA">Two-factor authentication</Label>
                <p className="text-sm text-muted-foreground">
                  Require 2FA for vault access
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="require2FA"
                  checked={localConfig.require_2fa}
                  onCheckedChange={(checked) => updateConfig({ require_2fa: checked })}
                />
                <Badge variant="outline" className="text-xs">Coming Soon</Badge>
              </div>
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="encryptLocalStorage">Encrypt local storage</Label>
                <p className="text-sm text-muted-foreground">
                  Encrypt sensitive data in browser storage
                </p>
              </div>
              <Switch
                id="encryptLocalStorage"
                checked={localConfig.encrypt_local_storage}
                onCheckedChange={(checked) => updateConfig({ encrypt_local_storage: checked })}
              />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vault session timeout (minutes)</Label>
              <div className="space-y-2">
                <Slider
                  value={[localConfig.vault_session_timeout_minutes]}
                  onValueChange={([value]) => updateConfig({ vault_session_timeout_minutes: value })}
                  min={15}
                  max={480}
                  step={15}
                  className="w-full"
                />
                <div className="text-sm text-muted-foreground text-center">
                  {localConfig.vault_session_timeout_minutes} minutes 
                  ({Math.round(localConfig.vault_session_timeout_minutes / 60)} hours)
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Idle timeout (minutes)</Label>
              <div className="space-y-2">
                <Slider
                  value={[localConfig.idle_timeout_minutes]}
                  onValueChange={([value]) => updateConfig({ idle_timeout_minutes: value })}
                  min={5}
                  max={120}
                  step={5}
                  className="w-full"
                  disabled={!localConfig.auto_lock_on_idle}
                />
                <div className="text-sm text-muted-foreground text-center">
                  {localConfig.idle_timeout_minutes} minutes
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Password Requirements</CardTitle>
          <CardDescription>
            Set password complexity requirements for vault access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Minimum password length</Label>
              <div className="space-y-2">
                <Slider
                  value={[localConfig.password_requirements.min_length]}
                  onValueChange={([value]) => updatePasswordRequirements({ min_length: value })}
                  min={8}
                  max={32}
                  step={1}
                  className="w-full"
                />
                <div className="text-sm text-muted-foreground text-center">
                  {localConfig.password_requirements.min_length} characters
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label>Password Strength</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={strengthIndicator.color}>
                  {strengthIndicator.level}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {strengthIndicator.score}/5 requirements met
                </span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="requireUppercase">Require uppercase letters</Label>
                <p className="text-sm text-muted-foreground">A-Z</p>
              </div>
              <Switch
                id="requireUppercase"
                checked={localConfig.password_requirements.require_uppercase}
                onCheckedChange={(checked) => updatePasswordRequirements({ require_uppercase: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="requireLowercase">Require lowercase letters</Label>
                <p className="text-sm text-muted-foreground">a-z</p>
              </div>
              <Switch
                id="requireLowercase"
                checked={localConfig.password_requirements.require_lowercase}
                onCheckedChange={(checked) => updatePasswordRequirements({ require_lowercase: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="requireNumbers">Require numbers</Label>
                <p className="text-sm text-muted-foreground">0-9</p>
              </div>
              <Switch
                id="requireNumbers"
                checked={localConfig.password_requirements.require_numbers}
                onCheckedChange={(checked) => updatePasswordRequirements({ require_numbers: checked })}
              />
            </div>

            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-1">
                <Label htmlFor="requireSymbols">Require symbols</Label>
                <p className="text-sm text-muted-foreground">!@#$%^&*</p>
              </div>
              <Switch
                id="requireSymbols"
                checked={localConfig.password_requirements.require_symbols}
                onCheckedChange={(checked) => updatePasswordRequirements({ require_symbols: checked })}
              />
            </div>
          </div>

          <Alert>
            <Key className="h-4 w-4" />
            <AlertDescription>
              Password requirements apply to new passwords and password changes. 
              Existing passwords remain valid until changed.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Backup & Recovery */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Backup & Recovery</CardTitle>
          <CardDescription>
            Configure automatic backup and data retention settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Backup frequency (days)</Label>
              <div className="space-y-2">
                <Slider
                  value={[localConfig.backup_frequency_days]}
                  onValueChange={([value]) => updateConfig({ backup_frequency_days: value })}
                  min={1}
                  max={30}
                  step={1}
                  className="w-full"
                />
                <div className="text-sm text-muted-foreground text-center">
                  Every {localConfig.backup_frequency_days} day{localConfig.backup_frequency_days !== 1 ? 's' : ''}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxBackupCount">Max backup count</Label>
              <Input
                id="maxBackupCount"
                type="number"
                min="5"
                max="100"
                value={localConfig.max_backup_count}
                onChange={(e) => updateConfig({ max_backup_count: parseInt(e.target.value) || 10 })}
              />
            </div>
          </div>

          <Alert>
            <Database className="h-4 w-4" />
            <AlertDescription>
              Backups are stored locally and include all vault data except for API keys and sensitive credentials.
              Regular backups help protect against data loss.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Security Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Security Recommendations</CardTitle>
          <CardDescription>
            Best practices for securing your Ever Life Vault
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Password Security</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Use a unique, strong master password</li>
                <li>• Enable all password complexity requirements</li>
                <li>• Consider using a password manager</li>
                <li>• Change passwords regularly</li>
              </ul>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Vault Protection</span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Enable auto-lock with short idle timeout</li>
                <li>• Require master password confirmation</li>
                <li>• Keep regular backups</li>
                <li>• Enable local storage encryption</li>
              </ul>
            </div>
          </div>

          <Separator />

          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">Important Security Notes</p>
              <ul className="text-amber-700 dark:text-amber-300 mt-1 space-y-1">
                <li>• Always log out when using shared devices</li>
                <li>• Never share your master password with others</li>
                <li>• Keep your browser and device updated</li>
                <li>• Be cautious when using public Wi-Fi</li>
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
              <span className="text-muted-foreground">Session timeout:</span>
              <br />
              <span className="font-medium">
                {Math.round(localConfig.vault_session_timeout_minutes / 60)}h
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Password strength:</span>
              <br />
              <span className={`font-medium ${strengthIndicator.color}`}>
                {strengthIndicator.level}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Backup frequency:</span>
              <br />
              <span className="font-medium">
                {localConfig.backup_frequency_days}d
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Auto-lock:</span>
              <br />
              <span className="font-medium">
                {localConfig.auto_lock_on_idle ? `${localConfig.idle_timeout_minutes}m` : 'Disabled'}
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