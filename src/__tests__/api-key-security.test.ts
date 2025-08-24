/**
 * Security Test: Validate API Keys are Never Exposed
 * 
 * This test ensures that the settings system properly secures API keys
 * and never exposes them to the frontend or in network communications.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SystemSettingsService } from '../services/systemSettingsService';
import { ReceiptAIConfig, DEFAULT_RECEIPT_AI_CONFIG } from '../types/systemSettings';

// Mock fetch for testing
global.fetch = vi.fn();

describe('API Key Security Tests', () => {
  let mockSupabase: any;
  let systemSettingsService: SystemSettingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock Supabase client
    mockSupabase = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'mock-token' } }
        })
      }
    };
    
    systemSettingsService = new SystemSettingsService(mockSupabase);
  });

  describe('Frontend API Key Exposure Prevention', () => {
    it('should never include custom_api_key in ReceiptAIConfig type', () => {
      const config: ReceiptAIConfig = DEFAULT_RECEIPT_AI_CONFIG;
      
      // Ensure custom_api_key property doesn't exist in the type
      expect('custom_api_key' in config).toBe(false);
      
      // Verify that custom_endpoint is available for custom providers
      expect('custom_endpoint' in config).toBe(true);
    });

    it('should use custom_endpoint instead of custom_api_key for custom providers', () => {
      const config: ReceiptAIConfig = {
        ...DEFAULT_RECEIPT_AI_CONFIG,
        provider: 'custom',
        api_key_source: 'user',
        custom_endpoint: 'https://api.example.com'
      };
      
      expect(config.custom_endpoint).toBe('https://api.example.com');
      expect('custom_api_key' in config).toBe(false);
    });

    it('should not expose VITE_GOOGLE_API_KEY or VITE_OPENROUTER_API_KEY in environment', () => {
      // These should not be accessible in the frontend environment
      expect(import.meta.env.VITE_GOOGLE_API_KEY).toBeUndefined();
      expect(import.meta.env.VITE_OPENROUTER_API_KEY).toBeUndefined();
    });
  });

  describe('Backend API Communication Security', () => {
    it('should use backend API for storing API keys', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
      global.fetch = mockFetch;

      const result = await systemSettingsService.storeAPIKey('google', 'test-api-key');
      
      expect(mockFetch).toHaveBeenCalledWith('/api/ai-providers/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({
          provider: 'google',
          api_key: 'test-api-key'
        })
      });
      
      expect(result.success).toBe(true);
    });

    it('should use backend API for configuration without API keys', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          provider: 'google',
          model: 'gemini-2.5-flash',
          use_system_key: true,
          temperature: 0.1
        })
      });
      global.fetch = mockFetch;

      const config = await systemSettingsService.getReceiptAIConfig();
      
      expect(mockFetch).toHaveBeenCalledWith('/api/ai-providers/config', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      });
      
      // Verify no API keys in response
      expect('custom_api_key' in config).toBe(false);
      expect('api_key' in config).toBe(false);
    });

    it('should use backend API for connection testing', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          latency: 150,
          details: {
            configurationValid: true,
            apiKeyPresent: true,
            providerReachable: true,
            modelAvailable: true
          }
        })
      });
      global.fetch = mockFetch;

      const testConfig: ReceiptAIConfig = {
        ...DEFAULT_RECEIPT_AI_CONFIG,
        provider: 'google',
        model: 'gemini-2.5-flash',
        api_key_source: 'user'
      };

      const result = await systemSettingsService.testAIProviderConnection(testConfig);
      
      expect(mockFetch).toHaveBeenCalledWith('/api/ai-providers/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({
          provider: 'google',
          model: 'gemini-2.5-flash',
          use_system_key: false,
          endpoint_url: undefined
        })
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('API Key Status Checking', () => {
    it('should check API key status without exposing actual keys', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          has_user_key: true,
          has_system_key: false,
          provider: 'google'
        })
      });
      global.fetch = mockFetch;

      const status = await systemSettingsService.getAPIKeyStatus('google');
      
      expect(mockFetch).toHaveBeenCalledWith('/api/ai-providers/api-keys/google/status', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      });
      
      expect(status.hasUserKey).toBe(true);
      expect(status.hasSystemKey).toBe(false);
      
      // Verify no actual API key values in response
      expect('api_key' in status).toBe(false);
      expect('custom_api_key' in status).toBe(false);
    });
  });

  describe('Network Request Security', () => {
    it('should never include API keys in configuration requests', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });
      global.fetch = mockFetch;

      const config = {
        provider: 'google',
        model: 'gemini-2.5-flash',
        use_system_key: false,
        temperature: 0.1,
        timeout_seconds: 60,
        retry_attempts: 3,
        confidence_threshold: 0.8,
        enable_quick_analysis: true,
        enable_document_analysis: true,
        auto_categorization: true
      };

      await systemSettingsService.setReceiptAIConfig(config);
      
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      
      // Verify no sensitive data in request
      expect('api_key' in requestBody).toBe(false);
      expect('custom_api_key' in requestBody).toBe(false);
      expect(requestBody.provider).toBe('google');
      expect(requestBody.use_system_key).toBe(false);
    });
  });
});

describe('Environment Variable Security', () => {
  it('should not expose API keys in frontend environment variables', () => {
    // These should be undefined in the frontend
    expect(typeof import.meta.env.VITE_GOOGLE_API_KEY).toBe('undefined');
    expect(typeof import.meta.env.VITE_OPENROUTER_API_KEY).toBe('undefined');
  });

  it('should only expose non-sensitive environment variables', () => {
    // These are safe to expose to frontend
    expect(typeof import.meta.env.VITE_TURNSTILE_SITE_KEY).toBe('string');
  });
});