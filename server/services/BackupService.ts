import type { SupabaseClient } from '@supabase/supabase-js'
import { DockerService } from './DockerService.js'
import { SecretsService } from './SecretsService.js'
import type { 
  BackupData, 
  RestoreOptions, 
  RestoreResult,
  DockerComposeConfig 
} from '../types/infrastructure.js'

export interface BackupExportOptions {
  config_ids?: string[]
  include_secrets?: boolean
  format?: 'json' | 'yaml'
}

export interface BackupValidationResult {
  valid: boolean
  format?: 'json' | 'yaml'
  errors: string[]
  warnings: string[]
  metadata?: Record<string, unknown>
}

export class BackupService {
  private dockerService: DockerService
  private secretsService: SecretsService

  constructor(
    private supabase: SupabaseClient,
    supabaseUrl: string,
    supabaseAnonKey: string
  ) {
    this.dockerService = new DockerService()
    this.secretsService = new SecretsService(this.supabase)
  }

  /**
   * Export configurations and secrets to backup format
   */
  async exportBackup(userId: string, options: BackupExportOptions): Promise<BackupData> {
    // Get configurations to export
    let configQuery = this.supabase
      .from('docker_compose_configs')
      .select('*')
      .eq('user_id', userId)

    if (options.config_ids && options.config_ids.length > 0) {
      configQuery = configQuery.in('id', options.config_ids)
    }

    const { data: configs, error: configError } = await configQuery

    if (configError) {
      throw new Error(`Failed to fetch configurations: ${configError.message}`)
    }

    // Get secrets to export (keys only, not values for security)
    let secrets: Array<{ id: string; user_id: string; key: string; created_at: string; updated_at: string }> = []
    if (options.include_secrets) {
      const secretKeys = await this.secretsService.listSecretKeys(userId)
      secrets = secretKeys.map(key => ({
        id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        key,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))
    }

    // Create backup data
    const backupData: BackupData = {
      version: '1.0.0',
      created_at: new Date().toISOString(),
      configurations: configs || [],
      secrets: secrets,
      metadata: {
        total_configs: (configs || []).length,
        total_secrets: secrets.length,
        export_type: options.config_ids ? 'selective' : 'full'
      }
    }

    return backupData
  }

  /**
   * Import configurations and secrets from backup data
   */
  async importBackup(
    userId: string, 
    backupData: BackupData, 
    options: RestoreOptions
  ): Promise<RestoreResult> {
    // Validate version compatibility
    if (backupData.version !== '1.0.0') {
      throw new Error(`Unsupported version: ${backupData.version}. Expected: 1.0.0`)
    }

    const result: RestoreResult = {
      success: true,
      imported_configs: 0,
      imported_secrets: 0,
      skipped_configs: [],
      skipped_secrets: [],
      errors: []
    }

    // Import configurations
    const configsToImport = options.selective_restore?.config_ids 
      ? backupData.configurations.filter(config => 
          options.selective_restore?.config_ids?.includes(config.id)
        )
      : backupData.configurations

    for (const config of configsToImport) {
      try {
        await this.importConfiguration(userId, config, options.overwrite_existing, result)
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        result.errors.push(`Failed to import configuration "${config.name}": ${errorMessage}`)
      }
    }

    // Import secrets (if included and requested)
    if (backupData.secrets && Array.isArray(backupData.secrets)) {
      const secretsToImport = options.selective_restore?.secret_keys
        ? backupData.secrets.filter(secret => 
            options.selective_restore?.secret_keys?.includes(secret.key)
          )
        : backupData.secrets

      for (const secret of secretsToImport) {
        try {
          await this.importSecret(userId, secret, options.overwrite_existing, result)
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          result.errors.push(`Failed to import secret "${secret.key}": ${errorMessage}`)
        }
      }
    }

    result.success = result.errors.length === 0
    return result
  }

  /**
   * Validate backup data structure and content
   */
  async validateBackup(backupData: string): Promise<BackupValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    let parsedData: unknown
    let format: 'json' | 'yaml'

    // Parse backup data
    try {
      parsedData = JSON.parse(backupData)
      format = 'json'
    } catch {
      try {
        const yaml = await import('yaml')
        parsedData = yaml.parse(backupData)
        format = 'yaml'
      } catch {
        return {
          valid: false,
          errors: ['Invalid backup data format. Must be valid JSON or YAML.'],
          warnings: []
        }
      }
    }

    // Validate structure
    if (!parsedData || typeof parsedData !== 'object') {
      errors.push('Invalid backup data structure')
      return {
        valid: false,
        format,
        errors,
        warnings,
        metadata: {}
      }
    }

    const data = parsedData as { version?: string; configurations?: unknown[]; secrets?: unknown[] }

    if (!data.version) {
      errors.push('Missing version field')
    } else if (data.version !== '1.0.0') {
      errors.push(`Unsupported version: ${data.version}. Expected: 1.0.0`)
    }

    if (!data.configurations || !Array.isArray(data.configurations)) {
      errors.push('Missing or invalid configurations array')
    } else {
      // Validate each configuration
      for (let i = 0; i < data.configurations.length; i++) {
        const config = data.configurations[i]
        if (!config.name) {
          errors.push(`Configuration ${i + 1}: Missing name`)
        }
        if (!config.compose_content) {
          errors.push(`Configuration ${i + 1}: Missing compose_content`)
        } else {
          // Validate compose content
          try {
            const validation = await this.dockerService.validateCompose(config.compose_content)
            if (!validation.valid) {
              warnings.push(`Configuration "${config.name}": Docker Compose validation issues`)
            }
          } catch {
            warnings.push(`Configuration "${config.name}": Could not validate Docker Compose content`)
          }
        }
      }
    }

    if (data.secrets && !Array.isArray(data.secrets)) {
      errors.push('Invalid secrets array')
    }

    return {
      valid: errors.length === 0,
      format,
      errors,
      warnings,
      metadata: data.metadata || {}
    }
  }

