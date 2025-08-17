import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { DockerService } from '../services/DockerService.js'
import { FileSystemService } from '../services/FileSystemService.js'
import { SecretsService } from '../services/SecretsService.js'
import { BackupService } from '../services/BackupService.js'
import { createSupabaseClient } from '../auth/supabase.js'

// Validation schemas
const createConfigSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  compose_content: z.string().min(1),
  metadata: z.object({
    services: z.array(z.object({
      name: z.string(),
      image: z.string(),
      ports: z.array(z.object({
        host_port: z.number(),
        container_port: z.number(),
        protocol: z.enum(['tcp', 'udp'])
      })).optional().default([]),
      environment: z.array(z.object({
        key: z.string(),
        value: z.string(),
        is_secret: z.boolean()
      })).optional().default([]),
      volumes: z.array(z.object({
        host_path: z.string(),
        container_path: z.string(),
        mode: z.enum(['ro', 'rw']),
        uid: z.number().optional(),
        gid: z.number().optional(),
        permissions: z.string().optional()
      })).optional().default([]),
      depends_on: z.array(z.string()).optional(),
      restart_policy: z.enum(['no', 'always', 'on-failure', 'unless-stopped']).optional(),
      user_id: z.number().optional(),
      group_id: z.number().optional(),
      memory_limit: z.string().optional(),
      cpu_limit: z.string().optional(),
      health_check: z.string().optional(),
      working_dir: z.string().optional(),
      command: z.string().optional()
    })),
    volumes: z.array(z.object({
      name: z.string(),
      driver: z.string().optional(),
      driver_opts: z.record(z.string()).optional()
    })).optional().default([]),
    networks: z.array(z.object({
      name: z.string(),
      driver: z.string().optional(),
      driver_opts: z.record(z.string()).optional()
    })).optional().default([])
  })
})

const updateConfigSchema = createConfigSchema.partial()

const validateComposeSchema = z.object({
  compose_content: z.string().min(1)
})

const stackOperationSchema = z.object({
  stack_name: z.string().min(1).max(100)
})

const pathValidationSchema = z.object({
  path: z.string().min(1)
})

const createDirectorySchema = z.object({
  path: z.string().min(1),
  permissions: z.object({
    uid: z.number().optional(),
    gid: z.number().optional(),
    mode: z.string().optional()
  }).optional()
})

const setPermissionsSchema = z.object({
  path: z.string().min(1),
  uid: z.number(),
  gid: z.number(),
  mode: z.string()
})

const secretSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1)
})

const bulkSecretsSchema = z.object({
  secrets: z.record(z.string())
})

// Helper function to create authenticated Supabase client for requests
function makeSupabaseForRequest(options: { SUPABASE_URL: string; SUPABASE_ANON_KEY: string }, request: any): SupabaseClient | null {
  if (!options.SUPABASE_URL || !options.SUPABASE_ANON_KEY) return null
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  
  return createClient(options.SUPABASE_URL, options.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  })
}



