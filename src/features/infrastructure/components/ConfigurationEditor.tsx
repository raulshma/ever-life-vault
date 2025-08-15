import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Save, Eye, FileText, CheckCircle, AlertCircle, ArrowLeft, HelpCircle } from "lucide-react";
import { ServiceDefinitionForm } from "./ServiceDefinitionForm";
import { VolumeConfigurationForm } from "./VolumeConfigurationForm";
import { NetworkConfigurationForm } from "./NetworkConfigurationForm";
import { YamlPreview } from "./YamlPreview";
import { ValidationDisplay, ValidationStatus } from "./ValidationDisplay";
import { HelpTooltip, HelpSection, HELP_CONTENT } from "./HelpTooltips";
import { ResponsiveLayout, ResponsiveText, ResponsiveButtonGroup } from "./ResponsiveLayout";
import { useKeyboardShortcuts, createInfrastructureShortcuts } from "../hooks/useKeyboardShortcuts";
import { useScreenSize } from "../utils/responsive";
import { useValidation, useServerValidation } from "../hooks/useValidation";
import type { DockerComposeConfig, ServiceDefinition, VolumeDefinition, NetworkDefinition } from "../types";

interface ConfigurationEditorProps {
  config?: DockerComposeConfig;
  onSave: (config: Partial<DockerComposeConfig>) => void;
  onCancel: () => void;
}

