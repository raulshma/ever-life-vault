import { describe, it, expect } from 'vitest';
import {
  validateDockerComposeConfig,
  validateServiceName,
  validateDockerImage,
  validatePortMapping,
  validateEnvironmentVariable,
  validateVolumeMount,
  validateSecretKey,
  validateSecretValue,
  validateSecretFormData,
  secretKeySchema,
  secretValueSchema,
  secretFormDataSchema,
  secretImportDataSchema,
  secretTemplateSchema
} from '../schemas';

describe('Docker Compose Validation', () => {
  describe('validateServiceName', () => {
    it('should accept valid service names', () => {
      const validNames = ['web', 'api-server', 'db1', 'my-app-v2'];
      
      validNames.forEach(name => {
        const result = validateServiceName(name);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject invalid service names', () => {
      const invalidNames = [
        '', // empty
        'Web', // uppercase
        '-web', // starts with hyphen
        'web-', // ends with hyphen
        'web_server', // underscore
        'localhost', // reserved
        'a'.repeat(64) // too long
      ];

      invalidNames.forEach(name => {
        const result = validateServiceName(name);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('validateDockerImage', () => {
    it('should accept valid Docker images', () => {
      const validImages = [
        'nginx',
        'nginx:latest',
        'nginx:1.21-alpine',
        'registry.com/nginx:latest',
        'localhost:5000/myapp:v1.0',
        'gcr.io/project/image:tag'
      ];

      validImages.forEach(image => {
        const result = validateDockerImage(image);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject invalid Docker images', () => {
      const invalidImages = [
        '', // empty
        'nginx:', // empty tag
        'nginx::', // double colon
      ];

      invalidImages.forEach(image => {
        const result = validateDockerImage(image);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('validatePortMapping', () => {
    it('should accept valid port mappings', () => {
      const validPorts = [
        { host_port: 8080, container_port: 80, protocol: 'tcp' as const },
        { host_port: 3000, container_port: 3000, protocol: 'tcp' as const },
        { host_port: 53, container_port: 53, protocol: 'udp' as const }
      ];

      validPorts.forEach(port => {
        const result = validatePortMapping(port);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject invalid port mappings', () => {
      const invalidPorts = [
        { host_port: 0, container_port: 80, protocol: 'tcp' }, // port 0
        { host_port: 65536, container_port: 80, protocol: 'tcp' }, // port too high
        { host_port: 22, container_port: 22, protocol: 'tcp' }, // SSH port
        { host_port: 80, container_port: 80, protocol: 'http' }, // invalid protocol
        { host_port: 80, container_port: 0, protocol: 'tcp' } // invalid container port
      ];

      invalidPorts.forEach(port => {
        const result = validatePortMapping(port);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('validateEnvironmentVariable', () => {
    it('should accept valid environment variables', () => {
      const validEnvs = [
        { key: 'NODE_ENV', value: 'production', is_secret: false },
        { key: 'API_KEY', value: 'secret123', is_secret: true },
        { key: 'PORT', value: '3000', is_secret: false },
        { key: 'DB_HOST', value: 'localhost', is_secret: false }
      ];

      validEnvs.forEach(env => {
        const result = validateEnvironmentVariable(env);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject invalid environment variables', () => {
      const invalidEnvs = [
        { key: '', value: 'test', is_secret: false }, // empty key
        { key: 'node-env', value: 'production', is_secret: false }, // lowercase with hyphen
        { key: '1NODE_ENV', value: 'production', is_secret: false }, // starts with number
        { key: 'PATH', value: '/usr/bin', is_secret: false }, // system variable
        { key: 'NODE_ENV', value: '', is_secret: false } // empty value
      ];

      invalidEnvs.forEach(env => {
        const result = validateEnvironmentVariable(env);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('validateVolumeMount', () => {
    it('should accept valid volume mounts', () => {
      const validMounts = [
        { host_path: '/host/data', container_path: '/app/data', mode: 'rw' as const },
        { host_path: '/host/config', container_path: '/app/config', mode: 'ro' as const },
        { host_path: 'C:\\host\\data', container_path: '/app/data', mode: 'rw' as const } // Windows path
      ];

      validMounts.forEach(mount => {
        const result = validateVolumeMount(mount);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject invalid volume mounts', () => {
      const invalidMounts = [
        { host_path: '', container_path: '/app/data', mode: 'rw' }, // empty host path
        { host_path: 'relative/path', container_path: '/app/data', mode: 'rw' }, // relative host path
        { host_path: '/host/data', container_path: '', mode: 'rw' }, // empty container path
        { host_path: '/host/data', container_path: 'relative', mode: 'rw' }, // relative container path
        { host_path: '/host/../data', container_path: '/app/data', mode: 'rw' }, // path traversal
        { host_path: '/host/data', container_path: '/app/data', mode: 'invalid' }, // invalid mode

      ];

      invalidMounts.forEach(mount => {
        const result = validateVolumeMount(mount);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('validateDockerComposeConfig', () => {
    it('should accept valid Docker Compose configuration', () => {
      const validConfig = {
        name: 'my-stack',
        description: 'A test stack',
        metadata: {
          services: [
            {
              name: 'web',
              image: 'nginx:latest',
              ports: [{ host_port: 8080, container_port: 80, protocol: 'tcp' as const }],
              environment: [{ key: 'NODE_ENV', value: 'production', is_secret: false }],
              volumes: [{ host_path: '/host/data', container_path: '/app/data', mode: 'rw' as const }],
              depends_on: []
            }
          ],
          volumes: [],
          networks: []
        }
      };

      const result = validateDockerComposeConfig(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject configuration with no services', () => {
      const invalidConfig = {
        name: 'my-stack',
        metadata: {
          services: [],
          volumes: [],
          networks: []
        }
      };

      const result = validateDockerComposeConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect circular dependencies', () => {
      const configWithCircularDeps = {
        name: 'my-stack',
        metadata: {
          services: [
            {
              name: 'web',
              image: 'nginx:latest',
              ports: [],
              environment: [],
              volumes: [],
              depends_on: ['api']
            },
            {
              name: 'api',
              image: 'node:latest',
              ports: [],
              environment: [],
              volumes: [],
              depends_on: ['web'] // Circular dependency
            }
          ],
          volumes: [],
          networks: []
        }
      };

      const result = validateDockerComposeConfig(configWithCircularDeps);
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.message.includes('Circular dependencies'))).toBe(true);
    });

    it('should detect missing service dependencies', () => {
      const configWithMissingDeps = {
        name: 'my-stack',
        metadata: {
          services: [
            {
              name: 'web',
              image: 'nginx:latest',
              ports: [],
              environment: [],
              volumes: [],
              depends_on: ['nonexistent-service']
            }
          ],
          volumes: [],
          networks: []
        }
      };

      const result = validateDockerComposeConfig(configWithMissingDeps);
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.message.includes('non-existent services'))).toBe(true);
    });

    it('should detect duplicate service names', () => {
      const configWithDuplicates = {
        name: 'my-stack',
        metadata: {
          services: [
            {
              name: 'web',
              image: 'nginx:latest',
              ports: [],
              environment: [],
              volumes: [],
              depends_on: []
            },
            {
              name: 'web', // Duplicate name
              image: 'apache:latest',
              ports: [],
              environment: [],
              volumes: [],
              depends_on: []
            }
          ],
          volumes: [],
          networks: []
        }
      };

      const result = validateDockerComposeConfig(configWithDuplicates);
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.message.includes('Duplicate service names'))).toBe(true);
    });

    it('should generate warnings for security best practices', () => {
      const configWithWarnings = {
        name: 'my-stack',
        metadata: {
          services: [
            {
              name: 'web',
              image: 'nginx:latest', // No health check
              ports: [{ host_port: 80, container_port: 80, protocol: 'tcp' as const }], // Privileged port
              environment: [], // No user specified
              volumes: [{ 
                host_path: '/var/run/docker.sock', 
                container_path: '/var/run/docker.sock', 
                mode: 'rw' as const 
              }], // Dangerous mount
              depends_on: []
            }
          ],
          volumes: [],
          networks: []
        }
      };

      const result = validateDockerComposeConfig(configWithWarnings);
      expect(result.valid).toBe(true); // Should be valid but have warnings
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
});

describe('Secret validation schemas', () => {
  describe('secretKeySchema', () => {
    it('should accept valid secret keys', () => {
      const validKeys = ['MY_SECRET', 'DATABASE_URL', 'API_KEY_V2', '_PRIVATE_KEY'];
      
      validKeys.forEach(key => {
        expect(() => secretKeySchema.parse(key)).not.toThrow();
      });
    });

    it('should reject invalid secret keys', () => {
      const invalidKeys = [
        '', // empty
        'my_secret', // lowercase
        '123_SECRET', // starts with number
        'MY-SECRET', // contains hyphen
        'MY SECRET', // contains space
        'PATH', // reserved system variable
        'HOME', // reserved system variable
      ];
      
      invalidKeys.forEach(key => {
        expect(() => secretKeySchema.parse(key)).toThrow();
      });
    });
  });

  describe('secretValueSchema', () => {
    it('should accept valid secret values', () => {
      const validValues = ['password123', 'very-long-secret-value', 'a', 'x'.repeat(10000)];
      
      validValues.forEach(value => {
        expect(() => secretValueSchema.parse(value)).not.toThrow();
      });
    });

    it('should reject invalid secret values', () => {
      const invalidValues = [
        '', // empty
        'x'.repeat(10001), // too long
      ];
      
      invalidValues.forEach(value => {
        expect(() => secretValueSchema.parse(value)).toThrow();
      });
    });
  });

  describe('secretFormDataSchema', () => {
    it('should accept valid secret form data', () => {
      const validData = {
        key: 'MY_SECRET',
        value: 'secret-value',
        description: 'A test secret'
      };
      
      expect(() => secretFormDataSchema.parse(validData)).not.toThrow();
    });

    it('should accept secret form data without description', () => {
      const validData = {
        key: 'MY_SECRET',
        value: 'secret-value'
      };
      
      expect(() => secretFormDataSchema.parse(validData)).not.toThrow();
    });

    it('should reject invalid secret form data', () => {
      const invalidData = [
        { key: '', value: 'secret-value' }, // empty key
        { key: 'MY_SECRET', value: '' }, // empty value
        { key: 'invalid-key', value: 'secret-value' }, // invalid key format
        { key: 'MY_SECRET', value: 'secret-value', description: 'x'.repeat(501) }, // description too long
      ];
      
      invalidData.forEach(data => {
        expect(() => secretFormDataSchema.parse(data)).toThrow();
      });
    });
  });

  describe('secretImportDataSchema', () => {
    it('should accept valid import data', () => {
      const validData = {
        secrets: [
          { key: 'SECRET_1', value: 'value1' },
          { key: 'SECRET_2', value: 'value2', description: 'Test secret' }
        ],
        overwrite_existing: true
      };
      
      expect(() => secretImportDataSchema.parse(validData)).not.toThrow();
    });

    it('should reject import data with duplicate keys', () => {
      const invalidData = {
        secrets: [
          { key: 'SECRET_1', value: 'value1' },
          { key: 'SECRET_1', value: 'value2' } // duplicate key
        ],
        overwrite_existing: false
      };
      
      expect(() => secretImportDataSchema.parse(invalidData)).toThrow();
    });

    it('should reject empty secrets array', () => {
      const invalidData = {
        secrets: [],
        overwrite_existing: false
      };
      
      expect(() => secretImportDataSchema.parse(invalidData)).toThrow();
    });
  });

  describe('secretTemplateSchema', () => {
    it('should accept valid template data', () => {
      const validData = {
        name: 'database-config',
        description: 'Database connection template',
        template: {
          'DATABASE_URL': 'postgresql://user:pass@host:5432/db',
          'DATABASE_PASSWORD': 'secure-password'
        }
      };
      
      expect(() => secretTemplateSchema.parse(validData)).not.toThrow();
    });

    it('should reject template with invalid name', () => {
      const invalidData = {
        name: 'invalid name!', // contains space and special char
        template: { 'SECRET_1': 'value1' }
      };
      
      expect(() => secretTemplateSchema.parse(invalidData)).toThrow();
    });

    it('should reject template with empty template object', () => {
      const invalidData = {
        name: 'valid-name',
        template: {}
      };
      
      expect(() => secretTemplateSchema.parse(invalidData)).toThrow();
    });

    it('should reject template with invalid secret keys', () => {
      const invalidData = {
        name: 'valid-name',
        template: {
          'invalid-key': 'value1' // invalid key format
        }
      };
      
      expect(() => secretTemplateSchema.parse(invalidData)).toThrow();
    });
  });
});

describe('Secret validation functions', () => {
  describe('validateSecretKey', () => {
    it('should return valid result for correct keys', () => {
      const result = validateSecretKey('MY_SECRET');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid result for incorrect keys', () => {
      const result = validateSecretKey('invalid-key');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateSecretValue', () => {
    it('should return valid result for correct values', () => {
      const result = validateSecretValue('secure-password-123');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return warnings for weak values', () => {
      const result = validateSecretValue('weak');
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should return invalid result for empty values', () => {
      const result = validateSecretValue('');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateSecretFormData', () => {
    it('should return valid result for correct form data', () => {
      const data = {
        key: 'MY_SECRET',
        value: 'secure-value',
        description: 'Test secret'
      };
      
      const result = validateSecretFormData(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid result for incorrect form data', () => {
      const data = {
        key: '',
        value: 'secure-value'
      };
      
      const result = validateSecretFormData(data);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});