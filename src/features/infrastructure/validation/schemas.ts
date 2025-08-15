import { z } from 'zod';

// Port validation schema
export const portMappingSchema = z.object({
  host_port: z.number()
    .min(1, 'Host port must be at least 1')
    .max(65535, 'Host port must be at most 65535')
    .refine((port) => port !== 22, 'Port 22 (SSH) is reserved and should not be exposed'),
  container_port: z.number()
    .min(1, 'Container port must be at least 1')
    .max(65535, 'Container port must be at most 65535'),
  protocol: z.enum(['tcp', 'udp'], {
    errorMap: () => ({ message: 'Protocol must be either tcp or udp' })
  })
});

// Environment variable validation schema
export const environmentVariableSchema = z.object({
  key: z.string()
    .min(1, 'Environment variable key is required')
    .regex(/^[A-Z_][A-Z0-9_]*$/, 'Environment variable key must contain only uppercase letters, numbers, and underscores, and start with a letter or underscore')
    .refine((key) => !['PATH', 'HOME', 'USER', 'SHELL'].includes(key), 'Cannot override system environment variables'),
  value: z.string()
    .min(1, 'Environment variable value is required'),
  is_secret: z.boolean()
});

// Volume mount validation schema
export const volumeMountSchema = z.object({
  host_path: z.string()
    .min(1, 'Host path is required')
    .refine((path) => path.startsWith('/') || /^[A-Za-z]:\\/.test(path), 'Host path must be an absolute path')
    .refine((path) => !path.includes('..'), 'Host path cannot contain relative path components (..)'),
  container_path: z.string()
    .min(1, 'Container path is required')
    .refine((path) => path.startsWith('/'), 'Container path must be an absolute path')
    .refine((path) => !path.includes('..'), 'Container path cannot contain relative path components (..)'),
  mode: z.enum(['ro', 'rw'], {
    errorMap: () => ({ message: 'Mount mode must be either ro (read-only) or rw (read-write)' })
  }),
  uid: z.number().min(0).max(65535).optional(),
  gid: z.number().min(0).max(65535).optional(),
  permissions: z.string().regex(/^[0-7]{3,4}$/, 'Permissions must be in octal format (e.g., 755, 0644)').optional()
});

// Service definition validation schema
export const serviceDefinitionSchema = z.object({
  name: z.string()
    .min(1, 'Service name is required')
    .max(63, 'Service name must be 63 characters or less')
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Service name must contain only lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen')
    .refine((name) => !['localhost', 'host', 'gateway'].includes(name), 'Service name cannot be a reserved hostname'),
  image: z.string()
    .min(1, 'Docker image is required')
    .refine((image) => {
      // Very basic validation - just check it's not empty and doesn't have obvious issues
      return image.trim().length > 0 && !image.includes('::') && !image.endsWith(':');
    }, 'Invalid Docker image format'),
  ports: z.array(portMappingSchema)
    .refine((ports) => {
      // Check for duplicate host ports
      const hostPorts = ports.map(p => p.host_port);
      return hostPorts.length === new Set(hostPorts).size;
    }, 'Duplicate host ports are not allowed'),
  environment: z.array(environmentVariableSchema)
    .refine((envs) => {
      // Check for duplicate environment variable keys
      const keys = envs.map(e => e.key);
      return keys.length === new Set(keys).size;
    }, 'Duplicate environment variable keys are not allowed'),
  volumes: z.array(volumeMountSchema)
    .refine((volumes) => {
      // Check for duplicate container paths
      const containerPaths = volumes.map(v => v.container_path);
      return containerPaths.length === new Set(containerPaths).size;
    }, 'Duplicate container paths are not allowed'),
  depends_on: z.array(z.string()).optional()
});

// Volume definition validation schema
export const volumeDefinitionSchema = z.object({
  name: z.string()
    .min(1, 'Volume name is required')
    .max(63, 'Volume name must be 63 characters or less')
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Volume name must contain only lowercase letters, numbers, and hyphens'),
  driver: z.string()
    .min(1, 'Volume driver is required')
    .refine((driver) => ['local', 'nfs', 'cifs', 'overlay2', 'tmpfs'].includes(driver), 'Unsupported volume driver'),
  driver_opts: z.record(z.string(), z.string()).optional()
});

// Network definition validation schema
export const networkDefinitionSchema = z.object({
  name: z.string()
    .min(1, 'Network name is required')
    .max(63, 'Network name must be 63 characters or less')
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Network name must contain only lowercase letters, numbers, and hyphens'),
  driver: z.string()
    .min(1, 'Network driver is required')
    .refine((driver) => ['bridge', 'host', 'overlay', 'macvlan', 'ipvlan', 'none'].includes(driver), 'Unsupported network driver'),
  driver_opts: z.record(z.string(), z.string()).optional()
});