export function registerInfrastructureRoutes(
  server: FastifyInstance,
  options: {
    requireSupabaseUser: (request: any, reply: any) => Promise<any>
    SUPABASE_URL: string
    SUPABASE_ANON_KEY: string
  }
) {
  const { requireSupabaseUser, SUPABASE_URL, SUPABASE_ANON_KEY } = options

  // Initialize services
  const dockerService = new DockerService()
  const fileSystemService = new FileSystemService()
  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  if (!supabase) {
    server.log.error('Failed to initialize Supabase client for infrastructure routes')
    return
  }
  
  const backupService = new BackupService(supabase, SUPABASE_URL, SUPABASE_ANON_KEY)

  // Configuration Management Routes (4.1)

  // GET /api/infrastructure/configs - List all configurations
  server.get('/api/infrastructure/configs', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const { data, error } = await authenticatedSupabase
        .from('docker_compose_configs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        return reply.code(500).send({ error: 'Failed to fetch configurations', details: error.message })
      }

      return reply.send({ configurations: data || [] })
    } catch (error: any) {
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // POST /api/infrastructure/configs - Create new configuration
  server.post('/api/infrastructure/configs', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const body = createConfigSchema.parse(request.body)
      
      // Validate compose content
      const validation = await dockerService.validateCompose(body.compose_content)
      if (!validation.valid) {
        return reply.code(400).send({ 
          error: 'Invalid Docker Compose configuration',
          validation_errors: validation.errors,
          validation_warnings: validation.warnings
        })
      }

      const { data, error } = await authenticatedSupabase
        .from('docker_compose_configs')
        .insert({
          user_id: user.id,
          name: body.name,
          description: body.description,
          compose_content: body.compose_content,
          metadata: body.metadata
        })
        .select()
        .single()

      if (error) {
        return reply.code(500).send({ error: 'Failed to create configuration', details: error.message })
      }

      return reply.code(201).send({ configuration: data })
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors })
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // GET /api/infrastructure/configs/:id - Get specific configuration
  server.get('/api/infrastructure/configs/:id', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const params = z.object({ id: z.string().uuid() }).parse((request as any).params)

      const { data, error } = await authenticatedSupabase
        .from('docker_compose_configs')
        .select('*')
        .eq('id', params.id)
        .eq('user_id', user.id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return reply.code(404).send({ error: 'Configuration not found' })
        }
        return reply.code(500).send({ error: 'Failed to fetch configuration', details: error.message })
      }

      return reply.send({ configuration: data })
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Invalid configuration ID' })
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // PUT /api/infrastructure/configs/:id - Update configuration
  server.put('/api/infrastructure/configs/:id', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const params = z.object({ id: z.string().uuid() }).parse((request as any).params)
      const body = updateConfigSchema.parse(request.body)

      // Validate compose content if provided
      if (body.compose_content) {
        const validation = await dockerService.validateCompose(body.compose_content)
        if (!validation.valid) {
          return reply.code(400).send({ 
            error: 'Invalid Docker Compose configuration',
            validation_errors: validation.errors,
            validation_warnings: validation.warnings
          })
        }
      }

      const { data, error } = await authenticatedSupabase
        .from('docker_compose_configs')
        .update({
          ...body,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return reply.code(404).send({ error: 'Configuration not found' })
        }
        return reply.code(500).send({ error: 'Failed to update configuration', details: error.message })
      }

      return reply.send({ configuration: data })
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors })
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // DELETE /api/infrastructure/configs/:id - Delete configuration
  server.delete('/api/infrastructure/configs/:id', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const params = z.object({ id: z.string().uuid() }).parse((request as any).params)

      const { error } = await authenticatedSupabase
        .from('docker_compose_configs')
        .delete()
        .eq('id', params.id)
        .eq('user_id', user.id)

      if (error) {
        return reply.code(500).send({ error: 'Failed to delete configuration', details: error.message })
      }

      return reply.code(204).send()
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Invalid configuration ID' })
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // POST /api/infrastructure/configs/:id/validate - Validate configuration
  server.post('/api/infrastructure/configs/:id/validate', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const params = z.object({ id: z.string().uuid() }).parse((request as any).params)

      // Get configuration
      const { data: config, error } = await authenticatedSupabase
        .from('docker_compose_configs')
        .select('compose_content')
        .eq('id', params.id)
        .eq('user_id', user.id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return reply.code(404).send({ error: 'Configuration not found' })
        }
        return reply.code(500).send({ error: 'Failed to fetch configuration', details: error.message })
      }

      // Validate compose content
      const validation = await dockerService.validateCompose(config.compose_content)
      
      return reply.send(validation)
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Invalid configuration ID' })
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // POST /api/infrastructure/validate-compose - Validate compose content directly
  server.post('/api/infrastructure/validate-compose', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const body = validateComposeSchema.parse(request.body)
      const validation = await dockerService.validateCompose(body.compose_content)
      
      return reply.send(validation)
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors })
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // Stack Management Routes (4.2)

  // Stack management routes removed - infrastructure feature now focuses only on docker-compose file management









  
