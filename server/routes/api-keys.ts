import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SecretsService } from '../services/SecretsService';

// Simple SystemSettings class for this route
class SystemSettingsService {
  private supabase: SupabaseClient;
  private secretsService: SecretsService;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.secretsService = new SecretsService(supabase);
  }

  async getReceiptAIConfig(): Promise<any> {
    const { data, error } = await this.supabase
      .from('system_settings')
      .select('setting_value')
      .eq('feature_category', 'receipt_ai')
      .eq('setting_key', 'provider_config')
      .single();

    if (error || !data) {
      return {
        provider: 'openrouter',
        model: 'openai/gpt-4o',
        use_system_key: true,
        temperature: 0.1,
        timeout_seconds: 60,
        retry_attempts: 3,
        confidence_threshold: 0.8
      };
    }

    return data.setting_value;
  }

  async setReceiptAIConfig(config: any): Promise<{ success: boolean; error?: string }> {
    const { error } = await this.supabase
      .from('system_settings')
      .upsert({
        feature_category: 'receipt_ai',
        setting_key: 'provider_config',
        setting_value: config,
        is_encrypted: false,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,feature_category,setting_key'
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  async testProviderConnection(params: any): Promise<TestConnectionResult> {
    // Simple test implementation
    try {
      if (params.provider === 'google') {
        return await this.testGoogleConnection(params.apiKey);
      } else if (params.provider === 'openrouter') {
        return await this.testOpenRouterConnection(params.apiKey);
      } else if (params.provider === 'custom') {
        return await this.testCustomConnection(params.apiKey, params.endpointUrl);
      }
      
      return { success: false, error: 'Unsupported provider' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async testGoogleConnection(apiKey: string): Promise<TestConnectionResult> {
    if (!apiKey.startsWith('AIza') || apiKey.length < 35) {
      return { success: false, error: 'Invalid Google API key format' };
    }
    
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey);
      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: 'Invalid API key' };
      }
    } catch (error) {
      return { success: false, error: 'Connection failed' };
    }
  }

  private async testOpenRouterConnection(apiKey: string): Promise<TestConnectionResult> {
    if (!apiKey.startsWith('sk-or-') || apiKey.length < 20) {
      return { success: false, error: 'Invalid OpenRouter API key format' };
    }
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: 'Invalid API key' };
      }
    } catch (error) {
      return { success: false, error: 'Connection failed' };
    }
  }

  private async testCustomConnection(apiKey: string, endpointUrl?: string): Promise<TestConnectionResult> {
    if (!endpointUrl) {
      return { success: false, error: 'Custom endpoint URL is required' };
    }
    
    try {
      const response = await fetch(endpointUrl, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000)
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Connection failed' };
    }
  }
}

interface TestConnectionResult {
  success: boolean;
  error?: string;
  latency?: number;
  details?: {
    configurationValid: boolean;
    apiKeyPresent: boolean;
    providerReachable: boolean;
    modelAvailable: boolean;
  };
}

interface AIProviderConfig {
  provider: string;
  model: string;
  use_system_key: boolean;
  endpoint_url?: string;
  temperature?: number;
  max_tokens?: number;
  timeout_seconds?: number;
  retry_attempts?: number;
  confidence_threshold?: number;
  enable_quick_analysis?: boolean;
  enable_document_analysis?: boolean;
  auto_categorization?: boolean;
}

interface MiddlewareConfig {
  requireSupabaseUser: (request: any, reply: any) => Promise<any>;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  GOOGLE_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
}

// Request/Response schemas
const SetAPIKeySchema = z.object({
  provider: z.enum(['google', 'openrouter', 'custom']),
  api_key: z.string().min(1, 'API key is required'),
  endpoint_url: z.string().url().optional() // For custom providers
});

const TestConnectionSchema = z.object({
  provider: z.enum(['google', 'openrouter', 'custom']),
  model: z.string().min(1, 'Model is required'),
  use_system_key: z.boolean().default(false),
  endpoint_url: z.string().url().optional() // For custom providers
});