// Docker Compose configuration validation schema
export const dockerComposeConfigSchema = z.object({
  name: z.string()
    .min(1, 'Configuration name is required')
    .max(63, 'Configuration name must be 63 characters or less')
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'Configuration name must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  metadata: z.object({
    services: z.array(serviceDefinitionSchema)
      .min(1, 'At least one service is required')
      .refine((services) => {
        // Check for duplicate service names
        const names = services.map(s => s.name);
        return names.length === new Set(names).size;
      }, 'Duplicate service names are not allowed')
      .refine((services) => {
        // Check for circular dependencies
        const checkCircularDeps = (serviceName: string, visited: Set<string>, path: Set<string>): boolean => {
          if (path.has(serviceName)) return true; // Circular dependency found
          if (visited.has(serviceName)) return false; // Already processed
          
          visited.add(serviceName);
          path.add(serviceName);
          
          const service = services.find(s => s.name === serviceName);
          if (service?.depends_on) {
            for (const dep of service.depends_on) {
              if (checkCircularDeps(dep, visited, path)) return true;
            }
          }
          
          path.delete(serviceName);
          return false;
        };
        
        const visited = new Set<string>();
        for (const service of services) {
          if (checkCircularDeps(service.name, visited, new Set())) {
            return false;
          }
        }
        return true;
      }, 'Circular dependencies detected between services')
      .refine((services) => {
        // Check that all dependencies exist
        const serviceNames = new Set(services.map(s => s.name));
        for (const service of services) {
          if (service.depends_on) {
            for (const dep of service.depends_on) {
              if (!serviceNames.has(dep)) {
                return false;
              }
            }
          }
        }
        return true;
      }, 'Some service dependencies reference non-existent services'),
    volumes: z.array(volumeDefinitionSchema)
      .refine((volumes) => {
        // Check for duplicate volume names
        const names = volumes.map(v => v.name);
        return names.length === new Set(names).size;
      }, 'Duplicate volume names are not allowed'),
    networks: z.array(networkDefinitionSchema)
      .refine((networks) => {
        // Check for duplicate network names
        const names = networks.map(n => n.name);
        return names.length === new Set(names).size;
      }, 'Duplicate network names are not allowed')
  })
});

// Validation result types
export type ValidationError = {
  field: string;
  message: string;
  path?: string[];
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
};

export type ValidationWarning = {
  field: string;
  message: string;
  path?: string[];
};

// Helper function to convert Zod errors to our format
export function formatZodErrors(error: z.ZodError): ValidationError[] {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    path: err.path.map(String)
  }));
}

// Validation function for Docker Compose configurations
export function validateDockerComposeConfig(config: any): ValidationResult {
  const warnings: ValidationWarning[] = [];
  
  try {
    const result = dockerComposeConfigSchema.parse(config);
    
    // Add warnings for best practices
    if (result.metadata.services) {
      result.metadata.services.forEach((service, serviceIndex) => {
        // Warn about missing health checks
        if (!service.image.includes('healthcheck')) {
          warnings.push({
            field: `metadata.services.${serviceIndex}.image`,
            message: 'Consider adding health checks to your service for better monitoring',
            path: ['metadata', 'services', serviceIndex.toString(), 'image']
          });
        }
        
        // Warn about running as root
        if (!service.environment.some(env => env.key === 'USER' || env.key === 'UID')) {
          warnings.push({
            field: `metadata.services.${serviceIndex}.environment`,
            message: 'Consider setting a non-root user for better security',
            path: ['metadata', 'services', serviceIndex.toString(), 'environment']
          });
        }
        
        // Warn about exposed privileged ports
        service.ports.forEach((port, portIndex) => {
          if (port.host_port < 1024) {
            warnings.push({
              field: `metadata.services.${serviceIndex}.ports.${portIndex}.host_port`,
              message: 'Exposing privileged ports (< 1024) requires root privileges',
              path: ['metadata', 'services', serviceIndex.toString(), 'ports', portIndex.toString(), 'host_port']
            });
          }
        });
        
        // Warn about writable system mounts
        service.volumes.forEach((volume, volumeIndex) => {
          if (volume.mode === 'rw' && ['/var/run/docker.sock', '/proc', '/sys'].some(dangerous => volume.container_path.startsWith(dangerous))) {
            warnings.push({
              field: `metadata.services.${serviceIndex}.volumes.${volumeIndex}.container_path`,
              message: 'Mounting system paths with write access poses security risks',
              path: ['metadata', 'services', serviceIndex.toString(), 'volumes', volumeIndex.toString(), 'container_path']
            });
          }
        });
      });
    }
    
    return {
      valid: true,
      errors: [],
      warnings
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: formatZodErrors(error),
        warnings
      };
    }
    
    return {
      valid: false,
      errors: [{
        field: 'unknown',
        message: 'An unexpected validation error occurred'
      }],
      warnings
    };
  }
}

