import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Brain, 
  Layout, 
  Bell, 
  Save, 
  RotateCcw, 
  Download, 
  Upload,
  AlertCircle,
  CheckCircle,
  Loader2,
  Timer,
  Plug,
  Shield
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/use-toast';
import { SYSTEM_SETTINGS_FEATURES } from '@/types/systemSettings';

// Import feature-specific settings components
import { ReceiptAISettings } from '@/components/ReceiptAISettings';
import { FocusTimerSettings } from '@/components/FocusTimerSettings';
import { DashboardSettings } from '@/components/DashboardSettings';
import { NotificationsUISettings } from '@/components/NotificationsUISettings';
import { IntegrationSettings } from '@/components/IntegrationSettings';
import { SecuritySettings } from '@/components/SecuritySettings';

interface SettingsPageProps {
  defaultTab?: string;
}

export default function Settings({ defaultTab = 'receipt_ai' }: SettingsPageProps) {
  const { systemSettingsService } = useSettings();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Set page title
  useEffect(() => {
    document.title = 'Settings - Ever Life Vault';
  }, []);

  // Track unsaved changes across tabs
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Export settings
  const handleExportSettings = async () => {
    if (!systemSettingsService) {
      toast({
        title: 'Export Failed',
        description: 'Settings service not available',
        variant: 'destructive'
      });
      return;
    }

    setIsExporting(true);
    try {
      const settings = await systemSettingsService.exportSettings();
      
      const dataStr = JSON.stringify(settings, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(dataBlob);
      link.download = `ever-life-vault-settings-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      
      toast({
        title: 'Settings Exported',
        description: 'Your settings have been exported successfully'
      });
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Failed to export settings',
        variant: 'destructive'
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Import settings
  const handleImportSettings = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !systemSettingsService) return;

      setIsImporting(true);
      try {
        const text = await file.text();
        const settings = JSON.parse(text);
        
        const result = await systemSettingsService.importSettings(settings);
        
        if (result.success) {
          toast({
            title: 'Settings Imported',
            description: 'Your settings have been imported successfully'
          });
          
          // Refresh the page to load new settings
          window.location.reload();
        } else {
          toast({
            title: 'Import Failed',
            description: result.error || 'Failed to import settings',
            variant: 'destructive'
          });
        }
      } catch (error) {
        toast({
          title: 'Import Error',
          description: error instanceof Error ? error.message : 'Invalid settings file',
          variant: 'destructive'
        });
      } finally {
        setIsImporting(false);
      }
    };
    
    input.click();
  };

  // Reset all settings for current tab
  const handleResetFeature = async (featureCategory: string) => {
    if (!systemSettingsService) {
      toast({
        title: 'Reset Failed',
        description: 'Settings service not available',
        variant: 'destructive'
      });
      return;
    }

    try {
      const result = await systemSettingsService.resetFeatureSettings(featureCategory);
      
      if (result.success) {
        toast({
          title: 'Settings Reset',
          description: `${getFeatureName(featureCategory)} settings have been reset to defaults`
        });
        
        // Refresh to show updated settings
        window.location.reload();
      } else {
        toast({
          title: 'Reset Failed',
          description: result.error || 'Failed to reset settings',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Reset Error',
        description: error instanceof Error ? error.message : 'Failed to reset settings',
        variant: 'destructive'
      });
    }
  };

  // Get feature name for display
  const getFeatureName = (category: string): string => {
    const feature = SYSTEM_SETTINGS_FEATURES.find(f => f.category === category);
    return feature?.name || category;
  };

  // Get feature icon component
  const getFeatureIcon = (category: string) => {
    switch (category) {
      case 'receipt_ai':
        return Brain;
      case 'focus_timer':
        return Timer;
      case 'dashboard':
        return Layout;
      case 'notifications':
        return Bell;
      case 'integrations':
        return Plug;
      case 'security':
        return Shield;
      default:
        return SettingsIcon;
    }
  };

  // Service availability check
  if (!systemSettingsService) {
    return (
      <div className="container mx-auto px-4 py-8">
        
        <PageHeader 
          title="Settings" 
          description="Configure your application preferences and features"
          icon={SettingsIcon}
        />
        
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Settings service is not available. Please make sure you are logged in.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      
      <PageHeader 
        title="Settings" 
        description="Configure your application preferences and features"
        icon={SettingsIcon}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSettings}
            disabled={isExporting}
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Export
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportSettings}
            disabled={isImporting}
          >
            {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import
          </Button>
        </div>
      </PageHeader>

      {hasUnsavedChanges && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. Make sure to save your settings before leaving this page.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full gap-1" style={{
          gridTemplateColumns: `repeat(${SYSTEM_SETTINGS_FEATURES.length}, 1fr)`
        }}>
          {SYSTEM_SETTINGS_FEATURES.map((feature) => {
            const IconComponent = getFeatureIcon(feature.category);
            return (
              <TabsTrigger 
                key={feature.category} 
                value={feature.category}
                className="flex items-center gap-2"
              >
                <IconComponent className="h-4 w-4" />
                {feature.name}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {SYSTEM_SETTINGS_FEATURES.map((feature) => {
          const IconComponent = getFeatureIcon(feature.category);
          
          return (
            <TabsContent key={feature.category} value={feature.category} className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <IconComponent className="h-6 w-6 text-primary" />
                      <div>
                        <CardTitle>{feature.name}</CardTitle>
                        <CardDescription>{feature.description}</CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResetFeature(feature.category)}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset to Defaults
                    </Button>
                  </div>
                </CardHeader>
                
                <Separator />
                
                <CardContent className="pt-6">
                  {feature.category === 'receipt_ai' && (
                    <ReceiptAISettings onUnsavedChanges={setHasUnsavedChanges} />
                  )}
                  
                  {feature.category === 'focus_timer' && (
                    <FocusTimerSettings onUnsavedChanges={setHasUnsavedChanges} />
                  )}
                  
                  {feature.category === 'dashboard' && (
                    <DashboardSettings onUnsavedChanges={setHasUnsavedChanges} />
                  )}
                  
                  {feature.category === 'notifications' && (
                    <NotificationsUISettings onUnsavedChanges={setHasUnsavedChanges} />
                  )}
                  
                  {feature.category === 'integrations' && (
                    <IntegrationSettings onUnsavedChanges={setHasUnsavedChanges} />
                  )}
                  
                  {feature.category === 'security' && (
                    <SecuritySettings onUnsavedChanges={setHasUnsavedChanges} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Settings Information</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• Settings are automatically synced across your devices</p>
          <p>• Sensitive information like API keys are encrypted</p>
          <p>• You can export your settings for backup purposes</p>
          <p>• Changes take effect immediately after saving</p>
        </CardContent>
      </Card>
    </div>
  );
}