const ProviderConfigSchema = z.object({
  provider: z.enum(['google', 'openrouter', 'custom']),
  model: z.string().min(1, 'Model is required'),
  use_system_key: z.boolean(),
  endpoint_url: z.string().url().optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().positive().optional(),
  timeout_seconds: z.number().min(10).max(300).optional(),
  retry_attempts: z.number().min(0).max(10).optional(),
  confidence_threshold: z.number().min(0).max(1).optional()
});

function makeSupabaseForRequest(config: { SUPABASE_URL: string; SUPABASE_ANON_KEY: string }, request: any) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
}

export function registerApiKeyRoutes(
  server: FastifyInstance, 
  { requireSupabaseUser, SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_API_KEY, OPENROUTER_API_KEY }: MiddlewareConfig
) {
  
  // Store user API key securely
  server.post('/api/ai-providers/api-keys', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply);
    if (!user) return;

    try {
      const body = SetAPIKeySchema.parse(request.body);
      
      const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request);
      if (!authenticatedSupabase) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const secretsService = new SecretsService(authenticatedSupabase);
      const secretKey = `ai_provider_${body.provider}_api_key`;
      
      // Store the API key securely
      await secretsService.storeSecret(secretKey, body.api_key, user.id);
      
      // Store endpoint URL for custom providers
      if (body.provider === 'custom' && body.endpoint_url) {
        await secretsService.storeSecret(`ai_provider_${body.provider}_endpoint`, body.endpoint_url, user.id);
      }

      return reply.send({ success: true });
    } catch (error) {
      server.log.error({ err: error }, 'Error storing API key');
      return reply.code(500).send({ 
        error: 'Failed to store API key',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Delete user API key
  server.delete('/api/ai-providers/api-keys/:provider', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply);
    if (!user) return;

    try {
      const { provider } = request.params as { provider: string };
      
      if (!['google', 'openrouter', 'custom'].includes(provider)) {
        return reply.code(400).send({ error: 'Invalid provider' });
      }

      const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request);
      if (!authenticatedSupabase) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const secretsService = new SecretsService(authenticatedSupabase);
      const secretKey = `ai_provider_${provider}_api_key`;
      
      // Delete the API key
      await secretsService.deleteSecret(secretKey, user.id);
      
      // Delete endpoint URL for custom providers
      if (provider === 'custom') {
        await secretsService.deleteSecret(`ai_provider_${provider}_endpoint`, user.id);
      }

      return reply.send({ success: true });
    } catch (error) {
      server.log.error({ err: error }, 'Error deleting API key');
      return reply.code(500).send({ 
        error: 'Failed to delete API key',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Check if user has API key configured for a provider
  server.get('/api/ai-providers/api-keys/:provider/status', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply);
    if (!user) return;

    try {
      const { provider } = request.params as { provider: string };
      
      if (!['google', 'openrouter', 'custom'].includes(provider)) {
        return reply.code(400).send({ error: 'Invalid provider' });
      }

      const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request);
      if (!authenticatedSupabase) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const secretsService = new SecretsService(authenticatedSupabase);
      const secretKey = `ai_provider_${provider}_api_key`;
      
      // Check if API key exists (without retrieving the actual value)
      const apiKey = await secretsService.retrieveSecret(secretKey, user.id);
      const hasApiKey = apiKey !== null;
      
      // Check if system key is available
      const hasSystemKey = (provider === 'google' && !!GOOGLE_API_KEY) || 
                          (provider === 'openrouter' && !!OPENROUTER_API_KEY);

      return reply.send({ 
        has_user_key: hasApiKey,
        has_system_key: hasSystemKey,
        provider 
      });
    } catch (error) {
      server.log.error({ err: error }, 'Error checking API key status');
      return reply.code(500).send({ 
        error: 'Failed to check API key status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test AI provider connection
  server.post('/api/ai-providers/test-connection', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply);
    if (!user) return;

    try {
      const body = TestConnectionSchema.parse(request.body);
      
      const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request);
      if (!authenticatedSupabase) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const secretsService = new SecretsService(authenticatedSupabase);
      const systemSettingsService = new SystemSettingsService(authenticatedSupabase);
      
      // Get API key based on configuration
      let apiKey: string | null = null;
      let endpointUrl: string | undefined;
      
      if (body.use_system_key) {
        // Use system API key
        if (body.provider === 'google' && GOOGLE_API_KEY) {
          apiKey = GOOGLE_API_KEY;
        } else if (body.provider === 'openrouter' && OPENROUTER_API_KEY) {
          apiKey = OPENROUTER_API_KEY;
        }
      } else {
        // Use user API key
        const secretKey = `ai_provider_${body.provider}_api_key`;
        apiKey = await secretsService.retrieveSecret(secretKey, user.id);
        
        if (body.provider === 'custom') {
          endpointUrl = await secretsService.retrieveSecret(`ai_provider_${body.provider}_endpoint`, user.id) || body.endpoint_url;
        }
      }

      if (!apiKey) {
        return reply.code(400).send({ 
          error: 'API key not available',
          details: body.use_system_key ? 'System API key not configured' : 'User API key not found'
        });
      }

      // Test the connection
      const testResult = await systemSettingsService.testProviderConnection({
        provider: body.provider,
        model: body.model,
        apiKey,
        endpointUrl
      });

      return reply.send(testResult);
    } catch (error) {
      server.log.error({ err: error }, 'Error testing connection');
      return reply.code(500).send({ 
        error: 'Connection test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Set AI provider configuration (without API keys)
  server.post('/api/ai-providers/config', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply);
    if (!user) return;

    try {
      const body = ProviderConfigSchema.parse(request.body);
      
      const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request);
      if (!authenticatedSupabase) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const systemSettingsService = new SystemSettingsService(authenticatedSupabase);
      
      // Store configuration (without API key)
      const config = {
        provider: body.provider,
        model: body.model,
        use_system_key: body.use_system_key,
        endpoint_url: body.endpoint_url,
        temperature: body.temperature || 0.1,
        max_tokens: body.max_tokens,
        timeout_seconds: body.timeout_seconds || 60,
        retry_attempts: body.retry_attempts || 3,
        confidence_threshold: body.confidence_threshold || 0.8,
        enable_quick_analysis: true,
        enable_document_analysis: true,
        auto_categorization: true
      };

      const result = await systemSettingsService.setReceiptAIConfig(config);
      
      if (!result.success) {
        return reply.code(400).send({ 
          error: 'Configuration validation failed',
          details: result.error,
          validation_errors: undefined
        });
      }

      return reply.send({ success: true });
    } catch (error) {
      server.log.error({ err: error }, 'Error saving configuration');
      return reply.code(500).send({ 
        error: 'Failed to save configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get AI provider configuration (without API keys)
  server.get('/api/ai-providers/config', async (request, reply) => {
    const user = await requireSupabaseUser(request, reply);
    if (!user) return;

    try {
      const authenticatedSupabase = makeSupabaseForRequest({ SUPABASE_URL, SUPABASE_ANON_KEY }, request);
      if (!authenticatedSupabase) {
        return reply.code(401).send({ error: 'Authentication required' });
      }

      const systemSettingsService = new SystemSettingsService(authenticatedSupabase);
      const config = await systemSettingsService.getReceiptAIConfig();

      // Return config without sensitive data
      const sanitizedConfig = {
        provider: config.provider,
        model: config.model,
        use_system_key: config.use_system_key,
        endpoint_url: config.endpoint_url,
        temperature: config.temperature,
        max_tokens: config.max_tokens,
        timeout_seconds: config.timeout_seconds,
        retry_attempts: config.retry_attempts,
        confidence_threshold: config.confidence_threshold,
        enable_quick_analysis: config.enable_quick_analysis,
        enable_document_analysis: config.enable_document_analysis,
        auto_categorization: config.auto_categorization
      };

      return reply.send(sanitizedConfig);
    } catch (error) {
      server.log.error({ err: error }, 'Error loading configuration');
      return reply.code(500).send({ 
        error: 'Failed to load configuration',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}