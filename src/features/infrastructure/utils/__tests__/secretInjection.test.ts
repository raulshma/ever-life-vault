import { describe, it, expect } from 'vitest';
import {
  findSecretPlaceholders,
  injectSecrets,
  generateSecretInjectionPreview,
  validateSecretPlaceholders,
  escapeSecretValue,
  createTemplateFromCompose,
  extractPotentialSecrets,
  generateEnvFormat,
  parseEnvFormat
} from '../secretInjection';

describe('Secret Injection Utilities', () => {
  describe('findSecretPlaceholders', () => {
    it('should find secret placeholders in compose content', () => {
      const composeContent = `
version: '3.8'
services:
  app:
    environment:
      - DATABASE_URL=\${DATABASE_URL}
      - API_KEY=\${API_KEY}
      - SECRET_TOKEN=\${SECRET_TOKEN}
    command: ["--token", "\${SERVICE_TOKEN}"]
`;
      
      const placeholders = findSecretPlaceholders(composeContent);
      expect(placeholders).toEqual(['DATABASE_URL', 'API_KEY', 'SECRET_TOKEN', 'SERVICE_TOKEN']);
    });

    it('should return empty array when no placeholders found', () => {
      const composeContent = `
version: '3.8'
services:
  app:
    image: nginx:latest
    ports:
      - "80:80"
`;
      
      const placeholders = findSecretPlaceholders(composeContent);
      expect(placeholders).toEqual([]);
    });

    it('should handle duplicate placeholders', () => {
      const composeContent = `
services:
  app1:
    environment:
      - API_KEY=\${API_KEY}
  app2:
    environment:
      - API_KEY=\${API_KEY}
`;
      
      const placeholders = findSecretPlaceholders(composeContent);
      expect(placeholders).toEqual(['API_KEY']);
    });

    it('should only match valid secret key formats', () => {
      const composeContent = `
services:
  app:
    environment:
      - VALID_SECRET=\${VALID_SECRET}
      - invalid=\${invalid-key}
      - number=\${123_INVALID}
`;
      
      const placeholders = findSecretPlaceholders(composeContent);
      expect(placeholders).toEqual(['VALID_SECRET']);
    });
  });

  describe('injectSecrets', () => {
    it('should inject secrets into compose content', () => {
      const composeContent = `
services:
  app:
    environment:
      - DATABASE_URL=\${DATABASE_URL}
      - API_KEY=\${API_KEY}
`;
      
      const secrets = {
        DATABASE_URL: 'postgresql://localhost:5432/mydb',
        API_KEY: 'abc123def456'
      };
      
      const injected = injectSecrets(composeContent, secrets);
      
      expect(injected).toContain('DATABASE_URL=postgresql://localhost:5432/mydb');
      expect(injected).toContain('API_KEY=abc123def456');
      expect(injected).not.toContain('${DATABASE_URL}');
      expect(injected).not.toContain('${API_KEY}');
    });

    it('should handle missing secrets gracefully', () => {
      const composeContent = `
services:
  app:
    environment:
      - DATABASE_URL=\${DATABASE_URL}
      - MISSING_SECRET=\${MISSING_SECRET}
`;
      
      const secrets = {
        DATABASE_URL: 'postgresql://localhost:5432/mydb'
      };
      
      const injected = injectSecrets(composeContent, secrets);
      
      expect(injected).toContain('DATABASE_URL=postgresql://localhost:5432/mydb');
      expect(injected).toContain('${MISSING_SECRET}'); // Should remain as placeholder
    });

    it('should handle special characters in secret values', () => {
      const composeContent = `
services:
  app:
    environment:
      - PASSWORD=\${PASSWORD}
`;
      
      const secrets = {
        PASSWORD: 'p@ssw0rd!#$%'
      };
      
      const injected = injectSecrets(composeContent, secrets);
      expect(injected).toContain('PASSWORD=p@ssw0rd!#$%');
    });
  });

  describe('generateSecretInjectionPreview', () => {
    it('should generate complete preview with all secrets available', () => {
      const composeContent = `
services:
  app:
    environment:
      - DATABASE_URL=\${DATABASE_URL}
      - API_KEY=\${API_KEY}
`;
      
      const secrets = {
        DATABASE_URL: 'postgresql://localhost:5432/mydb',
        API_KEY: 'abc123def456'
      };
      
      const preview = generateSecretInjectionPreview(composeContent, secrets);
      
      expect(preview.original_compose).toBe(composeContent);
      expect(preview.placeholders_found).toEqual(['DATABASE_URL', 'API_KEY']);
      expect(preview.missing_secrets).toEqual([]);
      expect(preview.injected_compose).toContain('DATABASE_URL=postgresql://localhost:5432/mydb');
      expect(preview.injected_compose).toContain('API_KEY=abc123def456');
    });

    it('should identify missing secrets', () => {
      const composeContent = `
services:
  app:
    environment:
      - DATABASE_URL=\${DATABASE_URL}
      - API_KEY=\${API_KEY}
      - MISSING_SECRET=\${MISSING_SECRET}
`;
      
      const secrets = {
        DATABASE_URL: 'postgresql://localhost:5432/mydb',
        API_KEY: 'abc123def456'
      };
      
      const preview = generateSecretInjectionPreview(composeContent, secrets);
      
      expect(preview.placeholders_found).toEqual(['DATABASE_URL', 'API_KEY', 'MISSING_SECRET']);
      expect(preview.missing_secrets).toEqual(['MISSING_SECRET']);
    });
  });

  describe('validateSecretPlaceholders', () => {
    it('should return valid when all secrets are available', () => {
      const composeContent = `
services:
  app:
    environment:
      - DATABASE_URL=\${DATABASE_URL}
      - API_KEY=\${API_KEY}
`;
      
      const secrets = {
        DATABASE_URL: 'postgresql://localhost:5432/mydb',
        API_KEY: 'abc123def456'
      };
      
      const validation = validateSecretPlaceholders(composeContent, secrets);
      
      expect(validation.valid).toBe(true);
      expect(validation.missingSecrets).toEqual([]);
    });

    it('should return invalid when secrets are missing', () => {
      const composeContent = `
services:
  app:
    environment:
      - DATABASE_URL=\${DATABASE_URL}
      - MISSING_SECRET=\${MISSING_SECRET}
`;
      
      const secrets = {
        DATABASE_URL: 'postgresql://localhost:5432/mydb'
      };
      
      const validation = validateSecretPlaceholders(composeContent, secrets);
      
      expect(validation.valid).toBe(false);
      expect(validation.missingSecrets).toEqual(['MISSING_SECRET']);
    });
  });

  describe('escapeSecretValue', () => {
    it('should wrap values with special characters in quotes', () => {
      expect(escapeSecretValue('simple-value')).toBe('simple-value');
      expect(escapeSecretValue('value with spaces')).toBe('"value with spaces"');
      expect(escapeSecretValue('value:with:colons')).toBe('"value:with:colons"');
      expect(escapeSecretValue('value"with"quotes')).toBe('"value\\"with\\"quotes"');
      expect(escapeSecretValue('value#with#hash')).toBe('"value#with#hash"');
    });

    it('should not quote simple alphanumeric values', () => {
      expect(escapeSecretValue('abc123')).toBe('abc123');
      expect(escapeSecretValue('simple_value')).toBe('simple_value');
      expect(escapeSecretValue('value-with-hyphens')).toBe('value-with-hyphens');
    });
  });

  describe('createTemplateFromCompose', () => {
    it('should replace secret values with placeholders', () => {
      const composeContent = `
services:
  app:
    environment:
      - DATABASE_URL=postgresql://localhost:5432/mydb
      - API_KEY=abc123def456
`;
      
      const secretMappings = {
        DATABASE_URL: 'postgresql://localhost:5432/mydb',
        API_KEY: 'abc123def456'
      };
      
      const template = createTemplateFromCompose(composeContent, secretMappings);
      
      expect(template).toContain('DATABASE_URL=${DATABASE_URL}');
      expect(template).toContain('API_KEY=${API_KEY}');
      expect(template).not.toContain('postgresql://localhost:5432/mydb');
      expect(template).not.toContain('abc123def456');
    });

    it('should handle special characters in secret values', () => {
      const composeContent = `
services:
  app:
    environment:
      - PASSWORD=p@ssw0rd!#$%
`;
      
      const secretMappings = {
        PASSWORD: 'p@ssw0rd!#$%'
      };
      
      const template = createTemplateFromCompose(composeContent, secretMappings);
      expect(template).toContain('PASSWORD=${PASSWORD}');
      expect(template).not.toContain('p@ssw0rd!#$%');
    });
  });

  describe('extractPotentialSecrets', () => {
    it('should identify potential secrets based on key patterns', () => {
      const composeContent = `
services:
  app:
    environment:
      - DATABASE_PASSWORD=secret123
      - API_KEY=abc123def456
      - DEBUG=true
      - PORT=3000
      - SECRET_TOKEN=very-long-secret-token-value
`;
      
      const potentialSecrets = extractPotentialSecrets(composeContent);
      
      expect(potentialSecrets).toHaveLength(3);
      expect(potentialSecrets.map(s => s.key)).toContain('DATABASE_PASSWORD');
      expect(potentialSecrets.map(s => s.key)).toContain('API_KEY');
      expect(potentialSecrets.map(s => s.key)).toContain('SECRET_TOKEN');
      expect(potentialSecrets.map(s => s.key)).not.toContain('DEBUG');
      expect(potentialSecrets.map(s => s.key)).not.toContain('PORT');
    });

    it('should identify complex values as potential secrets', () => {
      const composeContent = `
services:
  app:
    environment:
      - SIMPLE_VALUE=test
      - COMPLEX_VALUE=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
`;
      
      const potentialSecrets = extractPotentialSecrets(composeContent);
      
      expect(potentialSecrets).toHaveLength(1);
      expect(potentialSecrets[0].key).toBe('COMPLEX_VALUE');
    });

    it('should provide line numbers and context', () => {
      const composeContent = `services:
  app:
    environment:
      - DATABASE_PASSWORD=secret123`;
      
      const potentialSecrets = extractPotentialSecrets(composeContent);
      
      expect(potentialSecrets).toHaveLength(1);
      expect(potentialSecrets[0].line).toBe(4);
      expect(potentialSecrets[0].context).toBe('- DATABASE_PASSWORD=secret123');
    });
  });

  describe('generateEnvFormat', () => {
    it('should generate .env format from secrets', () => {
      const secrets = {
        DATABASE_URL: 'postgresql://localhost:5432/mydb',
        API_KEY: 'abc123def456',
        PASSWORD: 'p@ssw0rd with spaces'
      };
      
      const envFormat = generateEnvFormat(secrets);
      
      expect(envFormat).toContain('DATABASE_URL="postgresql://localhost:5432/mydb"');
      expect(envFormat).toContain('API_KEY=abc123def456');
      expect(envFormat).toContain('PASSWORD="p@ssw0rd with spaces"');
    });

    it('should handle empty secrets object', () => {
      const secrets = {};
      const envFormat = generateEnvFormat(secrets);
      expect(envFormat).toBe('');
    });
  });

  describe('parseEnvFormat', () => {
    it('should parse .env format into secrets object', () => {
      const envContent = `
# Database configuration
DATABASE_URL=postgresql://localhost:5432/mydb
DATABASE_PASSWORD="secure-password"

# API configuration
API_KEY=abc123def456
API_SECRET='very-secret-key'

# Empty line and comment handling
`;
      
      const secrets = parseEnvFormat(envContent);
      
      expect(secrets).toEqual({
        DATABASE_URL: 'postgresql://localhost:5432/mydb',
        DATABASE_PASSWORD: 'secure-password',
        API_KEY: 'abc123def456',
        API_SECRET: 'very-secret-key'
      });
    });

    it('should handle various quote formats', () => {
      const envContent = `
UNQUOTED=value
DOUBLE_QUOTED="value with spaces"
SINGLE_QUOTED='another value'
MIXED_QUOTES="value with 'inner' quotes"
`;
      
      const secrets = parseEnvFormat(envContent);
      
      expect(secrets).toEqual({
        UNQUOTED: 'value',
        DOUBLE_QUOTED: 'value with spaces',
        SINGLE_QUOTED: 'another value',
        MIXED_QUOTES: "value with 'inner' quotes"
      });
    });

    it('should skip invalid lines', () => {
      const envContent = `
VALID_KEY=valid_value
invalid-key=should_be_skipped
123_INVALID=should_be_skipped
=no_key
VALID_KEY_2=another_valid_value
`;
      
      const secrets = parseEnvFormat(envContent);
      
      expect(secrets).toEqual({
        VALID_KEY: 'valid_value',
        VALID_KEY_2: 'another_valid_value'
      });
    });

    it('should handle empty content', () => {
      const secrets = parseEnvFormat('');
      expect(secrets).toEqual({});
    });
  });
});