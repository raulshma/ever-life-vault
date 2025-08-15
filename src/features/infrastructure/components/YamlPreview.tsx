import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Download, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ServiceDefinition, VolumeDefinition, NetworkDefinition } from "../types";

interface YamlPreviewProps {
  name: string;
  services: ServiceDefinition[];
  volumes: VolumeDefinition[];
  networks: NetworkDefinition[];
}

export const YamlPreview: React.FC<YamlPreviewProps> = ({
  name,
  services,
  volumes,
  networks,
}) => {
  const [copied, setCopied] = React.useState(false);

  const yamlContent = useMemo(() => {
    return generateDockerComposeYaml(name, services, volumes, networks);
  }, [name, services, volumes, networks]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(yamlContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name || 'docker-compose'}.yml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const hasValidation = !name.trim() || services.length === 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Docker Compose Preview
                {!hasValidation && <CheckCircle className="h-5 w-5 text-green-500" />}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Real-time preview of your Docker Compose configuration
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="flex items-center gap-2"
                disabled={hasValidation}
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="flex items-center gap-2"
                disabled={hasValidation}
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {hasValidation && (
            <Alert className="mb-4">
              <AlertDescription>
                Please provide a stack name and at least one service to generate the YAML preview.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="relative">
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono">
              <code className="language-yaml">
                <YamlSyntaxHighlight content={yamlContent} />
              </code>
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{services.length}</div>
              <div className="text-sm text-muted-foreground">Services</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{volumes.length}</div>
              <div className="text-sm text-muted-foreground">Volumes</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{networks.length}</div>
              <div className="text-sm text-muted-foreground">Networks</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

// Simple YAML syntax highlighting component
const YamlSyntaxHighlight: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  
  return (
    <>
      {lines.map((line, index) => (
        <div key={index} className="leading-relaxed">
          <YamlLine line={line} />
        </div>
      ))}
    </>
  );
};

const YamlLine: React.FC<{ line: string }> = ({ line }) => {
  // Simple regex-based syntax highlighting
  const commentMatch = line.match(/^(\s*)(#.*)$/);
  if (commentMatch) {
    return (
      <span>
        <span>{commentMatch[1]}</span>
        <span className="text-green-600">{commentMatch[2]}</span>
      </span>
    );
  }

  const keyValueMatch = line.match(/^(\s*)([^:]+):\s*(.*)$/);
  if (keyValueMatch) {
    const [, indent, key, value] = keyValueMatch;
    return (
      <span>
        <span>{indent}</span>
        <span className="text-blue-600 font-medium">{key}</span>
        <span>: </span>
        <span className="text-orange-600">{value}</span>
      </span>
    );
  }

  const listItemMatch = line.match(/^(\s*)-\s*(.*)$/);
  if (listItemMatch) {
    const [, indent, content] = listItemMatch;
    return (
      <span>
        <span>{indent}</span>
        <span className="text-purple-600">- </span>
        <span>{content}</span>
      </span>
    );
  }

  return <span>{line}</span>;
};

// Function to generate Docker Compose YAML
function generateDockerComposeYaml(
  name: string,
  services: ServiceDefinition[],
  volumes: VolumeDefinition[],
  networks: NetworkDefinition[]
): string {
  if (!name.trim() || services.length === 0) {
    return "# Please provide a stack name and at least one service";
  }

  const yaml: string[] = [];
  
  // Header comment
  yaml.push(`# Docker Compose configuration for ${name}`);
  yaml.push(`# Generated on ${new Date().toISOString()}`);
  yaml.push('');
  yaml.push('version: "3.8"');
  yaml.push('');

  // Services section
  if (services.length > 0) {
    yaml.push('services:');
    services.forEach(service => {
      if (!service.name.trim() || !service.image.trim()) return;
      
      yaml.push(`  ${service.name}:`);
      yaml.push(`    image: ${service.image}`);
      
      // Container name
      yaml.push(`    container_name: ${name}_${service.name}`);
      
      // Ports
      if (service.ports.length > 0) {
        yaml.push('    ports:');
        service.ports.forEach(port => {
          if (port.host_port && port.container_port) {
            yaml.push(`      - "${port.host_port}:${port.container_port}${port.protocol === 'udp' ? '/udp' : ''}"`);
          }
        });
      }
      
      // Environment variables
      if (service.environment.length > 0) {
        yaml.push('    environment:');
        service.environment.forEach(env => {
          if (env.key.trim()) {
            const value = env.is_secret ? `\${${env.key}}` : env.value;
            yaml.push(`      ${env.key}: ${value}`);
          }
        });
      }
      
      // Volume mounts
      if (service.volumes.length > 0) {
        yaml.push('    volumes:');
        service.volumes.forEach(volume => {
          if (volume.host_path.trim() && volume.container_path.trim()) {
            yaml.push(`      - ${volume.host_path}:${volume.container_path}:${volume.mode}`);
          }
        });
      }
      
      // Dependencies
      if (service.depends_on && service.depends_on.length > 0) {
        yaml.push('    depends_on:');
        service.depends_on.forEach(dep => {
          yaml.push(`      - ${dep}`);
        });
      }
      
      // Restart policy
      if (service.restart_policy && service.restart_policy !== 'no') {
        yaml.push(`    restart: ${service.restart_policy}`);
      }
      
      // User and group
      if (service.user_id !== undefined) {
        yaml.push(`    user: ${service.user_id}${service.group_id !== undefined ? `:${service.group_id}` : ''}`);
      } else if (service.group_id !== undefined) {
        yaml.push(`    user: :${service.group_id}`);
      }
      
      // Resource limits
      if (service.memory_limit || service.cpu_limit) {
        yaml.push('    deploy:');
        if (service.memory_limit) {
          yaml.push(`      resources:`);
          yaml.push(`        limits:`);
          yaml.push(`          memory: ${service.memory_limit}`);
        }
        if (service.cpu_limit) {
          if (!service.memory_limit) {
            yaml.push(`      resources:`);
            yaml.push(`        limits:`);
          }
          yaml.push(`          cpus: '${service.cpu_limit}'`);
        }
      }
      
      // Health check
      if (service.health_check) {
        yaml.push('    healthcheck:');
        yaml.push(`      test: ${service.health_check}`);
        yaml.push('      interval: 30s');
        yaml.push('      timeout: 10s');
        yaml.push('      retries: 3');
        yaml.push('      start_period: 40s');
      }
      
      // Working directory
      if (service.working_dir) {
        yaml.push(`    working_dir: ${service.working_dir}`);
      }
      
      // Command override
      if (service.command) {
        yaml.push(`    command: ${service.command}`);
      }
      
      yaml.push('');
    });
  }

  // Volumes section
  if (volumes.length > 0) {
    yaml.push('volumes:');
    volumes.forEach(volume => {
      if (!volume.name.trim()) return;
      
      yaml.push(`  ${volume.name}:`);
      if (volume.driver && volume.driver !== 'local') {
        yaml.push(`    driver: ${volume.driver}`);
      }
      
      if (volume.driver_opts && Object.keys(volume.driver_opts).length > 0) {
        yaml.push('    driver_opts:');
        Object.entries(volume.driver_opts).forEach(([key, value]) => {
          if (key.trim() && value.trim()) {
            yaml.push(`      ${key}: ${value}`);
          }
        });
      }
      yaml.push('');
    });
  }

  // Networks section
  if (networks.length > 0) {
    yaml.push('networks:');
    networks.forEach(network => {
      if (!network.name.trim()) return;
      
      yaml.push(`  ${network.name}:`);
      if (network.driver && network.driver !== 'bridge') {
        yaml.push(`    driver: ${network.driver}`);
      }
      
      if (network.driver_opts && Object.keys(network.driver_opts).length > 0) {
        yaml.push('    driver_opts:');
        Object.entries(network.driver_opts).forEach(([key, value]) => {
          if (key.trim() && value.trim()) {
            yaml.push(`      ${key}: ${value}`);
          }
        });
      }
      yaml.push('');
    });
  }

  return yaml.join('\n').trim();
}