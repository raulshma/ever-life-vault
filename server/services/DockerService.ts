import * as yaml from 'js-yaml';
import {
  ValidationResult,
  ValidationError,
  ValidationWarning
} from '../types/infrastructure.js';

export class DockerService {
  constructor() {
    // No configuration needed for validation-only service
  }

  /**
   * Validates Docker Compose content for syntax and common issues
   */
  async validateCompose(composeContent: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // Parse YAML syntax
      const parsed = yaml.load(composeContent) as Record<string, unknown>;
      
      if (!parsed) {
        errors.push({
          field: 'root',
          message: 'Empty or invalid YAML content'
        });
        return { valid: false, errors, warnings };
      }

      // Validate Docker Compose version
      if (parsed.version && typeof parsed.version === 'string') {
        const version = parsed.version;
        const supportedVersions = ['3.0', '3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8', '3.9'];
        if (!supportedVersions.includes(version)) {
          warnings.push({
            field: 'version',
            message: `Docker Compose version ${version} may not be supported. Consider using version 3.8 or later.`
          });
        }
      } else if (!parsed.version) {
        warnings.push({
          field: 'version',
          message: 'Consider specifying a Docker Compose version (e.g., version: "3.8")'
        });
      }

      // Validate Docker Compose structure
      if (!parsed.services) {
        errors.push({
          field: 'services',
          message: 'Docker Compose file must contain a services section'
        });
      } else {
        // Validate each service
        for (const [serviceName, service] of Object.entries(parsed.services as Record<string, unknown>)) {
          // Skip Docker Compose directives that might be mistakenly parsed as services
          const reservedNames = ['version', 'services', 'volumes', 'networks', 'secrets', 'configs', 'healthcheck'];
          if (reservedNames.includes(serviceName)) {
            warnings.push({
              field: `services.${serviceName}`,
              message: `"${serviceName}" is a reserved Docker Compose keyword and cannot be used as a service name. This may indicate a YAML parsing issue.`
            });
            continue;
          }
          
          this.validateService(serviceName, service as Record<string, unknown>, errors, warnings);
        }
      }

      // Check for port conflicts
      this.checkPortConflicts((parsed.services as Record<string, unknown>) || {}, warnings);

      // Validate networks if present
      if (parsed.networks) {
        this.validateNetworks(parsed.networks as Record<string, unknown>, errors, warnings);
      }

      // Validate volumes if present
      if (parsed.volumes) {
        this.validateVolumes(parsed.volumes as Record<string, unknown>, errors, warnings);
      }

      // Validate secrets if present
      if (parsed.secrets) {
        this.validateSecrets(parsed.secrets as Record<string, unknown>, errors, warnings);
      }

      // Validate configs if present
      if (parsed.configs) {
        this.validateConfigs(parsed.configs as Record<string, unknown>, errors, warnings);
      }

    } catch (yamlError: unknown) {
      const error = yamlError as { message?: string; mark?: { line?: number; column?: number } };
      errors.push({
        field: 'yaml',
        message: `YAML parsing error: ${error.message || 'Unknown error'}`,
        line: error.mark?.line,
        column: error.mark?.column
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }



  // Private helper methods

  private validateService(serviceName: string, service: Record<string, unknown>, errors: ValidationError[], warnings: ValidationWarning[]): void {
    if (!service.image && !service.build) {
      errors.push({
        field: `services.${serviceName}`,
        message: 'Service must specify either image or build'
      });
    }

    // Validate service name format
    if (!/^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/.test(serviceName)) {
      errors.push({
        field: `services.${serviceName}`,
        message: 'Service name must contain only lowercase letters, numbers, underscores, and hyphens, and cannot start or end with a hyphen'
      });
    }

    // Validate Docker image format if present
    if (service.image && typeof service.image === 'string') {
      if (service.image.includes('::') || service.image.endsWith(':')) {
        errors.push({
          field: `services.${serviceName}.image`,
          message: 'Invalid Docker image format'
        });
      }
      
      // Warn about using 'latest' tag in production
      if (service.image.endsWith(':latest') || !service.image.includes(':')) {
        warnings.push({
          field: `services.${serviceName}.image`,
          message: 'Consider using specific image tags instead of "latest" for production deployments'
        });
      }
    }

    // Validate restart policy
    if (service.restart && typeof service.restart === 'string') {
      const validRestartPolicies = ['no', 'always', 'on-failure', 'unless-stopped'];
      if (!validRestartPolicies.includes(service.restart)) {
        errors.push({
          field: `services.${serviceName}.restart`,
          message: `Invalid restart policy. Must be one of: ${validRestartPolicies.join(', ')}`
        });
      }
    }

    // Validate depends_on references
    if (Array.isArray(service.depends_on)) {
      for (const dependency of service.depends_on) {
        if (typeof dependency === 'string' && dependency === serviceName) {
          errors.push({
            field: `services.${serviceName}.depends_on`,
            message: 'Service cannot depend on itself'
          });
        }
      }
    }

    // Validate environment variables
    if (Array.isArray(service.environment)) {
      const envKeys = new Set<string>();
      for (const env of service.environment) {
        if (typeof env === 'string') {
          const [key] = env.split('=');
          if (envKeys.has(key)) {
            warnings.push({
              field: `services.${serviceName}.environment`,
              message: `Duplicate environment variable key: ${key}`
            });
          }
          envKeys.add(key);
        }
      }
    }

    // Validate resource limits
    if (service.deploy && typeof service.deploy === 'object') {
      const deploy = service.deploy as Record<string, unknown>;
      if (deploy.resources && typeof deploy.resources === 'object') {
        const resources = deploy.resources as Record<string, unknown>;
        if (resources.limits && typeof resources.limits === 'object') {
          const limits = resources.limits as Record<string, unknown>;
          
          // Validate memory limit format
          if (limits.memory && typeof limits.memory === 'string') {
            if (!/^[0-9]+[kmgKMG]?$/.test(limits.memory)) {
              errors.push({
                field: `services.${serviceName}.deploy.resources.limits.memory`,
                message: 'Memory limit must be a number followed by optional unit (k, m, g)'
              });
            }
          }
          
          // Validate CPU limit format
          if (limits.cpus && typeof limits.cpus === 'string') {
            if (!/^[0-9]+(\.[0-9]+)?$/.test(limits.cpus)) {
              errors.push({
                field: `services.${serviceName}.deploy.resources.limits.cpus`,
                message: 'CPU limit must be a positive number'
              });
            }
          }
        }
      }
    }

    // Validate healthcheck
    if (service.healthcheck && typeof service.healthcheck === 'object') {
      const healthcheck = service.healthcheck as Record<string, unknown>;
      if (!healthcheck.test) {
        errors.push({
          field: `services.${serviceName}.healthcheck`,
          message: 'Healthcheck must specify a test command'
        });
      }
    }

    // Validate logging configuration
    if (service.logging && typeof service.logging === 'object') {
      const logging = service.logging as Record<string, unknown>;
      if (logging.driver && typeof logging.driver === 'string') {
        const supportedDrivers = ['json-file', 'syslog', 'journald', 'gelf', 'fluentd', 'awslogs', 'splunk', 'none'];
        if (!supportedDrivers.includes(logging.driver)) {
          warnings.push({
            field: `services.${serviceName}.logging.driver`,
            message: `Logging driver "${logging.driver}" may not be supported`
          });
        }
      }
    }

    // Validate labels
    if (service.labels && typeof service.labels === 'object') {
      const labels = service.labels as Record<string, unknown>;
      for (const [key, value] of Object.entries(labels)) {
        if (typeof value !== 'string') {
          warnings.push({
            field: `services.${serviceName}.labels`,
            message: `Label "${key}" should have a string value`
          });
        }
      }
    }

    // Validate networks
    if (Array.isArray(service.networks)) {
      for (const network of service.networks) {
        if (typeof network === 'string' && !/^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/.test(network)) {
          errors.push({
            field: `services.${serviceName}.networks`,
            message: `Network name "${network}" must contain only lowercase letters, numbers, underscores, and hyphens`
          });
        }
      }
    }

    // Validate working directory
    if (service.working_dir && typeof service.working_dir === 'string') {
      if (!service.working_dir.startsWith('/')) {
        errors.push({
          field: `services.${serviceName}.working_dir`,
          message: 'Working directory must be an absolute path'
        });
      }
    }

    // Validate user specification
    if (service.user && typeof service.user === 'string') {
      // Warn about running as root
      if (service.user === 'root' || service.user === '0' || service.user.startsWith('0:')) {
        warnings.push({
          field: `services.${serviceName}.user`,
          message: 'Running containers as root poses security risks. Consider using a non-root user.'
        });
      }
    }

    // Validate ports
    if (Array.isArray(service.ports)) {
      for (const port of service.ports) {
        if (typeof port === 'string') {
          // Docker Compose supports various port formats:
          // - "8080" (container port only)
          // - "8080:8080" (host:container)
          // - "127.0.0.1:8080:8080" (ip:host:container)
          // - "8080:8080/tcp" (with protocol)
          // - "8000-8010:8000-8010" (port ranges)
          
          const validPortFormats = [
            /^\d+$/, // "8080"
            /^\d+:\d+$/, // "8080:8080"
            /^\d+:\d+\/(tcp|udp)$/, // "8080:8080/tcp"
            /^[\d.]+:\d+:\d+$/, // "127.0.0.1:8080:8080"
            /^[\d.]+:\d+:\d+\/(tcp|udp)$/, // "127.0.0.1:8080:8080/tcp"
            /^\d+-\d+:\d+-\d+$/, // "8000-8010:8000-8010"
            /^\d+-\d+:\d+-\d+\/(tcp|udp)$/ // "8000-8010:8000-8010/tcp"
          ];
          
          const isValidFormat = validPortFormats.some(regex => regex.test(port));
          if (!isValidFormat) {
            warnings.push({
              field: `services.${serviceName}.ports`,
              message: `Port mapping "${port}" uses invalid format. Use formats like "8080", "8080:8080", "127.0.0.1:8080:8080", or add /tcp or /udp protocol`
            });
          }
        }
      }
    }

    // Validate volumes
    if (Array.isArray(service.volumes)) {
      for (const volume of service.volumes) {
        if (typeof volume === 'string') {
          // Check for relative path traversal
          if (volume.includes('..')) {
            warnings.push({
              field: `services.${serviceName}.volumes`,
              message: `Volume path "${volume}" contains relative path traversal - security risk`
            });
          }
          
          // Check for dangerous system mounts
          const dangerousPaths = [
            '/var/run/docker.sock',
            '/proc',
            '/sys',
            '/dev',
            '/etc',
            '/usr',
            '/bin',
            '/sbin',
            '/boot',
            '/root'
          ];
          
          const volumeParts = volume.split(':');
          const containerPath = volumeParts.length > 1 ? volumeParts[1] : volumeParts[0];
          const isDangerous = dangerousPaths.some(dangerous => 
            containerPath.startsWith(dangerous)
          );
          
          if (isDangerous) {
            warnings.push({
              field: `services.${serviceName}.volumes`,
              message: `Volume mount "${volume}" accesses system path "${containerPath}" - potential security risk`
            });
          }
          
          // Check for writable system mounts
          if (volume.includes(':rw') || (!volume.includes(':ro') && isDangerous)) {
            const isWritable = !volume.includes(':ro');
            if (isWritable && isDangerous) {
              warnings.push({
                field: `services.${serviceName}.volumes`,
                message: `Volume mount "${volume}" provides write access to system path - high security risk`
              });
            }
          }
        }
      }
    }
  }

  private checkPortConflicts(services: Record<string, unknown>, warnings: ValidationWarning[]): void {
    const usedPorts = new Set<string>();
    
    for (const [serviceName, service] of Object.entries(services)) {
      const serviceObj = service as Record<string, unknown>;
      if (Array.isArray(serviceObj.ports)) {
        for (const port of serviceObj.ports) {
          const hostPort = typeof port === 'string' ? port.split(':')[0] : port;
          if (usedPorts.has(hostPort)) {
            warnings.push({
              field: `services.${serviceName}.ports`,
              message: `Port ${hostPort} is already used by another service`
            });
          }
          usedPorts.add(hostPort);
        }
      }
    }
  }

  private validateNetworks(networks: Record<string, unknown>, _errors: ValidationError[], warnings: ValidationWarning[]): void {
    for (const [networkName, network] of Object.entries(networks)) {
      const networkObj = network as Record<string, unknown>;
      if (network && typeof network === 'object' && networkObj.external && !networkObj.name) {
        warnings.push({
          field: `networks.${networkName}`,
          message: 'External network should specify a name'
        });
      }
    }
  }

  private validateVolumes(volumes: Record<string, unknown>, errors: ValidationError[], warnings: ValidationWarning[]): void {
    for (const [volumeName, volume] of Object.entries(volumes)) {
      // Validate volume name format
      if (!/^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/.test(volumeName)) {
        errors.push({
          field: `volumes.${volumeName}`,
          message: 'Volume name must contain only lowercase letters, numbers, underscores, and hyphens'
        });
      }

      const volumeObj = volume as Record<string, unknown>;
      if (volume && typeof volume === 'object') {
        if (volumeObj.external && !volumeObj.name) {
          warnings.push({
            field: `volumes.${volumeName}`,
            message: 'External volume should specify a name'
          });
        }

        // Validate driver
        if (volumeObj.driver && typeof volumeObj.driver === 'string') {
          const supportedDrivers = ['local', 'nfs', 'cifs', 'overlay2', 'tmpfs'];
          if (!supportedDrivers.includes(volumeObj.driver)) {
            warnings.push({
              field: `volumes.${volumeName}.driver`,
              message: `Volume driver "${volumeObj.driver}" may not be supported`
            });
          }
        }
      }
    }
  }

  private validateSecrets(secrets: Record<string, unknown>, errors: ValidationError[], warnings: ValidationWarning[]): void {
    for (const [secretName, secret] of Object.entries(secrets)) {
      // Validate secret name format
      if (!/^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/.test(secretName)) {
        errors.push({
          field: `secrets.${secretName}`,
          message: 'Secret name must contain only lowercase letters, numbers, underscores, and hyphens'
        });
      }

      const secretObj = secret as Record<string, unknown>;
      if (secret && typeof secret === 'object') {
        if (secretObj.external && !secretObj.name) {
          warnings.push({
            field: `secrets.${secretName}`,
            message: 'External secret should specify a name'
          });
        }

        if (secretObj.file && typeof secretObj.file === 'string') {
          // Warn about file-based secrets security
          warnings.push({
            field: `secrets.${secretName}.file`,
            message: 'File-based secrets should have restricted permissions (600 or 400)'
          });
        }
      }
    }
  }

  private validateConfigs(configs: Record<string, unknown>, errors: ValidationError[], warnings: ValidationWarning[]): void {
    for (const [configName, config] of Object.entries(configs)) {
      // Validate config name format
      if (!/^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/.test(configName)) {
        errors.push({
          field: `configs.${configName}`,
          message: 'Config name must contain only lowercase letters, numbers, underscores, and hyphens'
        });
      }

      const configObj = config as Record<string, unknown>;
      if (config && typeof config === 'object') {
        if (configObj.external && !configObj.name) {
          warnings.push({
            field: `configs.${configName}`,
            message: 'External config should specify a name'
          });
        }
      }
    }
  }

}