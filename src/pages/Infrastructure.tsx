import React, { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Server, Settings, Activity, Shield, Plus, Keyboard, HelpCircle } from "lucide-react";
import { ConfigurationEditor } from "@/features/infrastructure/components/ConfigurationEditor";
import { StackManager } from "@/features/infrastructure/components/StackManager";
import { SecretsManagementPage } from "@/features/infrastructure/components/SecretsManagementPage";
import { InfrastructureErrorBoundary } from "@/features/infrastructure/components/ErrorBoundary";
import { useErrorHandling } from "@/features/infrastructure/hooks/useErrorHandling";
import { useKeyboardShortcuts, createInfrastructureShortcuts } from "@/features/infrastructure/hooks/useKeyboardShortcuts";
import { useSecrets } from "@/features/infrastructure/hooks/useSecrets";
import { KeyboardShortcutsDialog } from "@/features/infrastructure/components/KeyboardShortcutsDialog";
import { HelpTooltip, HelpSection, HELP_CONTENT } from "@/features/infrastructure/components/HelpTooltips";
import { ResponsiveLayout, ResponsiveText, ResponsiveButtonGroup } from "@/features/infrastructure/components/ResponsiveLayout";
import { useScreenSize } from "@/features/infrastructure/utils/responsive";
import type { DockerComposeConfig } from "@/features/infrastructure/types";
import { ConfigurationsList } from "@/features/infrastructure/components/ConfigurationsList";

import { configsApi, type UpdateConfigPayload } from "@/features/infrastructure/services/configsApi";

