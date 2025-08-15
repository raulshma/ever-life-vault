import { describe, it, expect } from 'vitest';
import { 
  parseDockerCommand, 
  importDockerCompose, 
  generateDockerComposeYaml 
} from '../dockerUtils';
import type { DockerComposeConfig } from '../../types';

describe('Docker Utilities', () => {
  describe('parseDockerCommand', () => {
    it('should parse a basic docker run command', () => {
      const command = 'docker run -d --name nginx-web -p 8080:80 nginx:alpine';
      const result = parseDockerCommand(command);
      
      expect(result.success).toBe(true);
      expect(result.composeConfig).toBeDefined();
      expect(result.composeConfig?.metadata?.services).toHaveLength(1);
      
      const service = result.composeConfig?.metadata?.services[0];
      expect(service?.name).toBe('nginx-web');
      expect(service?.image).toBe('nginx:alpine');
      expect(service?.ports).toHaveLength(1);
      expect(service?.ports[0]).toEqual({
        host_port: 8080,
        container_port: 80,
        protocol: 'tcp'
      });
    });

    it('should parse a complex docker run command with volumes and environment', () => {
      const command = 'docker run -d --name web-app -p 3000:3000 -v /host/path:/app/data:ro -e NODE_ENV=production -e PORT=3000 --restart unless-stopped node:16-alpine npm start';
      const result = parseDockerCommand(command);
      
      expect(result.success).toBe(true);
      expect(result.composeConfig?.metadata?.services).toHaveLength(1);
      
      const service = result.composeConfig?.metadata?.services[0];
      expect(service?.name).toBe('web-app');
      expect(service?.image).toBe('node:16-alpine');
      expect(service?.ports).toHaveLength(1);
      expect(service?.volumes).toHaveLength(1);
      expect(service?.environment).toHaveLength(2);
      expect(service?.restart_policy).toBe('unless-stopped');
      expect(service?.command).toBe('npm start');
    });

    it('should handle port mappings with protocols', () => {
      const command = 'docker run -p 8080:80/tcp -p 8443:443/udp nginx:alpine';
      const result = parseDockerCommand(command);
      
      expect(result.success).toBe(true);
      const service = result.composeConfig?.metadata?.services[0];
      expect(service?.ports).toHaveLength(2);
      expect(service?.ports[0].protocol).toBe('tcp');
      expect(service?.ports[1].protocol).toBe('udp');
    });

    it('should reject non-docker run commands', () => {
      const command = 'docker ps';
      const result = parseDockerCommand(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('must start with "docker run"');
    });

    it('should reject commands without image', () => {
      const command = 'docker run -d --name test';
      const result = parseDockerCommand(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No image specified');
    });
  });

  describe('importDockerCompose', () => {
    it('should accept valid docker compose content', () => {
      const yaml = `version: '3.8'
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"`;
      
      const result = importDockerCompose(yaml);
      
      expect(result.success).toBe(true);
      expect(result.composeConfig).toBeDefined();
    });

    it('should parse services correctly from docker compose', () => {
      const yaml = `version: '3.8'
name: test-stack
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
    environment:
      - NGINX_HOST=example.com
    volumes:
      - ./html:/var/www/html:ro
    restart: unless-stopped
  
  db:
    image: postgres:13
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_PASSWORD=secret
      - POSTGRES_DB=myapp

volumes:
  postgres_data:

networks:
  app_network:`;
      
      const result = importDockerCompose(yaml);
      
      expect(result.success).toBe(true);
      expect(result.composeConfig).toBeDefined();
      expect(result.composeConfig?.name).toBe('test-stack');
      expect(result.composeConfig?.metadata?.services).toHaveLength(2);
      expect(result.composeConfig?.metadata?.volumes).toHaveLength(1);
      expect(result.composeConfig?.metadata?.networks).toHaveLength(1);
      
      // Check first service
      const webService = result.composeConfig?.metadata?.services?.[0];
      expect(webService?.name).toBe('web');
      expect(webService?.image).toBe('nginx:alpine');
      expect(webService?.ports).toHaveLength(1);
      expect(webService?.ports?.[0]).toEqual({
        host_port: 8080,
        container_port: 80,
        protocol: 'tcp'
      });
      expect(webService?.environment).toHaveLength(1);
      expect(webService?.volumes).toHaveLength(1);
      expect(webService?.restart_policy).toBe('unless-stopped');
      
      // Check second service
      const dbService = result.composeConfig?.metadata?.services?.[1];
      expect(dbService?.name).toBe('db');
      expect(dbService?.image).toBe('postgres:13');
      expect(dbService?.environment).toHaveLength(2);
    });

    it('should reject empty content', () => {
      const result = importDockerCompose('');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Empty YAML content');
    });

    it('should reject invalid format', () => {
      const invalidYaml = 'invalid: yaml: content';
      const result = importDockerCompose(invalidYaml);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid Docker Compose format');
    });
  });

  describe('generateDockerComposeYaml', () => {
    it('should generate valid YAML from configuration', () => {
      const config: Partial<DockerComposeConfig> = {
        name: 'test-stack',
        metadata: {
          services: [{
            name: 'web',
            image: 'nginx:alpine',
            ports: [{
              host_port: 8080,
              container_port: 80,
              protocol: 'tcp'
            }],
            environment: [],
            volumes: [],
            depends_on: [],
            restart_policy: 'unless-stopped',
            memory_limit: '512m',
            cpu_limit: '0.5'
          }],
          volumes: [],
          networks: []
        }
      };
      
      const yaml = generateDockerComposeYaml(config);
      
      expect(yaml).toContain('version: \'3.8\'');
      expect(yaml).toContain('name: test-stack');
      expect(yaml).toContain('services:');
      expect(yaml).toContain('web:');
      expect(yaml).toContain('image: nginx:alpine');
      expect(yaml).toContain('"8080:80"');
    });

    it('should handle empty configuration gracefully', () => {
      const config: Partial<DockerComposeConfig> = {
        metadata: {
          services: [],
          volumes: [],
          networks: []
        }
      };
      
      const yaml = generateDockerComposeYaml(config);
      expect(yaml).toBe('');
    });

    it('should include resource limits when specified', () => {
      const config: Partial<DockerComposeConfig> = {
        metadata: {
          services: [{
            name: 'app',
            image: 'node:16',
            ports: [],
            environment: [],
            volumes: [],
            depends_on: [],
            restart_policy: 'unless-stopped',
            memory_limit: '1g',
            cpu_limit: '2.0'
          }],
          volumes: [],
          networks: []
        }
      };
      
      const yaml = generateDockerComposeYaml(config);
      
      expect(yaml).toContain('memory: 1g');
      expect(yaml).toContain("cpus: '2.0'");
    });
  });
});
