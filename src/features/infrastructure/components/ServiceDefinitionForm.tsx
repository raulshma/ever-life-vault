import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, Minus, ChevronDown, ChevronRight, Trash2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldValidation, ValidationHelp } from "./ValidationDisplay";
import { useFieldValidation } from "../hooks/useValidation";
import type { ServiceDefinition, PortMapping, EnvironmentVariable, VolumeMount } from "../types";

interface ServiceDefinitionFormProps {
  service: ServiceDefinition;
  availableServices: string[];
  onUpdate: (service: ServiceDefinition) => void;
  onRemove: () => void;
}

export const ServiceDefinitionForm: React.FC<ServiceDefinitionFormProps> = ({
  service,
  availableServices,
  onUpdate,
  onRemove,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Field validation hooks
  const nameValidation = useFieldValidation('serviceName', service.name);
  const imageValidation = useFieldValidation('dockerImage', service.image);

  const handleFieldChange = useCallback((field: keyof ServiceDefinition, value: any) => {
    onUpdate({ ...service, [field]: value });
  }, [service, onUpdate]);

  const handleAddPort = useCallback(() => {
    const newPort: PortMapping = {
      host_port: 8080,
      container_port: 80,
      protocol: 'tcp',
    };
    handleFieldChange('ports', [...service.ports, newPort]);
  }, [service.ports, handleFieldChange]);

  const handleUpdatePort = useCallback((index: number, updatedPort: PortMapping) => {
    const newPorts = [...service.ports];
    newPorts[index] = updatedPort;
    handleFieldChange('ports', newPorts);
  }, [service.ports, handleFieldChange]);

  const handleRemovePort = useCallback((index: number) => {
    handleFieldChange('ports', service.ports.filter((_, i) => i !== index));
  }, [service.ports, handleFieldChange]);

  const handleAddEnvironment = useCallback(() => {
    const newEnv: EnvironmentVariable = {
      key: '',
      value: '',
      is_secret: false,
    };
    handleFieldChange('environment', [...service.environment, newEnv]);
  }, [service.environment, handleFieldChange]);

  const handleUpdateEnvironment = useCallback((index: number, updatedEnv: EnvironmentVariable) => {
    const newEnv = [...service.environment];
    newEnv[index] = updatedEnv;
    handleFieldChange('environment', newEnv);
  }, [service.environment, handleFieldChange]);

  const handleRemoveEnvironment = useCallback((index: number) => {
    handleFieldChange('environment', service.environment.filter((_, i) => i !== index));
  }, [service.environment, handleFieldChange]);

  const handleAddVolumeMount = useCallback(() => {
    const newMount: VolumeMount = {
      host_path: '',
      container_path: '',
      mode: 'rw',
    };
    handleFieldChange('volumes', [...service.volumes, newMount]);
  }, [service.volumes, handleFieldChange]);

  const handleUpdateVolumeMount = useCallback((index: number, updatedMount: VolumeMount) => {
    const newMounts = [...service.volumes];
    newMounts[index] = updatedMount;
    handleFieldChange('volumes', newMounts);
  }, [service.volumes, handleFieldChange]);

  const handleRemoveVolumeMount = useCallback((index: number) => {
    handleFieldChange('volumes', service.volumes.filter((_, i) => i !== index));
  }, [service.volumes, handleFieldChange]);

  const handleToggleDependency = useCallback((depService: string) => {
    const currentDeps = service.depends_on || [];
    const newDeps = currentDeps.includes(depService)
      ? currentDeps.filter(dep => dep !== depService)
      : [...currentDeps, depService];
    handleFieldChange('depends_on', newDeps);
  }, [service.depends_on, handleFieldChange]);

  const hasValidation = nameValidation.hasErrors || imageValidation.hasErrors || !service.name.trim() || !service.image.trim();

  return (
    <Card className={hasValidation ? "border-destructive" : ""}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <CardTitle className="text-base">
                  {service.name || "Unnamed Service"}
                </CardTitle>
                {service.image && (
                  <Badge variant="secondary" className="text-xs">
                    {service.image}
                  </Badge>
                )}
                {hasValidation && (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-6">
            {hasValidation && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please fix the validation errors below before continuing.
                </AlertDescription>
              </Alert>
            )}

            {/* Basic Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`service-name-${service.name}`}>Service Name *</Label>
                <Input
                  id={`service-name-${service.name}`}
                  value={service.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  placeholder="web-server"
                  required
                  className={nameValidation.hasErrors ? "border-destructive" : ""}
                />
                <FieldValidation 
                  errors={nameValidation.errors} 
                  warnings={nameValidation.warnings} 
                />
                <ValidationHelp field="serviceName" />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`service-image-${service.name}`}>Docker Image *</Label>
                <Input
                  id={`service-image-${service.name}`}
                  value={service.image}
                  onChange={(e) => handleFieldChange('image', e.target.value)}
                  placeholder="nginx:latest"
                  required
                  className={imageValidation.hasErrors ? "border-destructive" : ""}
                />
                <FieldValidation 
                  errors={imageValidation.errors} 
                  warnings={imageValidation.warnings} 
                />
                <ValidationHelp field="dockerImage" />
              </div>
            </div>

            {/* Port Mappings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Port Mappings</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddPort}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Port
                </Button>
              </div>
              
              {service.ports.length === 0 ? (
                <p className="text-sm text-muted-foreground">No ports configured</p>
              ) : (
                <div className="space-y-2">
                  {service.ports.map((port, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Host Port</Label>
                          <Input
                            type="number"
                            value={port.host_port}
                            onChange={(e) => handleUpdatePort(index, {
                              ...port,
                              host_port: parseInt(e.target.value) || 0
                            })}
                            placeholder="8080"
                            min="1"
                            max="65535"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Container Port</Label>
                          <Input
                            type="number"
                            value={port.container_port}
                            onChange={(e) => handleUpdatePort(index, {
                              ...port,
                              container_port: parseInt(e.target.value) || 0
                            })}
                            placeholder="80"
                            min="1"
                            max="65535"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Protocol</Label>
                          <Select
                            value={port.protocol}
                            onValueChange={(value: 'tcp' | 'udp') => 
                              handleUpdatePort(index, { ...port, protocol: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="tcp">TCP</SelectItem>
                              <SelectItem value="udp">UDP</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemovePort(index)}
                        className="text-destructive"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Environment Variables */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Environment Variables</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddEnvironment}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Variable
                </Button>
              </div>
              
              {service.environment.length === 0 ? (
                <p className="text-sm text-muted-foreground">No environment variables configured</p>
              ) : (
                <div className="space-y-2">
                  {service.environment.map((env, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Key</Label>
                          <Input
                            value={env.key}
                            onChange={(e) => handleUpdateEnvironment(index, {
                              ...env,
                              key: e.target.value
                            })}
                            placeholder="NODE_ENV"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Value</Label>
                          <Input
                            type={env.is_secret ? "password" : "text"}
                            value={env.value}
                            onChange={(e) => handleUpdateEnvironment(index, {
                              ...env,
                              value: e.target.value
                            })}
                            placeholder="production"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant={env.is_secret ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleUpdateEnvironment(index, {
                            ...env,
                            is_secret: !env.is_secret
                          })}
                          className="text-xs"
                        >
                          {env.is_secret ? "Secret" : "Plain"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveEnvironment(index)}
                          className="text-destructive"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Volume Mounts */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Volume Mounts</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddVolumeMount}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add Mount
                </Button>
              </div>
              
              {service.volumes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No volume mounts configured</p>
              ) : (
                <div className="space-y-2">
                  {service.volumes.map((mount, index) => (
                    <VolumeMount
                      key={index}
                      mount={mount}
                      onUpdate={(updatedMount) => handleUpdateVolumeMount(index, updatedMount)}
                      onRemove={() => handleRemoveVolumeMount(index)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Advanced Configuration */}
            <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 p-0 h-auto">
                  {showAdvanced ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  Advanced Configuration
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-4 mt-4">
                {/* Service Dependencies */}
                {availableServices.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Service Dependencies</Label>
                    <div className="flex flex-wrap gap-2">
                      {availableServices.map((depService) => (
                        <Button
                          key={depService}
                          variant={service.depends_on?.includes(depService) ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleToggleDependency(depService)}
                          className="text-xs"
                        >
                          {depService}
                        </Button>
                      ))}
                    </div>
                    {service.depends_on && service.depends_on.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        This service will wait for: {service.depends_on.join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

// Volume Mount Component
interface VolumeMountProps {
  mount: VolumeMount;
  onUpdate: (mount: VolumeMount) => void;
  onRemove: () => void;
}

const VolumeMount: React.FC<VolumeMountProps> = ({ mount, onUpdate, onRemove }) => {
  return (
    <div className="flex items-center gap-2 p-3 border rounded-lg">
      <div className="flex-1 grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Host Path</Label>
          <Input
            value={mount.host_path}
            onChange={(e) => onUpdate({ ...mount, host_path: e.target.value })}
            placeholder="/host/path"
          />
        </div>
        <div>
          <Label className="text-xs">Container Path</Label>
          <Input
            value={mount.container_path}
            onChange={(e) => onUpdate({ ...mount, container_path: e.target.value })}
            placeholder="/container/path"
          />
        </div>
        <div>
          <Label className="text-xs">Mode</Label>
          <Select
            value={mount.mode}
            onValueChange={(value: 'ro' | 'rw') => onUpdate({ ...mount, mode: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rw">Read/Write</SelectItem>
              <SelectItem value="ro">Read Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="text-destructive"
      >
        <Minus className="h-4 w-4" />
      </Button>
    </div>
  );
};