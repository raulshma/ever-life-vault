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
      const parsed = yaml.load(composeContent) as any;
      
      if (!parsed) {
        errors.push({
          field: 'root',
          message: 'Empty or invalid YAML content'
        });
        return { valid: false, errors, warnings };
      }

      // Validate Docker Compose structure
      if (!parsed.services) {
        errors.push({
          field: 'services',
          message: 'Docker Compose file must contain a services section'
        });
      } else {
        // Validate each service
        for (const [serviceName, service] of Object.entries(parsed.services as Record<string, any>)) {
          this.validateService(serviceName, service, errors, warnings);
        }
      }

      // Check for port conflicts
      this.checkPortConflicts(parsed.services || {}, warnings);

      // Validate networks if present
      if (parsed.networks) {
        this.validateNetworks(parsed.networks, errors, warnings);
      }

      // Validate volumes if present
      if (parsed.volumes) {
        this.validateVolumes(parsed.volumes, errors, warnings);
      }

    } catch (yamlError: any) {
      errors.push({
        field: 'yaml',
        message: `YAML parsing error: ${yamlError.message}`,
        line: yamlError.mark?.line,
        column: yamlError.mark?.column
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }



  // Private helper methods

  private validateService(serviceName: string, service: any, errors: ValidationError[], warnings: ValidationWarning[]): void {
    if (!service.image && !service.build) {
      errors.push({
        field: `services.${serviceName}`,
        message: 'Service must specify either image or build'
      });
    }

    // Validate ports
    if (service.ports) {
      for (const port of service.ports) {
        if (typeof port === 'string') {
          // Docker Compose port format: "host:container" or "host:container/protocol"
          // Examples: "8080:8080", "80:80/tcp", "53:53/udp"
          const portMatch = port.match(/^(\d+):(\d+)(?:\/(tcp|udp))?$/);
          if (!portMatch) {
            warnings.push({
              field: `services.${serviceName}.ports`,
              message: `Port mapping "${port}" should use format "host:container" or "host:container/protocol"`
            });
          }
        }
      }
    }

    // Validate volumes
    if (service.volumes) {
      for (const volume of service.volumes) {
        if (typeof volume === 'string' && volume.includes('..')) {
          warnings.push({
            field: `services.${serviceName}.volumes`,
            message: `Volume path "${volume}" contains relative path traversal`
          });
        }
      }
    }
  }

  private checkPortConflicts(services: Record<string, any>, warnings: ValidationWarning[]): void {
    const usedPorts = new Set<string>();
    
    for (const [serviceName, service] of Object.entries(services)) {
      if (service.ports) {
        for (const port of service.ports) {
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

  private validateNetworks(networks: Record<string, any>, errors: ValidationError[], warnings: ValidationWarning[]): void {
    for (const [networkName, network] of Object.entries(networks)) {
      if (network && typeof network === 'object' && network.external && !network.name) {
        warnings.push({
          field: `networks.${networkName}`,
          message: 'External network should specify a name'
        });
      }
    }
  }

  private validateVolumes(volumes: Record<string, any>, errors: ValidationError[], warnings: ValidationWarning[]): void {
    for (const [volumeName, volume] of Object.entries(volumes)) {
      if (volume && typeof volume === 'object' && volume.external && !volume.name) {
        warnings.push({
          field: `volumes.${volumeName}`,
          message: 'External volume should specify a name'
        });
      }
    }
  }


}