// File System Management Routes (4.3)

  // GET /api/infrastructure/filesystem/validate-path - Validate host path
  server.get('/api/infrastructure/filesystem/validate-path', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const query = pathValidationSchema.parse((request as any).query)
      const result = await fileSystemService.validatePath(query.path)
      
      return reply.send(result)
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Invalid path parameter', details: error.errors })
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // POST /api/infrastructure/filesystem/create-path - Create directory
  server.post('/api/infrastructure/filesystem/create-path', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const body = createDirectorySchema.parse(request.body)
      const result = await fileSystemService.createDirectory(body)
      
      if (!result.success) {
        return reply.code(500).send({ 
          error: 'Failed to create directory', 
          details: result.message,
          fs_error: result.error 
        })
      }

      return reply.send(result)
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors })
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // POST /api/infrastructure/filesystem/set-permissions - Set permissions
  server.post('/api/infrastructure/filesystem/set-permissions', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const body = setPermissionsSchema.parse(request.body)
      const result = await fileSystemService.setPermissions(body)
      
      if (!result.success) {
        return reply.code(500).send({ 
          error: 'Failed to set permissions', 
          details: result.message,
          fs_error: result.error 
        })
      }

      return reply.send(result)
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors })
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // GET /api/infrastructure/filesystem/permissions - Check permissions
  server.get('/api/infrastructure/filesystem/permissions', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const query = pathValidationSchema.parse((request as any).query)
      const permissions = await fileSystemService.checkPermissions(query.path)
      
      return reply.send({ permissions })
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Invalid path parameter', details: error.errors })
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Internal server error' })
    }
  })

  // Secrets Management Routes (4.3)

  // GET /api/infrastructure/secrets - List secret keys (not values)
  server.get('/api/infrastructure/secrets', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest(options, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const secretsService = new SecretsService(authenticatedSupabase as any)
      const keys = await secretsService.listSecretKeys(user.id)
      return reply.send({ secret_keys: keys })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      server.log.error(error)
      return reply.code(500).send({ error: 'Failed to list secrets', details: errorMessage })
    }
  })

  // POST /api/infrastructure/secrets - Create/update secret
  server.post('/api/infrastructure/secrets', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest(options, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const body = secretSchema.parse(request.body)
      const secretsService = new SecretsService(authenticatedSupabase as any)
      
      // Sanitize the secret key
      const sanitizedKey = secretsService.sanitizeSecretKey(body.key)
      
      await secretsService.storeSecret(sanitizedKey, body.value, user.id)
      
      return reply.code(201).send({ 
        message: 'Secret stored successfully',
        key: sanitizedKey
      })
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Invalid request data', details: (error as any).errors })
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      server.log.error(error)
      return reply.code(500).send({ error: 'Failed to store secret', details: errorMessage })
    }
  })

  // GET /api/infrastructure/secrets/:key - Get secret value
  server.get('/api/infrastructure/secrets/:key', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest(options, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const params = z.object({ key: z.string().min(1) }).parse((request as any).params)
      const secretsService = new SecretsService(authenticatedSupabase as any)
      
      const value = await secretsService.retrieveSecret(params.key, user.id)
      
      if (value === null) {
        return reply.code(404).send({ error: 'Secret not found' })
      }

      return reply.send({ key: params.key, value })
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Invalid secret key' })
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      server.log.error(error)
      return reply.code(500).send({ error: 'Failed to retrieve secret', details: errorMessage })
    }
  })

  // DELETE /api/infrastructure/secrets/:key - Delete secret
  server.delete('/api/infrastructure/secrets/:key', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest(options, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const params = z.object({ key: z.string().min(1) }).parse((request as any).params)
      const secretsService = new SecretsService(authenticatedSupabase as any)
      
      await secretsService.deleteSecret(params.key, user.id)
      
      return reply.code(204).send()
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Invalid secret key' })
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      server.log.error(error)
      return reply.code(500).send({ error: 'Failed to delete secret', details: errorMessage })
    }
  })

  // POST /api/infrastructure/secrets/bulk - Bulk import secrets
  server.post('/api/infrastructure/secrets/bulk', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest(options, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const body = bulkSecretsSchema.parse(request.body)
      const secretsService = new SecretsService(authenticatedSupabase as any)
      
      // Sanitize all secret keys
      const sanitizedSecrets: Record<string, string> = {}
      for (const [key, value] of Object.entries(body.secrets)) {
        const sanitizedKey = secretsService.sanitizeSecretKey(key)
        sanitizedSecrets[sanitizedKey] = String(value)
      }
      
      const result = await secretsService.bulkImportSecrets(sanitizedSecrets, user.id)
      
      return reply.send({
        message: `Imported ${result.imported} secrets`,
        imported: result.imported,
        errors: result.errors
      })
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Invalid request data', details: (error as any).errors })
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      server.log.error(error)
      return reply.code(500).send({ error: 'Failed to bulk import secrets', details: errorMessage })
    }
  })

  // POST /api/infrastructure/secrets/validate - Validate secrets exist for compose
  server.post('/api/infrastructure/secrets/validate', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest(options, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const body = validateComposeSchema.parse(request.body)
      const secretsService = new SecretsService(authenticatedSupabase as any)
      
      const validation = await secretsService.validateSecretsExist(body.compose_content, user.id)
      
      return reply.send(validation)
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Invalid request data', details: (error as any).errors })
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      server.log.error(error)
      return reply.code(500).send({ error: 'Failed to validate secrets', details: errorMessage })
    }
  })

  // Backup and Restore Routes (6.1, 6.2, 6.3, 6.4, 6.5)

  const backupExportSchema = z.object({
    config_ids: z.array(z.string().uuid()).optional(),
    include_secrets: z.boolean().default(false),
    format: z.enum(['json', 'yaml']).default('json')
  })

  const restoreImportSchema = z.object({
    backup_data: z.string(),
    overwrite_existing: z.boolean().default(false),
    selective_restore: z.object({
      config_ids: z.array(z.string().uuid()).optional(),
      secret_keys: z.array(z.string()).optional()
    }).optional()
  })

  // POST /api/infrastructure/backup/export - Export configurations and secrets
  server.post('/api/infrastructure/backup/export', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const body = backupExportSchema.parse(request.body)
      
      const backupData = await backupService.exportBackup(user.id, body)

      // Format response based on requested format
      if (body.format === 'yaml') {
        const yamlContent = await backupService.formatAsYaml(backupData)
        
        reply.header('Content-Type', 'application/x-yaml')
        reply.header('Content-Disposition', `attachment; filename="${backupService.generateBackupFilename('yaml')}"`)
        return reply.send(yamlContent)
      } else {
        const jsonContent = backupService.formatAsJson(backupData)
        
        reply.header('Content-Type', 'application/json')
        reply.header('Content-Disposition', `attachment; filename="${backupService.generateBackupFilename('json')}"`)
        return reply.send(jsonContent)
      }
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors })
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Failed to create backup', details: error.message })
    }
  })

  // POST /api/infrastructure/backup/import - Import configurations and secrets
  server.post('/api/infrastructure/backup/import', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const body = restoreImportSchema.parse(request.body)
      
      // Parse backup data
      let backupData: any
      try {
        // Try JSON first
        backupData = JSON.parse(body.backup_data)
      } catch {
        try {
          // Try YAML if JSON fails
          const yaml = await import('yaml')
          backupData = yaml.parse(body.backup_data)
        } catch {
          return reply.code(400).send({ error: 'Invalid backup data format. Must be valid JSON or YAML.' })
        }
      }

      // Validate backup data structure
      if (!backupData.version || !backupData.configurations || !Array.isArray(backupData.configurations)) {
        return reply.code(400).send({ error: 'Invalid backup data structure' })
      }

      // Check version compatibility
      if (backupData.version !== '1.0.0') {
        return reply.code(400).send({ 
          error: 'Unsupported backup version', 
          details: `Version ${backupData.version} is not supported. Expected version 1.0.0.` 
        })
      }

      const restoreOptions = {
        overwrite_existing: body.overwrite_existing,
        selective_restore: body.selective_restore || { config_ids: [], secret_keys: [] }
      }

      const result = await backupService.importBackup(user.id, backupData, restoreOptions)
      
      return reply.send(result)
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors })
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Failed to import backup', details: error.message })
    }
  })

  // POST /api/infrastructure/backup/validate - Validate backup file
  server.post('/api/infrastructure/backup/validate', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    try {
      const body = z.object({ backup_data: z.string() }).parse(request.body)
      
      const validation = await backupService.validateBackup(body.backup_data)
      
      // Check for naming conflicts if validation passed
      if (validation.valid && validation.metadata) {
        try {
          const backupData = JSON.parse(body.backup_data)
          const conflicts = await backupService.checkNamingConflicts(user.id, backupData)
          if (conflicts.length > 0) {
            validation.warnings.push(`Naming conflicts detected: ${conflicts.join(', ')}`)
          }
        } catch {
          // If JSON parsing fails, try YAML
          try {
            const yaml = await import('yaml')
            const backupData = yaml.parse(body.backup_data)
            const conflicts = await backupService.checkNamingConflicts(user.id, backupData)
            if (conflicts.length > 0) {
              validation.warnings.push(`Naming conflicts detected: ${conflicts.join(', ')}`)
            }
          } catch {
            // Ignore conflicts check if parsing fails
          }
        }
      }

      return reply.send(validation)
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return reply.code(400).send({ error: 'Invalid request data', details: error.errors })
      }
      server.log.error(error)
      return reply.code(500).send({ error: 'Failed to validate backup', details: error.message })
    }
  })

  // GET /api/infrastructure/secrets/export - Export secret keys for backup
  server.get('/api/infrastructure/secrets/export', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply)
    if (!user) return

    const authenticatedSupabase = makeSupabaseForRequest(options, request)
    if (!authenticatedSupabase) {
      return reply.code(500).send({ error: 'Failed to create authenticated client' })
    }

    try {
      const secretsService = new SecretsService(authenticatedSupabase as any)
      const result = await secretsService.exportSecretKeys(user.id)
      
      return reply.send({
        export_data: result,
        exported_at: new Date().toISOString()
      })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      server.log.error(error)
      return reply.code(500).send({ error: 'Failed to export secrets', details: errorMessage })
    }
  })


}