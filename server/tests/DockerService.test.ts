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
        message: 'Volume path "../../../etc:/host-etc" contains relative path traversal'
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
        message: 'Port mapping "invalid-port" should use format "host:container"'
      });
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
  });
});