import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BackupService } from '../services/BackupService.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { BackupData, DockerComposeConfig } from '../../src/features/infrastructure/types.js'

// Mock external dependencies
vi.mock('../services/DockerService.js')
vi.mock('../services/SecretsService.js')
vi.mock('../services/FileSystemService.js')

const mockDockerService = {
  validateCompose: vi.fn(() => Promise.resolve({ valid: true, errors: [], warnings: [] }))
}

const mockSecretsService = {
  listSecretKeys: vi.fn(() => Promise.resolve(['TEST_SECRET_1', 'TEST_SECRET_2'])),
  retrieveSecret: vi.fn(() => Promise.resolve(null)),
  storeSecret: vi.fn(() => Promise.resolve()),
  deleteSecret: vi.fn(() => Promise.resolve())
}

const mockFileSystemService = {
  validatePath: vi.fn(),
  createDirectory: vi.fn(),
  setPermissions: vi.fn(),
  checkPermissions: vi.fn()
}

// Mock the service constructors
vi.mock('../services/DockerService.js', () => ({
  DockerService: vi.fn(() => mockDockerService)
}))

vi.mock('../services/SecretsService.js', () => ({
  SecretsService: vi.fn(() => mockSecretsService)
}))

vi.mock('../services/FileSystemService.js', () => ({
  FileSystemService: vi.fn(() => mockFileSystemService)
}))

// Create a more flexible mock that can handle chaining
const createMockSupabaseQuery = (finalResult: any) => {
  const mockQuery = {
    select: vi.fn(() => mockQuery),
    eq: vi.fn(() => mockQuery),
    in: vi.fn(() => mockQuery),
    order: vi.fn(() => finalResult),
    single: vi.fn(() => finalResult),
    insert: vi.fn(() => finalResult),
    update: vi.fn(() => mockQuery),
    delete: vi.fn(() => mockQuery),
    ...finalResult
  }
  return mockQuery
}

const mockSupabase = {
  from: vi.fn()
} as unknown as SupabaseClient