const Infrastructure: React.FC = () => {
  const [showEditor, setShowEditor] = useState(false);
  const [editingConfig, setEditingConfig] = useState<DockerComposeConfig | undefined>();
  const [activeTab, setActiveTab] = useState("configurations");
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const { executeWithErrorHandling } = useErrorHandling();
  const { width } = useScreenSize();
  const isMobile = useMemo(() => width < 768, [width]);

  // Secrets management
  const {
    secrets,
    templates,
    loading: secretsLoading,
    createSecret,
    updateSecret,
    deleteSecret,
    importSecrets,
    exportSecrets,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    applyTemplate,
    previewInjection,
  } = useSecrets();

  const handleCreateNew = () => {
    setEditingConfig(undefined);
    setShowEditor(true);
  };

  const handleEditConfig = (config: DockerComposeConfig) => {
    setEditingConfig(config);
    setShowEditor(true);
  };

  const handleSaveConfig = async (config: Partial<DockerComposeConfig>) => {
    try {
      await executeWithErrorHandling(
        async () => {
          if (editingConfig?.id) {
            const payload = {
              // allow renaming and description edits
              name: config.name,
              description: config.description,
              compose_content: undefined as unknown as string, // replaced when metadata exists
              metadata: config.metadata,
            };
            // Build compose_content only if metadata provided
            if (config.metadata) {
              const built = configsApi.buildCreatePayload({
                name: config.name!,
                description: config.description,
                metadata: config.metadata,
              });
              payload.compose_content = built.compose_content;
            }
            const updated = await configsApi.update(editingConfig.id, payload as UpdateConfigPayload);
            return updated;
          }
          // Create new
          const created = await configsApi.create(
            configsApi.buildCreatePayload(config)
          );
          return created;
        },
        'Configuration saved successfully',
        {
          invalidateQueries: ['docker-configs'],
          onSuccess: () => {
            setShowEditor(false);
            setEditingConfig(undefined);
          }
        }
      );
    } catch (error) {
      // Error is already handled by executeWithErrorHandling
      console.error('Failed to save configuration:', error);
    }
  };

  const handleCancelEdit = () => {
    setShowEditor(false);
    setEditingConfig(undefined);
  };

  // Keyboard shortcuts
  const shortcuts = createInfrastructureShortcuts({
    onNewConfiguration: () => handleCreateNew(),
    onSaveConfiguration: showEditor ? () => {
      // This would be handled by the ConfigurationEditor component
      console.log('Save shortcut triggered');
    } : undefined,
    onValidateConfiguration: showEditor ? () => {
      // This would be handled by the ConfigurationEditor component
      console.log('Validate shortcut triggered');
    } : undefined,
    onRefreshStacks: () => {
      console.log('Refresh stacks shortcut triggered');
    },
    onToggleHelp: () => setShowKeyboardShortcuts(prev => !prev),
    onOpenSecrets: () => setActiveTab("secrets"),
    onOpenMonitoring: () => setActiveTab("monitoring"),
  });

  useKeyboardShortcuts({ shortcuts, enabled: !showEditor });

  if (showEditor) {
    return (
      <InfrastructureErrorBoundary>
        <ConfigurationEditor
          config={editingConfig}
          onSave={handleSaveConfig}
          onCancel={handleCancelEdit}
        />
      </InfrastructureErrorBoundary>
    );
  }

  return (
    <InfrastructureErrorBoundary>
      <ResponsiveLayout>
        {/* Page Header */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <ResponsiveText variant="h1">Infrastructure Manager</ResponsiveText>
              <ResponsiveText variant="body" className="text-muted-foreground">
                Manage your homelab Docker containers, configurations, and monitoring from one place.
              </ResponsiveText>
            </div>

            <ResponsiveButtonGroup className="flex-shrink-0">
              <HelpTooltip content="View keyboard shortcuts and help">
                <Button
                  variant="outline"
                  size={isMobile ? "sm" : "default"}
                  onClick={() => setShowKeyboardShortcuts(true)}
                  className="flex items-center gap-2"
                >
                  <Keyboard className="h-4 w-4" />
                  {!isMobile && "Shortcuts"}
                </Button>
              </HelpTooltip>

              <HelpTooltip content="Toggle help information">
                <Button
                  variant="outline"
                  size={isMobile ? "sm" : "default"}
                  onClick={() => setShowHelp(prev => !prev)}
                  className="flex items-center gap-2"
                >
                  <HelpCircle className="h-4 w-4" />
                  {!isMobile && "Help"}
                </Button>
              </HelpTooltip>
            </ResponsiveButtonGroup>
          </div>

          {/* Help Section */}
          {showHelp && (
            <HelpSection
              title="Infrastructure Management"
              description="This interface allows you to manage Docker containers, configurations, and monitoring for your homelab infrastructure."
              tips={[
                "Use keyboard shortcuts for faster navigation (press Shift+? to see all shortcuts)",
                "Always validate configurations before saving to catch syntax errors early",
                "Use the secrets manager to store sensitive configuration data securely",
                "Export your configurations regularly as backups"
              ]}
              warnings={[
                "This tool only manages docker-compose files - it does not deploy or connect to Docker",
                "Always backup your configurations before making major changes",
                "Be careful with volume mounts and file permissions in your configurations"
              ]}
            />
          )}
        </div>

        {/* Main Tabs Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="bg-muted rounded-md p-1 border border-border">
            <TabsList className={`w-full ${isMobile ? 'grid grid-cols-2' : 'flex flex-wrap h-auto min-h-[2.5rem]'}`}>
              <TabsTrigger value="configurations" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span className={isMobile ? "text-xs" : ""}>{isMobile ? "Config" : "Configurations"}</span>
              </TabsTrigger>
              <TabsTrigger value="stacks" className="flex items-center gap-2">
                <Server className="h-4 w-4" />
                <span className={isMobile ? "text-xs" : ""}>Stacks</span>
              </TabsTrigger>
              {!isMobile && (
                <>
                  <TabsTrigger value="monitoring" className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    <span>Monitoring</span>
                  </TabsTrigger>
                  <TabsTrigger value="secrets" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span>Secrets</span>
                  </TabsTrigger>

                </>
              )}
              {isMobile && (
                <TabsTrigger value="more" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="text-xs">More</span>
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          {/* Mobile More Tab */}
          {isMobile && (
            <TabsContent value="more" className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("monitoring")}
                  className="flex items-center justify-start gap-3 h-auto p-4"
                >
                  <Activity className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium">Monitoring</div>
                    <div className="text-sm text-muted-foreground">View container status and logs</div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("secrets")}
                  className="flex items-center justify-start gap-3 h-auto p-4"
                >
                  <Shield className="h-5 w-5" />
                  <div className="text-left">
                    <div className="font-medium">Secrets</div>
                    <div className="text-sm text-muted-foreground">Manage environment variables</div>
                  </div>
                </Button>
              </div>
            </TabsContent>
          )}

          {/* Configurations Tab */}
          <TabsContent value="configurations" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle>Docker Compose Configurations</CardTitle>
                      <HelpTooltip content={HELP_CONTENT.dockerCompose.description}>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </HelpTooltip>
                    </div>
                    <CardDescription>
                      Create and manage your Docker Compose files through a web interface.
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleCreateNew}
                    size={isMobile ? "sm" : "default"}
                    className="flex items-center gap-2 w-full sm:w-auto"
                  >
                    <Plus className="h-4 w-4" />
                    {isMobile ? "New" : "New Configuration"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ConfigurationsList onEdit={handleEditConfig} />
              </CardContent>
            </Card>

            {showHelp && (
              <HelpSection
                title="Docker Compose Configurations"
                description={HELP_CONTENT.dockerCompose.description}
                tips={HELP_CONTENT.dockerCompose.tips}
                warnings={HELP_CONTENT.dockerCompose.warnings}
              />
            )}
          </TabsContent>

          {/* Stacks Tab */}
          <TabsContent value="stacks" className="space-y-4">
            <InfrastructureErrorBoundary>
              <StackManager
                configs={[]} // Stack management disabled - this tool only manages docker-compose files
                onRefresh={() => {
                  // Stack management disabled - this tool only manages docker-compose files
                  console.log('Stack management is disabled in this version');
                }}
              />
            </InfrastructureErrorBoundary>

            {showHelp && (
              <HelpSection
                title="File Management"
                description={HELP_CONTENT.fileManagement.description}
                tips={HELP_CONTENT.fileManagement.tips}
                warnings={HELP_CONTENT.fileManagement.warnings}
              />
            )}
          </TabsContent>

          {/* Monitoring Tab */}
          <TabsContent value="monitoring" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>Container Monitoring</CardTitle>
                  <HelpTooltip content="Monitor container status, logs, and resource usage in real-time">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </HelpTooltip>
                </div>
                <CardDescription>
                  Monitor container status, logs, and resource usage in real-time.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <ResponsiveText variant="h3" className="mb-2">Monitoring Dashboard Coming Soon</ResponsiveText>
                  <ResponsiveText variant="body">
                    Real-time monitoring of your containers with logs and resource metrics.
                  </ResponsiveText>
                </div>
              </CardContent>
            </Card>
          </TabsContent>



          {/* Secrets Tab */}
          <TabsContent value="secrets" className="space-y-4">
            <InfrastructureErrorBoundary>
              <SecretsManagementPage
                secrets={secrets}
                onCreateSecret={createSecret}
                onUpdateSecret={updateSecret}
                onDeleteSecret={deleteSecret}
                onImportSecrets={importSecrets}
                onExportSecrets={exportSecrets}
                templates={templates}
                onCreateTemplate={createTemplate}
                onUpdateTemplate={updateTemplate}
                onDeleteTemplate={deleteTemplate}
                onApplyTemplate={applyTemplate}
                onPreviewInjection={previewInjection}
                currentComposeContent=""
                loading={secretsLoading}
              />
            </InfrastructureErrorBoundary>

            {showHelp && (
              <HelpSection
                title="Secrets Management"
                description={HELP_CONTENT.secrets.description}
                tips={HELP_CONTENT.secrets.tips}
                warnings={HELP_CONTENT.secrets.warnings}
              />
            )}
          </TabsContent>
        </Tabs>

        {/* Keyboard Shortcuts Dialog */}
        <KeyboardShortcutsDialog
          open={showKeyboardShortcuts}
          onOpenChange={setShowKeyboardShortcuts}
          shortcuts={shortcuts}
        />
      </ResponsiveLayout>
    </InfrastructureErrorBoundary>
  );
};

export default Infrastructure;