import { describe, it, expect, beforeEach } from 'vitest';
import { DockerService } from '../services/DockerService.js';

describe('DockerService', () => {
  let dockerService: DockerService;

  beforeEach(() => {
    dockerService = new DockerService();
  });

  describe('validateCompose', () => {
    it('should validate a correct Docker Compose file', async () => {
      const validCompose = `
version: '3.8'
services:
  web:
    image: nginx:latest
    ports:
      - "80:80"
`;

      const result = await dockerService.validateCompose(validCompose);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing services section', async () => {
      const invalidCompose = `
version: '3.8'
networks:
  default:
`;

      const result = await dockerService.validateCompose(invalidCompose);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'services',
        message: 'Docker Compose file must contain a services section'
      });
    });

    it('should detect services without image or build', async () => {
      const invalidCompose = `
version: '3.8'
services:
  web:
    ports:
      - "80:80"
`;

      const result = await dockerService.validateCompose(invalidCompose);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'services.web',
        message: 'Service must specify either image or build'
      });
    });

    it('should detect port conflicts', async () => {
      const conflictCompose = `
version: '3.8'
services:
  web1:
    image: nginx:latest
    ports:
      - "80:80"
  web2:
    image: nginx:latest
    ports:
      - "80:8080"
`;

      const result = await dockerService.validateCompose(conflictCompose);
      
      expect(result.warnings).toContainEqual({
        field: 'services.web2.ports',
        message: 'Port 80 is already used by another service'
      });
    });

    it('should detect dangerous volume mounts', async () => {
      const dangerousCompose = `
version: '3.8'
services:
  web:
    image: nginx:latest
    volumes:
      - "../../../etc:/host-etc"
`;

      const result = await dockerService.validateCompose(dangerousCompose);
      
      expect(result.warnings).toContainEqual({
        field: 'services.web.volumes',
        message: 'Volume path "../../../etc:/host-etc" contains relative path traversal - security risk'
      });
    });

    it('should handle invalid YAML', async () => {
      const invalidYaml = `
version: '3.8'
services:
  web:
    image: nginx:latest
    ports:
      - "80:80
      - "443:443"
`;

      const result = await dockerService.validateCompose(invalidYaml);
      
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('yaml');
      expect(result.errors[0].message).toContain('YAML parsing error');
    });

    it('should handle empty compose content', async () => {
      const result = await dockerService.validateCompose('');
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'root',
        message: 'Empty or invalid YAML content'
      });
    });

    it('should validate port mapping format warnings', async () => {
      const composeWithBadPorts = `
version: '3.8'
services:
  web:
    image: nginx:latest
    ports:
      - "invalid-port"
`;

      const result = await dockerService.validateCompose(composeWithBadPorts);
      
      expect(result.warnings).toContainEqual({
        field: 'services.web.ports',
        message: 'Port mapping "invalid-port" uses invalid format. Use formats like "8080", "8080:8080", "127.0.0.1:8080:8080", or add /tcp or /udp protocol'
      });
    });

    it('should accept valid port mappings with protocols', async () => {
      const composeWithValidPorts = `
version: '3.8'
services:
  web:
    image: nginx:latest
    ports:
      - "8080:8080"
      - "80:80/tcp"
      - "53:53/udp"
`;

      const result = await dockerService.validateCompose(composeWithValidPorts);
      
      // Should have no warnings for valid port mappings
      const portWarnings = result.warnings.filter(w => w.field.includes('ports'));
      expect(portWarnings).toHaveLength(0);
    });

    it('should accept simple port mappings without protocol', async () => {
      const composeWithSimplePorts = `
version: '3.8'
services:
  adminer:
    image: adminer
    ports:
      - "8080:8080"
  db:
    image: postgres
    environment:
      POSTGRES_PASSWORD: example
`;

      const result = await dockerService.validateCompose(composeWithSimplePorts);
      
      // Should have no warnings for valid port mappings
      const portWarnings = result.warnings.filter(w => w.field.includes('ports'));
      expect(portWarnings).toHaveLength(0);
      expect(result.valid).toBe(true);
    });

    it('should detect dangerous volume mounts with enhanced security checks', async () => {
      const dangerousCompose = `
version: '3.8'
services:
  web:
    image: nginx:latest
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:rw"
      - "/etc:/etc"
`;

      const result = await dockerService.validateCompose(dangerousCompose);
      
      expect(result.warnings).toContainEqual({
        field: 'services.web.volumes',
        message: 'Volume mount "/var/run/docker.sock:/var/run/docker.sock:rw" provides write access to system path - high security risk'
      });
      
      expect(result.warnings).toContainEqual({
        field: 'services.web.volumes',
        message: 'Volume mount "/etc:/etc" accesses system path "/etc" - potential security risk'
      });
    });

    it('should accept various valid port formats', async () => {
      const composeWithVariousPorts = `
version: '3.8'
services:
  web:
    image: nginx:latest
    ports:
      - "8080"
      - "80:80"
      - "127.0.0.1:443:443"
      - "53:53/udp"
      - "8000-8010:8000-8010"
`;

      const result = await dockerService.validateCompose(composeWithVariousPorts);
      
      // Should have no warnings for valid port mappings
      const portWarnings = result.warnings.filter(w => w.field.includes('ports') && w.message.includes('invalid format'));
      expect(portWarnings).toHaveLength(0);
      expect(result.valid).toBe(true);
    });

    it('should validate external networks without names', async () => {
      const composeWithExternalNetwork = `
version: '3.8'
services:
  web:
    image: nginx:latest
networks:
  external_net:
    external: true
`;

      const result = await dockerService.validateCompose(composeWithExternalNetwork);
      
      expect(result.warnings).toContainEqual({
        field: 'networks.external_net',
        message: 'External network should specify a name'
      });
    });

    it('should validate external volumes without names', async () => {
      const composeWithExternalVolume = `
version: '3.8'
services:
  web:
    image: nginx:latest
volumes:
  external_vol:
    external: true
`;

      const result = await dockerService.validateCompose(composeWithExternalVolume);
      
      expect(result.warnings).toContainEqual({
        field: 'volumes.external_vol',
        message: 'External volume should specify a name'
      });
    });

    it('should validate comprehensive Docker Compose features', async () => {
      const comprehensiveCompose = `
version: '3.8'
services:
  web:
    image: nginx:1.21
    restart: unless-stopped
    user: "1000:1000"
    working_dir: /app
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost"]
    logging:
      driver: json-file
      options:
        max-size: "10m"
    labels:
      - "traefik.enable=true"
    networks:
      - frontend
    deploy:
      resources:
        limits:
          memory: 512m
          cpus: '0.5'
volumes:
  data:
    driver: local
networks:
  frontend:
    driver: bridge
secrets:
  db_password:
    file: ./db_password.txt
configs:
  nginx_config:
    file: ./nginx.conf
`;

      const result = await dockerService.validateCompose(comprehensiveCompose);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      
      // Should have warnings about file-based secrets
      expect(result.warnings.some(w => w.message.includes('File-based secrets should have restricted permissions'))).toBe(true);
    });

    it('should detect invalid service configurations', async () => {
      const invalidCompose = `
version: '2.0'
services:
  Invalid-Service-Name:
    image: "invalid::image:"
    restart: invalid-policy
    user: root
    working_dir: relative/path
    depends_on:
      - Invalid-Service-Name
    environment:
      - "DUPLICATE_KEY=value1"
      - "DUPLICATE_KEY=value2"
    deploy:
      resources:
        limits:
          memory: invalid
          cpus: not-a-number
volumes:
  Invalid-Volume-Name:
    driver: unsupported-driver
`;

      const result = await dockerService.validateCompose(invalidCompose);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      
      // Check for specific errors
      expect(result.errors.some(e => e.message.includes('Service name must contain only lowercase letters'))).toBe(true);
      expect(result.errors.some(e => e.message.includes('Invalid Docker image format'))).toBe(true);
      expect(result.errors.some(e => e.message.includes('Invalid restart policy'))).toBe(true);
      expect(result.errors.some(e => e.message.includes('Working directory must be an absolute path'))).toBe(true);
      expect(result.errors.some(e => e.message.includes('Service cannot depend on itself'))).toBe(true);
      expect(result.errors.some(e => e.message.includes('Memory limit must be a number'))).toBe(true);
      expect(result.errors.some(e => e.message.includes('CPU limit must be a positive number'))).toBe(true);
      
      // Check for warnings
      expect(result.warnings.some(w => w.message.includes('Docker Compose version 2.0 may not be supported'))).toBe(true);
      expect(result.warnings.some(w => w.message.includes('Running containers as root poses security risks'))).toBe(true);
      expect(result.warnings.some(w => w.message.includes('Duplicate environment variable key'))).toBe(true);
    });
  });
});