describe('Backup Integration Tests', () => {
  let backupService: BackupService
  const userId = 'test-user-id'
  const supabaseUrl = 'https://test.supabase.co'
  const supabaseAnonKey = 'test-anon-key'

  const mockConfigurations: DockerComposeConfig[] = [
    {
      id: 'config-1',
      user_id: 'test-user-id',
      name: 'nginx-config',
      description: 'Nginx web server configuration',
      compose_content: `version: "3.8"
services:
  nginx:
    image: nginx:latest
    ports:
      - "80:80"
    environment:
      - NGINX_HOST=\${NGINX_HOST}
    volumes:
      - ./html:/usr/share/nginx/html`,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      metadata: {
        services: [{
          name: 'nginx',
          image: 'nginx:latest',
          ports: [{ host_port: 80, container_port: 80, protocol: 'tcp' }],
          environment: [{ key: 'NGINX_HOST', value: '${NGINX_HOST}', is_secret: false }],
          volumes: [{ host_path: './html', container_path: '/usr/share/nginx/html', mode: 'rw' }]
        }],
        volumes: [],
        networks: []
      }
    },
    {
      id: 'config-2',
      user_id: 'test-user-id',
      name: 'postgres-config',
      description: 'PostgreSQL database configuration',
      compose_content: `version: "3.8"
services:
  postgres:
    image: postgres:13
    environment:
      - POSTGRES_DB=\${DB_NAME}
      - POSTGRES_USER=\${DB_USER}
      - POSTGRES_PASSWORD=\${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
volumes:
  postgres_data:`,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      metadata: {
        services: [{
          name: 'postgres',
          image: 'postgres:13',
          ports: [],
          environment: [
            { key: 'POSTGRES_DB', value: '${DB_NAME}', is_secret: false },
            { key: 'POSTGRES_USER', value: '${DB_USER}', is_secret: false },
            { key: 'POSTGRES_PASSWORD', value: '${DB_PASSWORD}', is_secret: true }
          ],
          volumes: [{ host_path: 'postgres_data', container_path: '/var/lib/postgresql/data', mode: 'rw' }]
        }],
        volumes: [{ name: 'postgres_data' }],
        networks: []
      }
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    backupService = new BackupService(mockSupabase, supabaseUrl, supabaseAnonKey)
  })

  describe('Complete Backup/Restore Workflow', () => {
    it('should export and import a complete backup successfully', async () => {
      // Step 1: Export backup
      const mockQuery = createMockSupabaseQuery({ data: mockConfigurations, error: null })
      mockSupabase.from = vi.fn(() => mockQuery)
      mockSecretsService.listSecretKeys.mockResolvedValue(['TEST_SECRET_1', 'TEST_SECRET_2'])

      const backupData = await backupService.exportBackup(userId, {
        include_secrets: true,
        format: 'json'
      })
      
      // Verify backup structure
      expect(backupData.version).toBe('1.0.0')
      expect(backupData.configurations).toHaveLength(2)
      expect(backupData.secrets).toHaveLength(2)
      expect(backupData.metadata.total_configs).toBe(2)
      expect(backupData.metadata.total_secrets).toBe(2)
      expect(backupData.metadata.export_type).toBe('full')

      // Step 2: Validate backup
      const backupString = JSON.stringify(backupData)
      const validation = await backupService.validateBackup(backupString)
      
      expect(validation.valid).toBe(true)
      expect(validation.format).toBe('json')
      expect(validation.errors).toHaveLength(0)

      // Step 3: Import backup
      // Mock import queries
      const importMockQuery = createMockSupabaseQuery({ data: null, error: { code: 'PGRST116' } })
      importMockQuery.insert = vi.fn(() => ({ error: null }))
      mockSupabase.from = vi.fn(() => importMockQuery)
      mockSecretsService.retrieveSecret.mockResolvedValue(null)
      mockSecretsService.storeSecret.mockResolvedValue(undefined)

      const importResult = await backupService.importBackup(userId, backupData, {
        overwrite_existing: false
      })

      expect(importResult.success).toBe(true)
      expect(importResult.imported_configs).toBe(2)
      expect(importResult.imported_secrets).toBe(2)
      expect(importResult.errors).toHaveLength(0)
    })

    it('should handle selective backup and restore', async () => {
      // Export selective backup
      const mockQuery = createMockSupabaseQuery({ data: [mockConfigurations[0]], error: null })
      mockSupabase.from = vi.fn(() => mockQuery)

      const backupData = await backupService.exportBackup(userId, {
        config_ids: ['config-1'],
        include_secrets: false,
        format: 'json'
      })
      
      expect(backupData.configurations).toHaveLength(1)
      expect(backupData.configurations[0].id).toBe('config-1')
      expect(backupData.secrets).toHaveLength(0)
      expect(backupData.metadata.export_type).toBe('selective')

      // Import with selective restore
      const importMockQuery = createMockSupabaseQuery({ data: null, error: { code: 'PGRST116' } })
      importMockQuery.insert = vi.fn(() => ({ error: null }))
      mockSupabase.from = vi.fn(() => importMockQuery)

      const importResult = await backupService.importBackup(userId, backupData, {
        overwrite_existing: false,
        selective_restore: {
          config_ids: ['config-1']
        }
      })

      expect(importResult.success).toBe(true)
      expect(importResult.imported_configs).toBe(1)
    })

    it('should handle YAML format backup and restore', async () => {
      // Export YAML backup
      const mockQuery = createMockSupabaseQuery({ data: mockConfigurations, error: null })
      mockSupabase.from = vi.fn(() => mockQuery)

      const backupData = await backupService.exportBackup(userId, {
        include_secrets: false,
        format: 'yaml'
      })
      
      const yamlContent = await backupService.formatAsYaml(backupData)
      expect(yamlContent).toContain('version: 1.0.0')
      expect(yamlContent).toContain('configurations:')

      // Validate YAML backup
      const validation = await backupService.validateBackup(yamlContent)
      expect(validation.valid).toBe(true)
      expect(validation.format).toBe('yaml')

      // Import YAML backup
      const importMockQuery = createMockSupabaseQuery({ data: null, error: { code: 'PGRST116' } })
      importMockQuery.insert = vi.fn(() => ({ error: null }))
      mockSupabase.from = vi.fn(() => importMockQuery)

      const importResult = await backupService.importBackup(userId, backupData, {
        overwrite_existing: false
      })

      expect(importResult.success).toBe(true)
    })

    it('should handle version compatibility checking', async () => {
      const incompatibleBackup = {
        version: '2.0.0',
        created_at: '2024-01-01T00:00:00Z',
        configurations: [],
        secrets: [],
        metadata: { total_configs: 0, total_secrets: 0, export_type: 'full' }
      }

      // Validate incompatible version
      const validation = await backupService.validateBackup(JSON.stringify(incompatibleBackup))
      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Unsupported version: 2.0.0. Expected: 1.0.0')

      // Try to import incompatible version
      await expect(backupService.importBackup(userId, incompatibleBackup as any, {
        overwrite_existing: false
      })).rejects.toThrow('Unsupported version')
    })

    it('should handle conflict detection and resolution', async () => {
      const backupData: BackupData = {
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
        configurations: [mockConfigurations[0]],
        secrets: [],
        metadata: { total_configs: 1, total_secrets: 0, export_type: 'full' }
      }

      // Mock existing configuration with same name
      const existingMockQuery = createMockSupabaseQuery({ data: { id: 'existing-id', name: 'nginx-config' }, error: null })
      mockSupabase.from = vi.fn(() => existingMockQuery)

      // Import without overwrite (should skip existing)
      const result1 = await backupService.importBackup(userId, backupData, {
        overwrite_existing: false
      })

      expect(result1.imported_configs).toBe(0)
      expect(result1.skipped_configs).toContain('nginx-config')

      // Mock for overwrite scenario
      const overwriteMockQuery = createMockSupabaseQuery({ data: { id: 'existing-id', name: 'nginx-config' }, error: null })
      overwriteMockQuery.update = vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) }))
      mockSupabase.from = vi.fn(() => overwriteMockQuery)

      // Import with overwrite (should update existing)
      const result2 = await backupService.importBackup(userId, backupData, {
        overwrite_existing: true
      })

      expect(result2.imported_configs).toBe(1)
      expect(result2.skipped_configs).toHaveLength(0)
    })

    it('should handle validation errors during import', async () => {
      // Mock validation failure
      mockDockerService.validateCompose.mockResolvedValueOnce({
        valid: false,
        errors: ['Invalid service configuration'],
        warnings: []
      })

      const mockQuery = createMockSupabaseQuery({ data: null, error: { code: 'PGRST116' } })
      mockSupabase.from = vi.fn(() => mockQuery)

      const backupData: BackupData = {
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
        configurations: [mockConfigurations[0]],
        secrets: [],
        metadata: { total_configs: 1, total_secrets: 0, export_type: 'full' }
      }

      const result = await backupService.importBackup(userId, backupData, {
        overwrite_existing: false
      })

      expect(result.imported_configs).toBe(0)
      expect(result.errors).toContain('Failed to import configuration "nginx-config": Configuration has invalid compose content')
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed backup data', async () => {
      const malformedData = '{ invalid json'

      const validation = await backupService.validateBackup(malformedData)
      expect(validation.valid).toBe(false)
      expect(validation.errors).toEqual(['Invalid backup data format. Must be valid JSON or YAML.'])
    })

    it('should handle database errors during export', async () => {
      // Mock database error
      const mockQuery = createMockSupabaseQuery({ data: null, error: { message: 'Database connection failed' } })
      mockSupabase.from = vi.fn(() => mockQuery)

      await expect(backupService.exportBackup(userId, {
        include_secrets: false,
        format: 'json'
      })).rejects.toThrow('Failed to fetch configurations: Database connection failed')
    })

    it('should handle missing backup data fields', async () => {
      const incompleteBackup = {
        version: '1.0.0'
        // Missing configurations and other required fields
      }

      const validation = await backupService.validateBackup(JSON.stringify(incompleteBackup))
      expect(validation.valid).toBe(false)
      expect(validation.errors).toContain('Missing or invalid configurations array')
    })
  })
})