// Individual field validation functions
export function validateServiceName(name: string): ValidationResult {
  try {
    serviceDefinitionSchema.shape.name.parse(name);
    return { valid: true, errors: [], warnings: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: formatZodErrors(error),
        warnings: []
      };
    }
    return {
      valid: false,
      errors: [{ field: 'name', message: 'Invalid service name' }],
      warnings: []
    };
  }
}

export function validateDockerImage(image: string): ValidationResult {
  try {
    serviceDefinitionSchema.shape.image.parse(image);
    return { valid: true, errors: [], warnings: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: formatZodErrors(error),
        warnings: []
      };
    }
    return {
      valid: false,
      errors: [{ field: 'image', message: 'Invalid Docker image' }],
      warnings: []
    };
  }
}

export function validatePortMapping(port: any): ValidationResult {
  try {
    portMappingSchema.parse(port);
    return { valid: true, errors: [], warnings: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: formatZodErrors(error),
        warnings: []
      };
    }
    return {
      valid: false,
      errors: [{ field: 'port', message: 'Invalid port mapping' }],
      warnings: []
    };
  }
}

export function validateEnvironmentVariable(env: any): ValidationResult {
  try {
    environmentVariableSchema.parse(env);
    return { valid: true, errors: [], warnings: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: formatZodErrors(error),
        warnings: []
      };
    }
    return {
      valid: false,
      errors: [{ field: 'environment', message: 'Invalid environment variable' }],
      warnings: []
    };
  }
}

export function validateVolumeMount(volume: any): ValidationResult {
  try {
    volumeMountSchema.parse(volume);
    return { valid: true, errors: [], warnings: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: formatZodErrors(error),
        warnings: []
      };
    }
    return {
      valid: false,
      errors: [{ field: 'volume', message: 'Invalid volume mount' }],
      warnings: []
    };
  }
}

// Secret validation schemas
export const secretKeySchema = z.string()
  .min(1, 'Secret key is required')
  .max(255, 'Secret key must be 255 characters or less')
  .regex(/^[A-Z_][A-Z0-9_]*$/, 'Secret key must contain only uppercase letters, numbers, and underscores, and start with a letter or underscore')
  .refine((key) => !['PATH', 'HOME', 'USER', 'SHELL', 'PWD', 'OLDPWD'].includes(key), 'Cannot use reserved system environment variable names');

export const secretValueSchema = z.string()
  .min(1, 'Secret value is required')
  .max(10000, 'Secret value must be 10000 characters or less');

export const secretFormDataSchema = z.object({
  key: secretKeySchema,
  value: secretValueSchema,
  description: z.string().max(500, 'Description must be 500 characters or less').optional()
});

export const secretImportDataSchema = z.object({
  secrets: z.array(secretFormDataSchema)
    .min(1, 'At least one secret is required for import')
    .refine((secrets) => {
      // Check for duplicate keys
      const keys = secrets.map(s => s.key);
      return keys.length === new Set(keys).size;
    }, 'Duplicate secret keys are not allowed'),
  overwrite_existing: z.boolean()
});

export const secretTemplateSchema = z.object({
  name: z.string()
    .min(1, 'Template name is required')
    .max(100, 'Template name must be 100 characters or less')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Template name must contain only letters, numbers, underscores, and hyphens'),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
  template: z.record(z.string(), z.string())
    .refine((template) => Object.keys(template).length > 0, 'Template must contain at least one key-value pair')
    .refine((template) => {
      // Validate all keys follow secret key naming convention
      return Object.keys(template).every(key => secretKeySchema.safeParse(key).success);
    }, 'All template keys must follow secret naming conventions')
});

// Secret validation functions
export function validateSecretKey(key: string): ValidationResult {
  try {
    secretKeySchema.parse(key);
    return { valid: true, errors: [], warnings: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: formatZodErrors(error),
        warnings: []
      };
    }
    return {
      valid: false,
      errors: [{ field: 'key', message: 'Invalid secret key' }],
      warnings: []
    };
  }
}

export function validateSecretValue(value: string): ValidationResult {
  const warnings: ValidationWarning[] = [];
  
  try {
    secretValueSchema.parse(value);
    
    // Add warnings for security best practices
    if (value.length < 8) {
      warnings.push({
        field: 'value',
        message: 'Consider using longer values for better security',
        path: ['value']
      });
    }
    
    if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/[0-9]/.test(value)) {
      warnings.push({
        field: 'value',
        message: 'Consider using a mix of uppercase, lowercase, and numbers for better security',
        path: ['value']
      });
    }
    
    return { valid: true, errors: [], warnings };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: formatZodErrors(error),
        warnings
      };
    }
    return {
      valid: false,
      errors: [{ field: 'value', message: 'Invalid secret value' }],
      warnings
    };
  }
}

export function validateSecretFormData(data: any): ValidationResult {
  try {
    secretFormDataSchema.parse(data);
    return { valid: true, errors: [], warnings: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: formatZodErrors(error),
        warnings: []
      };
    }
    return {
      valid: false,
      errors: [{ field: 'secret', message: 'Invalid secret data' }],
      warnings: []
    };
  }
}