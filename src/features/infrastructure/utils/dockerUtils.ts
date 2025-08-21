import type { DockerComposeConfig, ServiceDefinition, VolumeDefinition, NetworkDefinition, PortMapping, VolumeMount, EnvironmentVariable } from '../types';

export interface DockerCommandParseResult {
  success: boolean;
  composeConfig?: Partial<DockerComposeConfig>;
  error?: string;
  warnings?: string[];
}

export interface DockerComposeImportResult {
  success: boolean;
  composeConfig?: Partial<DockerComposeConfig>;
  error?: string;
  warnings?: string[];
}

/**
 * Parse Docker run command and convert to Docker Compose format
 */
export function parseDockerCommand(command: string): DockerCommandParseResult {
  try {
    const trimmedCommand = command.trim();
    
    // Basic validation
    if (!trimmedCommand.startsWith('docker run')) {
      return {
        success: false,
        error: 'Command must start with "docker run"'
      };
    }

    // Extract the command parts
    const parts = trimmedCommand.split(' ');
    const args: string[] = [];
    let image = '';
    const commandArgs: string[] = [];
    let inCommand = false;

    // Parse arguments
    for (let i = 2; i < parts.length; i++) {
      const part = parts[i];
      
      if (inCommand) {
        commandArgs.push(part);
        continue;
      }

      if (part.startsWith('-')) {
        args.push(part);
        // Handle arguments that take values
        if (['-p', '--publish', '-v', '--volume', '-e', '--env', '--name', '-w', '--workdir', '--restart', '--memory', '--cpus'].includes(part)) {
          if (i + 1 < parts.length && !parts[i + 1].startsWith('-')) {
            args.push(parts[i + 1]);
            i++;
          }
        }
      } else if (!image) {
        image = part;
        inCommand = true;
      } else {
        commandArgs.push(part);
        inCommand = true;
      }
    }

    if (!image) {
      return {
        success: false,
        error: 'No image specified in command'
      };
    }

    // Parse the parsed arguments into service definition
    const service = parseDockerArgs(args, image, commandArgs);
    
    const composeConfig: Partial<DockerComposeConfig> = {
      name: service.name || 'imported-service',
      description: `Imported from Docker command: ${trimmedCommand}`,
      metadata: {
        services: [service],
        volumes: [],
        networks: []
      }
    };

    return {
      success: true,
      composeConfig,
      warnings: [
        'This is an automated conversion - please review and adjust as needed',
        'Some advanced Docker options may not be fully supported',
        'Consider adding health checks and resource limits for production use'
      ]
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to parse Docker command: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Parse Docker arguments and convert to service definition
 */
function parseDockerArgs(args: string[], image: string, commandArgs: string[]): ServiceDefinition {
  const service: ServiceDefinition = {
    name: 'imported-service',
    image,
    ports: [],
    environment: [],
    volumes: [],
    depends_on: [],
    restart_policy: 'unless-stopped',
    memory_limit: '512m',
    cpu_limit: '0.5'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '-p':
      case '--publish':
        if (i + 1 < args.length) {
          const portMapping = parsePortMapping(args[i + 1]);
          if (portMapping) {
            service.ports.push(portMapping);
          }
          i++;
        }
        break;

      case '-v':
      case '--volume':
        if (i + 1 < args.length) {
          const volumeMount = parseVolumeMount(args[i + 1]);
          if (volumeMount) {
            service.volumes.push(volumeMount);
          }
          i++;
        }
        break;

      case '-e':
      case '--env':
        if (i + 1 < args.length) {
          const envVar = parseEnvironmentVariable(args[i + 1]);
          if (envVar) {
            service.environment.push(envVar);
          }
          i++;
        }
        break;

      case '--name':
        if (i + 1 < args.length) {
          service.name = args[i + 1];
          i++;
        }
        break;

      case '-w':
      case '--workdir':
        if (i + 1 < args.length) {
          service.working_dir = args[i + 1];
          i++;
        }
        break;

      case '--restart':
        if (i + 1 < args.length) {
          const restartPolicy = parseRestartPolicy(args[i + 1]);
          if (restartPolicy) {
            service.restart_policy = restartPolicy;
          }
          i++;
        }
        break;

      case '--memory':
        if (i + 1 < args.length) {
          service.memory_limit = args[i + 1];
          i++;
        }
        break;

      case '--cpus':
        if (i + 1 < args.length) {
          service.cpu_limit = args[i + 1];
          i++;
        }
        break;
    }
  }

  // Add command if present
  if (commandArgs.length > 0) {
    service.command = commandArgs.join(' ');
  }

  return service;
}

/**
 * Parse port mapping string (e.g., "8080:80" or "8080:80/tcp")
 */
function parsePortMapping(portString: string): PortMapping | null {
  try {
    const [hostPort, containerPort] = portString.split(':');
    if (!hostPort || !containerPort) return null;

    const [port, protocol] = containerPort.split('/');
    const protocolType = (protocol || 'tcp') as 'tcp' | 'udp';

    return {
      host_port: parseInt(hostPort, 10),
      container_port: parseInt(port, 10),
      protocol: protocolType
    };
  } catch {
    return null;
  }
}

/**
 * Parse volume mount string (e.g., "/host/path:/container/path:ro")
 */
function parseVolumeMount(volumeString: string): VolumeMount | null {
  try {
    const parts = volumeString.split(':');
    if (parts.length < 2) return null;

    const [hostPath, containerPath, mode] = parts;
    const mountMode = mode === 'ro' ? 'ro' : 'rw';

    return {
      host_path: hostPath,
      container_path: containerPath,
      mode: mountMode
    };
  } catch {
    return null;
  }
}

/**
 * Parse environment variable string (e.g., "KEY=value" or "KEY")
 */
function parseEnvironmentVariable(envString: string): EnvironmentVariable | null {
  try {
    if (envString.includes('=')) {
      const [key, value] = envString.split('=', 2);
      return {
        key,
        value,
        is_secret: false
      };
    } else {
      // Just the key, value will be empty (user needs to fill in)
      return {
        key: envString,
        value: '',
        is_secret: false
      };
    }
  } catch {
    return null;
  }
}

/**
 * Parse restart policy string
 */
function parseRestartPolicy(policy: string): 'no' | 'always' | 'on-failure' | 'unless-stopped' | undefined {
  switch (policy) {
    case 'no':
    case 'always':
    case 'on-failure':
    case 'unless-stopped':
      return policy;
    default:
      return undefined;
  }
}

/**
 * Import Docker Compose YAML content
 */
export function importDockerCompose(yamlContent: string): DockerComposeImportResult {
  try {
    // Basic YAML validation
    if (!yamlContent.trim()) {
      return {
        success: false,
        error: 'Empty YAML content'
      };
    }

    // Check for basic Docker Compose structure
    if (!yamlContent.includes('version:') && !yamlContent.includes('services:')) {
      return {
        success: false,
        error: 'Invalid Docker Compose format - missing version or services section'
      };
    }

    // Parse the YAML content to extract services, volumes, and networks
    const parsedConfig = parseDockerComposeYaml(yamlContent);
    
    if (!parsedConfig) {
      return {
        success: false,
        error: 'Failed to parse Docker Compose YAML content'
      };
    }

    const composeConfig: Partial<DockerComposeConfig> = {
      name: parsedConfig.name || 'imported-compose',
      description: `Imported from Docker Compose file${parsedConfig.name ? `: ${parsedConfig.name}` : ''}`,
      metadata: {
        services: parsedConfig.services || [],
        volumes: parsedConfig.volumes || [],
        networks: parsedConfig.networks || []
      }
    };

    return {
      success: true,
      composeConfig,
      warnings: [
        'YAML content imported successfully',
        'Please review and adjust the configuration as needed',
        'Some advanced Docker Compose features may need manual configuration'
      ]
    };

  } catch (error) {
    return {
      success: false,
      error: `Failed to import Docker Compose: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Parse Docker Compose YAML content and extract configuration
 */
function parseDockerComposeYaml(yamlContent: string): {
  name?: string;
  services: ServiceDefinition[];
  volumes: VolumeDefinition[];
  networks: NetworkDefinition[];
} | null {
  try {
    const lines = yamlContent.split('\n');
    const result = {
      name: undefined as string | undefined,
      services: [] as ServiceDefinition[],
      volumes: [] as VolumeDefinition[],
      networks: [] as NetworkDefinition[]
    };

    let currentSection = '';
    let currentService = '';
    let currentVolume = '';
    let currentNetwork = '';
    let currentProperty = '';
    const indentLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      const originalLine = lines[i];
      const line = originalLine.trim();
      if (!line || line.startsWith('#')) continue;

      // Detect section headers (only at root level, no indentation)
      if (!originalLine.startsWith(' ') && (line === 'services:' || line === 'volumes:' || line === 'networks:')) {
        currentSection = line.slice(0, -1); // Remove the colon
        continue;
      }

      // Reset current service when we leave the services section
      if (currentSection !== 'services') {
        currentService = '';
      }

      // Extract stack name
      if (line.startsWith('name:')) {
        result.name = line.split(':', 2)[1]?.trim().replace(/['"]/g, '');
        continue;
      }

      // Parse services
      if (currentSection === 'services') {
        // Check if this is a service name (ends with colon, not a property, and has minimal indentation)
        if (line.endsWith(':') && !['image:', 'ports:', 'environment:', 'volumes:', 'restart:', 'working_dir:', 'command:', 'depends_on:', 'healthcheck:', 'deploy:', 'networks:', 'labels:', 'logging:', 'user:', 'build:'].some(prop => line.startsWith(prop))) {
          currentService = line.slice(0, -1).trim(); // Remove the colon
          result.services.push({
            name: currentService,
            image: '',
            ports: [],
            environment: [],
            volumes: [],
            depends_on: []
          });
        } else if (currentService && line.trim().startsWith('-')) {
          // Handle list items that are part of the current service
          const listItem = line.trim().substring(1).trim().replace(/['"]/g, '');
          
          const serviceIndex = result.services.findIndex(s => s.name === currentService);
          if (serviceIndex === -1) continue;
          
          // Parse based on the current property context
          switch (currentProperty) {
            case 'ports':
              const portMapping = parsePortMapping(listItem);
              if (portMapping) {
                result.services[serviceIndex].ports.push(portMapping);
              }
              break;
            case 'environment':
              const envVar = parseEnvironmentVariable(listItem);
              if (envVar) {
                result.services[serviceIndex].environment.push(envVar);
              }
              break;
            case 'volumes':
              const volumeMount = parseVolumeMount(listItem);
              if (volumeMount) {
                result.services[serviceIndex].volumes.push(volumeMount);
              }
              break;
          }
        } else if (currentService && line.includes(':')) {
          const [key, ...valueParts] = line.split(':');
          const key_trimmed = key.trim();
          const value = valueParts.join(':').trim();

          const serviceIndex = result.services.findIndex(s => s.name === currentService);
          if (serviceIndex === -1) continue;

          switch (key_trimmed) {
            case 'image':
              result.services[serviceIndex].image = value.replace(/['"]/g, '');
              currentProperty = '';
              break;
            case 'ports':
              currentProperty = 'ports';
              break;
            case 'environment':
              currentProperty = 'environment';
              break;
            case 'volumes':
              currentProperty = 'volumes';
              break;
            case 'restart':
              result.services[serviceIndex].restart_policy = value.replace(/['"]/g, '') as any;
              currentProperty = '';
              break;
            case 'working_dir':
              result.services[serviceIndex].working_dir = value.replace(/['"]/g, '');
              currentProperty = '';
              break;
            case 'command':
              result.services[serviceIndex].command = value.replace(/['"]/g, '');
              currentProperty = '';
              break;
          }
        
        }
      }

      // Parse volumes
      if (currentSection === 'volumes') {
        if (line.includes(':') && !line.includes('  ')) {
          currentVolume = line.split(':')[0].trim();
          result.volumes.push({
            name: currentVolume,
            driver: 'local',
            driver_opts: {}
          });
        }
      }

      // Parse networks
      if (currentSection === 'networks') {
        if (line.includes(':') && !line.includes('  ')) {
          currentNetwork = line.split(':')[0].trim();
          result.networks.push({
            name: currentNetwork,
            driver: 'bridge',
            driver_opts: {}
          });
        }
      }
    }

    return result;
  } catch (error) {
    console.error('Error parsing Docker Compose YAML:', error);
    return null;
  }
}

/**
 * Generate Docker Compose YAML from configuration
 */
export function generateDockerComposeYaml(config: Partial<DockerComposeConfig>): string {
  const { name, metadata } = config;
  
  if (!metadata?.services || metadata.services.length === 0) {
    return '';
  }

  let yaml = `version: '3.8'\n\n`;
  
  if (name) {
    yaml += `name: ${name}\n\n`;
  }

  // Services
  yaml += `services:\n`;
  metadata.services.forEach(service => {
    yaml += `  ${service.name}:\n`;
    yaml += `    image: ${service.image}\n`;
    
    if (service.ports.length > 0) {
      yaml += `    ports:\n`;
      service.ports.forEach(port => {
        yaml += `      - "${port.host_port}:${port.container_port}${port.protocol !== 'tcp' ? '/' + port.protocol : ''}"\n`;
      });
    }

    if (service.environment.length > 0) {
      yaml += `    environment:\n`;
      service.environment.forEach(env => {
        if (env.value) {
          yaml += `      - ${env.key}=${env.value}\n`;
        } else {
          yaml += `      - ${env.key}\n`;
        }
      });
    }

    if (service.volumes.length > 0) {
      yaml += `    volumes:\n`;
      service.volumes.forEach(volume => {
        yaml += `      - ${volume.host_path}:${volume.container_path}:${volume.mode}\n`;
      });
    }

    if (service.depends_on && service.depends_on.length > 0) {
      yaml += `    depends_on:\n`;
      service.depends_on.forEach(dep => {
        yaml += `      - ${dep}\n`;
      });
    }

    if (service.restart_policy && service.restart_policy !== 'unless-stopped') {
      yaml += `    restart: ${service.restart_policy}\n`;
    }

    if (service.memory_limit && service.memory_limit !== '512m') {
      yaml += `    deploy:\n      resources:\n        limits:\n          memory: ${service.memory_limit}\n`;
    }

    if (service.cpu_limit && service.cpu_limit !== '0.5') {
      if (!yaml.includes('deploy:')) {
        yaml += `    deploy:\n      resources:\n        limits:\n`;
      }
      yaml += `          cpus: '${service.cpu_limit}'\n`;
    }

    if (service.working_dir) {
      yaml += `    working_dir: ${service.working_dir}\n`;
    }

    if (service.command) {
      yaml += `    command: ${service.command}\n`;
    }

    yaml += `\n`;
  });

  // Volumes
  if (metadata.volumes && metadata.volumes.length > 0) {
    yaml += `volumes:\n`;
    metadata.volumes.forEach(volume => {
      yaml += `  ${volume.name}:\n`;
      if (volume.driver && volume.driver !== 'local') {
        yaml += `    driver: ${volume.driver}\n`;
      }
      if (volume.driver_opts && Object.keys(volume.driver_opts).length > 0) {
        yaml += `    driver_opts:\n`;
        Object.entries(volume.driver_opts).forEach(([key, value]) => {
          yaml += `      ${key}: ${value}\n`;
        });
      }
    });
    yaml += `\n`;
  }

  // Networks
  if (metadata.networks && metadata.networks.length > 0) {
    yaml += `networks:\n`;
    metadata.networks.forEach(network => {
      yaml += `  ${network.name}:\n`;
      if (network.driver && network.driver !== 'bridge') {
        yaml += `    driver: ${network.driver}\n`;
      }
      if (network.driver_opts && Object.keys(network.driver_opts).length > 0) {
        yaml += `    driver_opts:\n`;
        Object.entries(network.driver_opts).forEach(([key, value]) => {
          yaml += `      ${key}: ${value}\n`;
        });
      }
    });
  }

  return yaml;
}