  /**
   * Check for naming conflicts with existing configurations
   */
  async checkNamingConflicts(userId: string, backupData: BackupData): Promise<string[]> {
    const { data: existingConfigs } = await this.supabase
      .from('docker_compose_configs')
      .select('name')
      .eq('user_id', userId)

    const existingNames = new Set((existingConfigs || []).map(c => c.name))
    return backupData.configurations
      .map((c: { name: string }) => c.name)
      .filter((name: string) => existingNames.has(name))
  }

  /**
   * Import a single configuration
   */
  private async importConfiguration(
    userId: string,
    config: DockerComposeConfig,
    overwriteExisting: boolean,
    result: RestoreResult
  ): Promise<void> {
    // Check if configuration already exists
    const { data: existingConfig } = await this.supabase
      .from('docker_compose_configs')
      .select('id, name')
      .eq('user_id', userId)
      .eq('name', config.name)
      .single()

    if (existingConfig && !overwriteExisting) {
      result.skipped_configs.push(config.name)
      return
    }

    // Validate compose content before importing
    const validation = await this.dockerService.validateCompose(config.compose_content)
    if (!validation.valid) {
      throw new Error(`Configuration has invalid compose content`)
    }

    // Import or update configuration
    const configData = {
      user_id: userId,
      name: config.name,
      description: config.description,
      compose_content: config.compose_content,
      metadata: config.metadata
    }

    if (existingConfig && overwriteExisting) {
      const { error } = await this.supabase
        .from('docker_compose_configs')
        .update(configData)
        .eq('id', existingConfig.id)

      if (error) {
        throw new Error(`Failed to update existing configuration: ${error.message}`)
      }
    } else {
      const { error } = await this.supabase
        .from('docker_compose_configs')
        .insert(configData)

      if (error) {
        throw new Error(`Failed to create new configuration: ${error.message}`)
      }
    }

    result.imported_configs++
  }

  /**
   * Import a single secret
   */
  private async importSecret(
    userId: string,
    secret: { key: string },
    overwriteExisting: boolean,
    result: RestoreResult
  ): Promise<void> {
    // Note: We can only import secret keys, not values (for security)
    // The user will need to manually set the values after import
    const existingSecret = await this.secretsService.retrieveSecret(secret.key, userId)
    
    if (existingSecret && !overwriteExisting) {
      result.skipped_secrets.push(secret.key)
      return
    }

    // Create placeholder secret that user needs to update
    await this.secretsService.storeSecret(secret.key, 'PLACEHOLDER_VALUE_NEEDS_UPDATE', userId)
    result.imported_secrets++
  }

  /**
   * Format backup data as JSON string
   */
  formatAsJson(backupData: BackupData): string {
    return JSON.stringify(backupData, null, 2)
  }

  /**
   * Format backup data as YAML string
   */
  async formatAsYaml(backupData: BackupData): Promise<string> {
    const yaml = await import('yaml')
    return yaml.stringify(backupData)
  }

  /**
   * Generate backup filename with timestamp
   */
  generateBackupFilename(format: 'json' | 'yaml' = 'json'): string {
    const timestamp = new Date().toISOString().split('T')[0]
    return `infrastructure-backup-${timestamp}.${format}`
  }
}