export const ConfigurationEditor: React.FC<ConfigurationEditorProps> = ({
  config,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(config?.name || "");
  const [description, setDescription] = useState(config?.description || "");
  const [services, setServices] = useState<ServiceDefinition[]>(config?.metadata?.services || []);
  const [volumes, setVolumes] = useState<VolumeDefinition[]>(config?.metadata?.volumes || []);
  const [networks, setNetworks] = useState<NetworkDefinition[]>(config?.metadata?.networks || []);
  const [showPreview, setShowPreview] = useState(false);
  const [dismissedWarnings, setDismissedWarnings] = useState<number[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");

  // Responsive utilities
  const { width } = useScreenSize();
  const isMobile = useMemo(() => width < 768, [width]);

  // Validation hooks
  const validation = useValidation();
  const serverValidation = useServerValidation();

  const handleAddService = useCallback(() => {
    const newService: ServiceDefinition = {
      name: `service-${services.length + 1}`,
      image: "",
      ports: [],
      environment: [],
      volumes: [],
      depends_on: [],
    };
    setServices([...services, newService]);
  }, [services]);

  // Only validate when explicitly requested or when saving
  const validateCurrentConfig = useCallback(() => {
    const configData: Partial<DockerComposeConfig> = {
      name,
      description,
      metadata: {
        services,
        volumes,
        networks,
      },
    };
    return validation.validateConfig(configData);
  }, [name, description, services, volumes, networks, validation]);

  const handleSave = useCallback(async () => {
    const configData: Partial<DockerComposeConfig> = {
      name,
      description,
      metadata: {
        services,
        volumes,
        networks,
      },
    };

    // Perform client-side validation first
    const clientValidation = validateCurrentConfig();
    if (!clientValidation.valid) {
      return; // Don't save if client validation fails
    }

    // Perform server-side validation
    const serverValidationResult = await serverValidation.validateWithServer(configData);
    if (!serverValidationResult.valid) {
      return; // Don't save if server validation fails
    }

    onSave(configData);
  }, [name, description, services, volumes, networks, onSave, validateCurrentConfig, serverValidation]);

  const handleValidate = useCallback(() => {
    // Trigger validation
    console.log('Validating configuration...');
    validateCurrentConfig();
  }, [validateCurrentConfig]);

  // Keyboard shortcuts
  const shortcuts = createInfrastructureShortcuts({
    onSaveConfiguration: handleSave,
    onValidateConfiguration: handleValidate,
  });

  useKeyboardShortcuts({ shortcuts });

  const handleUpdateService = useCallback((index: number, updatedService: ServiceDefinition) => {
    const newServices = [...services];
    newServices[index] = updatedService;
    setServices(newServices);
  }, [services]);

  const handleRemoveService = useCallback((index: number) => {
    setServices(services.filter((_, i) => i !== index));
  }, [services]);

  const handleAddVolume = useCallback(() => {
    const newVolume: VolumeDefinition = {
      name: `volume-${volumes.length + 1}`,
      driver: "local",
      driver_opts: {},
    };
    setVolumes([...volumes, newVolume]);
  }, [volumes]);

  const handleUpdateVolume = useCallback((index: number, updatedVolume: VolumeDefinition) => {
    const newVolumes = [...volumes];
    newVolumes[index] = updatedVolume;
    setVolumes(newVolumes);
  }, [volumes]);

  const handleRemoveVolume = useCallback((index: number) => {
    setVolumes(volumes.filter((_, i) => i !== index));
  }, [volumes]);

  const handleAddNetwork = useCallback(() => {
    const newNetwork: NetworkDefinition = {
      name: `network-${networks.length + 1}`,
      driver: "bridge",
      driver_opts: {},
    };
    setNetworks([...networks, newNetwork]);
  }, [networks]);

  const handleUpdateNetwork = useCallback((index: number, updatedNetwork: NetworkDefinition) => {
    const newNetworks = [...networks];
    newNetworks[index] = updatedNetwork;
    setNetworks(newNetworks);
  }, [networks]);

  const handleRemoveNetwork = useCallback((index: number) => {
    setNetworks(networks.filter((_, i) => i !== index));
  }, [networks]);

  const handleDismissWarning = useCallback((index: number) => {
    setDismissedWarnings(prev => [...prev, index]);
  }, []);

  const isValid = validation.isValid && name.trim() !== "" && services.length > 0;
  const filteredWarnings = validation.warnings.filter((_, index) => !dismissedWarnings.includes(index));

  return (
    <ResponsiveLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="flex items-center gap-2 p-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {!isMobile && "Back"}
            </Button>
            <ResponsiveText variant="h2">
              {config ? "Edit Configuration" : "New Configuration"}
            </ResponsiveText>
            <HelpTooltip content="Toggle help information for configuration editing">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHelp(prev => !prev)}
                className="p-2"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            </HelpTooltip>
          </div>
          <div className="flex items-center gap-3">
            <ResponsiveText variant="body" className="text-muted-foreground">
              Create and configure your Docker Compose stack
            </ResponsiveText>
            <ValidationStatus 
              hasErrors={validation.hasErrors}
              hasWarnings={validation.hasWarnings}
              isValidating={serverValidation.isValidating}
            />
          </div>
        </div>
        
        <ResponsiveButtonGroup>
          <HelpTooltip content={showPreview ? "Switch to form editor" : "Preview YAML output"}>
            <Button
              variant="outline"
              size={isMobile ? "sm" : "default"}
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2"
            >
              {showPreview ? <FileText className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPreview ? "Form" : "Preview"}
            </Button>
          </HelpTooltip>
          
          <HelpTooltip content="Save configuration (Ctrl+S)">
            <Button 
              onClick={handleSave} 
              disabled={!isValid || serverValidation.isValidating} 
              size={isMobile ? "sm" : "default"}
              className="flex items-center gap-2"
            >
              {serverValidation.isValidating ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isValid ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              {serverValidation.isValidating ? "Validating..." : isMobile ? "Save" : "Save Configuration"}
            </Button>
          </HelpTooltip>
        </ResponsiveButtonGroup>
      </div>
      
      {/* Help Section */}
      {showHelp && (
        <HelpSection
          title="Configuration Editor"
          description={HELP_CONTENT.dockerCompose.description}
          tips={[
            "Use Ctrl+S to save your configuration quickly",
            "Use Ctrl+T to validate your configuration",
            "Switch between form and preview modes to see the generated YAML",
            "The sidebar shows a summary of your configuration"
          ]}
          warnings={HELP_CONTENT.dockerCompose.warnings}
        />
      )}

      {/* Validation Display */}
      <ValidationDisplay
        errors={[...validation.errors, ...serverValidation.serverErrors]}
        warnings={filteredWarnings}
        onDismissWarning={handleDismissWarning}
      />

      {showPreview ? (
        <YamlPreview
          name={name}
          services={services}
          volumes={volumes}
          networks={networks}
        />
      ) : (
        <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'}`}>
          {/* Main Configuration Form */}
          <div className={`space-y-6 ${isMobile ? '' : 'lg:col-span-2'}`}>

            {/* Configuration Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className={`grid w-full ${isMobile ? 'grid-cols-1 h-auto' : 'grid-cols-3'}`}>
                <TabsTrigger value="basic" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>Basic Info</span>
                </TabsTrigger>
                <TabsTrigger value="services" className="flex items-center gap-2">
                  <span>Services ({services.length})</span>
                  <HelpTooltip content="Define the containers that make up your application">
                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                  </HelpTooltip>
                </TabsTrigger>
                <TabsTrigger value="volumes" className="flex items-center gap-2">
                  <span>Volumes ({volumes.length})</span>
                  <HelpTooltip content="Configure persistent storage for your containers">
                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                  </HelpTooltip>
                </TabsTrigger>
                <TabsTrigger value="networks" className="flex items-center gap-2">
                  <span>Networks ({networks.length})</span>
                  <HelpTooltip content="Set up networking between your containers">
                    <HelpCircle className="h-3 w-3 text-muted-foreground" />
                  </HelpTooltip>
                </TabsTrigger>
              </TabsList>
              
              {/* Basic Information Tab */}
              <TabsContent value="basic" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <CardTitle>Basic Information</CardTitle>
                      <HelpTooltip content="Configure the basic details of your Docker Compose stack">
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </HelpTooltip>
                    </div>
                    <CardDescription>
                      Configure the basic details of your Docker Compose stack
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Stack Name *</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="my-awesome-stack"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe what this stack does..."
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>
                
                {showHelp && (
                  <HelpSection
                    title="Basic Configuration"
                    description="Set up the fundamental information for your Docker Compose stack."
                    tips={[
                      "Choose a descriptive name that reflects the stack's purpose",
                      "Use lowercase letters, numbers, and hyphens only",
                      "Add a clear description to help others understand the stack"
                    ]}
                  />
                )}
              </TabsContent>

              {/* Services Tab */}
              <TabsContent value="services" className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <ResponsiveText variant="h3">Service Definitions</ResponsiveText>
                    <HelpTooltip content="Services define the containers that make up your application">
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </HelpTooltip>
                  </div>
                  <Button 
                    onClick={handleAddService} 
                    size={isMobile ? "sm" : "default"}
                    className="flex items-center gap-2 w-full sm:w-auto"
                  >
                    <Plus className="h-4 w-4" />
                    Add Service
                  </Button>
                </div>
                
                {services.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-lg font-medium mb-2">No services defined</p>
                        <p className="text-sm mb-4">
                          Add your first service to get started with your Docker Compose stack.
                        </p>
                        <Button onClick={handleAddService} className="flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          Add First Service
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {services.map((service, index) => (
                      <ServiceDefinitionForm
                        key={index}
                        service={service}
                        availableServices={services.map(s => s.name).filter(n => n !== service.name)}
                        onUpdate={(updatedService) => handleUpdateService(index, updatedService)}
                        onRemove={() => handleRemoveService(index)}
                      />
                    ))}
                  </div>
                )}
                
                {showHelp && (
                  <HelpSection
                    title="Service Configuration"
                    description={HELP_CONTENT.dockerCompose.description}
                    tips={[
                      "Each service represents a container in your stack",
                      "Use specific image tags instead of 'latest' for production",
                      "Configure health checks for critical services",
                      "Set resource limits to prevent resource exhaustion"
                    ]}
                    warnings={[
                      "Avoid exposing unnecessary ports to the host system",
                      "Be careful with volume mounts - they can affect host system security"
                    ]}
                  />
                )}
              </TabsContent>

              {/* Volumes Tab */}
              <TabsContent value="volumes" className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <ResponsiveText variant="h3">Volume Definitions</ResponsiveText>
                    <HelpTooltip content={HELP_CONTENT.volumeMounts.description}>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </HelpTooltip>
                  </div>
                  <Button 
                    onClick={handleAddVolume} 
                    size={isMobile ? "sm" : "default"}
                    className="flex items-center gap-2 w-full sm:w-auto"
                  >
                    <Plus className="h-4 w-4" />
                    Add Volume
                  </Button>
                </div>
                
                <div className="space-y-4">
                  {volumes.map((volume, index) => (
                    <VolumeConfigurationForm
                      key={index}
                      volume={volume}
                      onUpdate={(updatedVolume) => handleUpdateVolume(index, updatedVolume)}
                      onRemove={() => handleRemoveVolume(index)}
                    />
                  ))}
                </div>
                
                {showHelp && (
                  <HelpSection
                    title="Volume Configuration"
                    description={HELP_CONTENT.volumeMounts.description}
                    tips={HELP_CONTENT.volumeMounts.tips}
                    warnings={HELP_CONTENT.volumeMounts.warnings}
                  />
                )}
              </TabsContent>

              {/* Networks Tab */}
              <TabsContent value="networks" className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <ResponsiveText variant="h3">Network Definitions</ResponsiveText>
                    <HelpTooltip content={HELP_CONTENT.networking.description}>
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </HelpTooltip>
                  </div>
                  <Button 
                    onClick={handleAddNetwork} 
                    size={isMobile ? "sm" : "default"}
                    className="flex items-center gap-2 w-full sm:w-auto"
                  >
                    <Plus className="h-4 w-4" />
                    Add Network
                  </Button>
                </div>
                
                <div className="space-y-4">
                  {networks.map((network, index) => (
                    <NetworkConfigurationForm
                      key={index}
                      network={network}
                      onUpdate={(updatedNetwork) => handleUpdateNetwork(index, updatedNetwork)}
                      onRemove={() => handleRemoveNetwork(index)}
                    />
                  ))}
                </div>
                
                {showHelp && (
                  <HelpSection
                    title="Network Configuration"
                    description={HELP_CONTENT.networking.description}
                    tips={HELP_CONTENT.networking.tips}
                    warnings={HELP_CONTENT.networking.warnings}
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar - Hidden on mobile, shown as cards on desktop */}
          {!isMobile && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">Configuration Summary</CardTitle>
                    <HelpTooltip content="Overview of your current configuration">
                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </HelpTooltip>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Services:</span>
                    <span className="font-medium">{services.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Volumes:</span>
                    <span className="font-medium">{volumes.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Networks:</span>
                    <span className="font-medium">{networks.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Ports:</span>
                    <span className="font-medium">
                      {services.reduce((total, service) => total + service.ports.length, 0)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Quick Tips</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>• Use Ctrl+S to save quickly</p>
                  <p>• Use Ctrl+T to validate configuration</p>
                  <p>• Configure health checks for critical services</p>
                  <p>• Use secrets for sensitive environment variables</p>
                  <p>• Set resource limits to prevent resource exhaustion</p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </ResponsiveLayout>
  );
};