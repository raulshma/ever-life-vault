import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest'
import { BackupService } from '../services/BackupService.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { BackupData, DockerComposeConfig } from '../../src/features/infrastructure/types.js'

// Mock dependencies
vi.mock('../services/DockerService.js')
vi.mock('../services/SecretsService.js')

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

const mockDockerService = {
  validateCompose: vi.fn()
}

const mockSecretsService = {
  listSecretKeys: vi.fn(),
  retrieveSecret: vi.fn(),
  storeSecret: vi.fn()
}

// Mock the service constructors
vi.mock('../services/DockerService.js', () => ({
  DockerService: vi.fn(() => mockDockerService)
}))

vi.mock('../services/SecretsService.js', () => ({
  SecretsService: vi.fn(() => mockSecretsService)
}))

describe('BackupService', () => {
  let backupService: BackupService
  const userId = 'test-user-id'
  const supabaseUrl = 'https://test.supabase.co'
  const supabaseAnonKey = 'test-anon-key'

  beforeEach(() => {
    vi.clearAllMocks()
    backupService = new BackupService(mockSupabase, supabaseUrl, supabaseAnonKey)
  })

  describe('exportBackup', () => {
    const mockConfigs: DockerComposeConfig[] = [
      {
        id: 'config-1',
        user_id: userId,
        name: 'test-config-1',
        description: 'Test configuration 1',
        compose_content: 'version: "3.8"\nservices:\n  app:\n    image: nginx',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        metadata: {
          services: [{ name: 'app', image: 'nginx', ports: [], environment: [], volumes: [] }],
          volumes: [],
          networks: []
        }
      },
      {
        id: 'config-2',
        user_id: userId,
        name: 'test-config-2',
        description: 'Test configuration 2',
        compose_content: 'version: "3.8"\nservices:\n  db:\n    image: postgres',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        metadata: {
          services: [{ name: 'db', image: 'postgres', ports: [], environment: [], volumes: [] }],
          volumes: [],
          networks: []
        }
      }
    ]

    it('should export all configurations when no config_ids specified', async () => {
      // Mock Supabase response
      const mockQuery = createMockSupabaseQuery({ data: mockConfigs, error: null })
      mockSupabase.from = vi.fn(() => mockQuery)

      const result = await backupService.exportBackup(userId, {
        include_secrets: false,
        format: 'json'
      })

      expect(result).toEqual({
        version: '1.0.0',
        created_at: expect.any(String),
        configurations: mockConfigs,
        secrets: [],
        metadata: {
          total_configs: 2,
          total_secrets: 0,
          export_type: 'full'
        }
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('docker_compose_configs')
    })

    it('should export only selected configurations when config_ids specified', async () => {
      const selectedConfig = mockConfigs[0]
      
      // Mock Supabase response for selective export
      const mockQuery = createMockSupabaseQuery({ data: [selectedConfig], error: null })
      mockSupabase.from = vi.fn(() => mockQuery)

      const result = await backupService.exportBackup(userId, {
        config_ids: ['config-1'],
        include_secrets: false,
        format: 'json'
      })

      expect(result.configurations).toHaveLength(1)
      expect(result.configurations[0].id).toBe('config-1')
      expect(result.metadata.export_type).toBe('selective')
    })

    it('should include secrets when include_secrets is true', async () => {
      // Mock Supabase response
      const mockQuery = createMockSupabaseQuery({ data: mockConfigs, error: null })
      mockSupabase.from = vi.fn(() => mockQuery)
      mockSecretsService.listSecretKeys.mockResolvedValue(['SECRET_1', 'SECRET_2'])

      const result = await backupService.exportBackup(userId, {
        include_secrets: true,
        format: 'json'
      })

      expect(result.secrets).toHaveLength(2)
      expect(result.secrets[0].key).toBe('SECRET_1')
      expect(result.secrets[1].key).toBe('SECRET_2')
      expect(result.metadata.total_secrets).toBe(2)
    })

    it('should handle database errors', async () => {
      // Mock Supabase error response
      const mockQuery = createMockSupabaseQuery({ data: null, error: { message: 'Database error' } })
      mockSupabase.from = vi.fn(() => mockQuery)

      await expect(backupService.exportBackup(userId, { include_secrets: false }))
        .rejects.toThrow('Failed to fetch configurations: Database error')
    })
  })

  describe('validateBackup', () => {
    const validBackupJson = JSON.stringify({
      version: '1.0.0',
      created_at: '2024-01-01T00:00:00Z',
      configurations: [
        {
          id: 'config-1',
          name: 'test-config',
          compose_content: 'version: "3.8"\nservices:\n  app:\n    image: nginx'
        }
      ],
      secrets: [{ key: 'SECRET_1' }],
      metadata: { total_configs: 1, total_secrets: 1, export_type: 'full' }
    })

    it('should validate valid JSON backup', async () => {
      mockDockerService.validateCompose.mockResolvedValue({ valid: true, errors: [], warnings: [] })

      const result = await backupService.validateBackup(validBackupJson)

      expect(result.valid).toBe(true)
      expect(result.format).toBe('json')
      expect(result.errors).toHaveLength(0)
    })

    it('should validate valid YAML backup', async () => {
      const yamlContent = `
version: '1.0.0'
created_at: '2024-01-01T00:00:00Z'
configurations:
  - id: config-1
    name: test-config
    compose_content: |
      version: "3.8"
      services:
        app:
          image: nginx
secrets:
  - key: SECRET_1
metadata:
  total_configs: 1
  total_secrets: 1
  export_type: full
      `.trim()

      mockDockerService.validateCompose.mockResolvedValue({ valid: true, errors: [], warnings: [] })

      const result = await backupService.validateBackup(yamlContent)

      expect(result.valid).toBe(true)
      expect(result.format).toBe('yaml')
      expect(result.errors).toHaveLength(0)
    })

    it('should reject invalid JSON/YAML', async () => {
      const invalidContent = '{ invalid json content'

      const result = await backupService.validateBackup(invalidContent)

      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(['Invalid backup data format. Must be valid JSON or YAML.'])
    })

    it('should reject backup with missing version', async () => {
      const invalidBackup = JSON.stringify({
        configurations: [],
        secrets: []
      })

      const result = await backupService.validateBackup(invalidBackup)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing version field')
    })

    it('should reject backup with unsupported version', async () => {
      const invalidBackup = JSON.stringify({
        version: '2.0.0',
        configurations: [],
        secrets: []
      })

      const result = await backupService.validateBackup(invalidBackup)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Unsupported version: 2.0.0. Expected: 1.0.0')
    })

    it('should reject backup with invalid configurations array', async () => {
      const invalidBackup = JSON.stringify({
        version: '1.0.0',
        configurations: 'not an array',
        secrets: []
      })

      const result = await backupService.validateBackup(invalidBackup)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing or invalid configurations array')
    })

    it('should validate individual configurations', async () => {
      const backupWithInvalidConfig = JSON.stringify({
        version: '1.0.0',
        configurations: [
          { name: 'valid-config', compose_content: 'valid content' },
          { compose_content: 'missing name' },
          { name: 'missing-content' }
        ],
        secrets: []
      })

      mockDockerService.validateCompose.mockResolvedValue({ valid: true, errors: [], warnings: [] })

      const result = await backupService.validateBackup(backupWithInvalidConfig)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Configuration 2: Missing name')
      expect(result.errors).toContain('Configuration 3: Missing compose_content')
    })

    it('should warn about invalid compose content', async () => {
      const backupWithInvalidCompose = JSON.stringify({
        version: '1.0.0',
        configurations: [
          { name: 'invalid-compose', compose_content: 'invalid compose content' }
        ],
        secrets: []
      })

      mockDockerService.validateCompose.mockResolvedValue({ valid: false, errors: ['Invalid syntax'], warnings: [] })

      const result = await backupService.validateBackup(backupWithInvalidCompose)

      expect(result.valid).toBe(true) // Structure is valid, just compose content issues
      expect(result.warnings).toContain('Configuration "invalid-compose": Docker Compose validation issues')
    })
  })

  describe('importBackup', () => {
    const mockBackupData: BackupData = {
      version: '1.0.0',
      created_at: '2024-01-01T00:00:00Z',
      configurations: [
        {
          id: 'config-1',
          user_id: 'original-user',
          name: 'test-config',
          description: 'Test configuration',
          compose_content: 'version: "3.8"\nservices:\n  app:\n    image: nginx',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          metadata: {
            services: [{ name: 'app', image: 'nginx', ports: [], environment: [], volumes: [] }],
            volumes: [],
            networks: []
          }
        }
      ],
      secrets: [{ key: 'SECRET_1', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' }],
      metadata: { total_configs: 1, total_secrets: 1, export_type: 'full' }
    }

    it('should import configurations successfully', async () => {
      // Mock no existing configuration
      const mockQuery = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({ data: null, error: { code: 'PGRST116' } }))
            }))
          }))
        })),
        insert: vi.fn(() => ({ error: null }))
      }
      mockSupabase.from = vi.fn(() => mockQuery)
      
      mockDockerService.validateCompose.mockResolvedValue({ valid: true, errors: [], warnings: [] })
      mockSecretsService.retrieveSecret.mockResolvedValue(null)
      mockSecretsService.storeSecret.mockResolvedValue(undefined)

      const result = await backupService.importBackup(userId, mockBackupData, {
        overwrite_existing: false
      })

      expect(result.success).toBe(true)
      expect(result.imported_configs).toBe(1)
      expect(result.imported_secrets).toBe(1)
      expect(result.errors).toHaveLength(0)
    })

    it('should skip existing configurations when overwrite_existing is false', async () => {
      // Mock existing configuration
      const mockQuery = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({ data: { id: 'existing-id', name: 'test-config' }, error: null }))
            }))
          }))
        }))
      }
      mockSupabase.from = vi.fn(() => mockQuery)

      const result = await backupService.importBackup(userId, mockBackupData, {
        overwrite_existing: false
      })

      expect(result.imported_configs).toBe(0)
      expect(result.skipped_configs).toContain('test-config')
    })

    it('should overwrite existing configurations when overwrite_existing is true', async () => {
      // Mock existing configuration
      const mockQuery = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({ data: { id: 'existing-id', name: 'test-config' }, error: null }))
            }))
          }))
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({ error: null }))
        }))
      }
      mockSupabase.from = vi.fn(() => mockQuery)
      
      mockDockerService.validateCompose.mockResolvedValue({ valid: true, errors: [], warnings: [] })

      const result = await backupService.importBackup(userId, mockBackupData, {
        overwrite_existing: true
      })

      expect(result.imported_configs).toBe(1)
      expect(result.skipped_configs).toHaveLength(0)
    })

    it('should handle selective restore', async () => {
      const mockQuery = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({ data: null, error: { code: 'PGRST116' } }))
            }))
          }))
        })),
        insert: vi.fn(() => ({ error: null }))
      }
      mockSupabase.from = vi.fn(() => mockQuery)
      
      mockDockerService.validateCompose.mockResolvedValue({ valid: true, errors: [], warnings: [] })

      const result = await backupService.importBackup(userId, mockBackupData, {
        overwrite_existing: false,
        selective_restore: {
          config_ids: ['config-1'],
          secret_keys: []
        }
      })

      expect(result.imported_configs).toBe(1)
      expect(result.imported_secrets).toBe(0)
    })

    it('should handle validation errors', async () => {
      const mockQuery = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({ data: null, error: { code: 'PGRST116' } }))
            }))
          }))
        }))
      }
      mockSupabase.from = vi.fn(() => mockQuery)
      
      mockDockerService.validateCompose.mockResolvedValue({ valid: false, errors: ['Invalid syntax'], warnings: [] })

      const result = await backupService.importBackup(userId, mockBackupData, {
        overwrite_existing: false
      })

      expect(result.imported_configs).toBe(0)
      expect(result.errors).toContain('Failed to import configuration "test-config": Configuration has invalid compose content')
    })
  })

  describe('utility methods', () => {
    it('should format backup as JSON', () => {
      const backupData: BackupData = {
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00Z',
        configurations: [],
        secrets: [],
        metadata: { total_configs: 0, total_secrets: 0, export_type: 'full' }
      }

      const result = backupService.formatAsJson(backupData)
      const parsed = JSON.parse(result)

      expect(parsed.version).toBe('1.0.0')
      expect(result).toContain('\n') // Should be pretty-printed
    })

    it('should generate backup filename', () => {
      const jsonFilename = backupService.generateBackupFilename('json')
      const yamlFilename = backupService.generateBackupFilename('yaml')

      expect(jsonFilename).toMatch(/^infrastructure-backup-\d{4}-\d{2}-\d{2}\.json$/)
      expect(yamlFilename).toMatch(/^infrastructure-backup-\d{4}-\d{2}-\d{2}\.yaml$/)
    })
  })
})