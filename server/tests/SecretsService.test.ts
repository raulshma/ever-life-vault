import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SecretsService } from '../services/SecretsService.js';
import * as crypto from 'crypto';

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn()
}));

// Mock crypto for consistent testing
vi.mock('crypto', async () => {
  const actual = await vi.importActual('crypto');
  return {
    ...actual,
    randomBytes: vi.fn((size: number) => Buffer.alloc(size, 0)), // Predictable random bytes
    pbkdf2Sync: vi.fn(() => Buffer.alloc(32, 1)), // Predictable key derivation
    createCipheriv: vi.fn(() => ({
      update: vi.fn(() => 'encrypted'),
      final: vi.fn(() => ''),
      getAuthTag: vi.fn(() => Buffer.alloc(16, 0))
    })),
    createDecipheriv: vi.fn(() => ({
      setAuthTag: vi.fn(),
      update: vi.fn(() => 'decrypted'),
      final: vi.fn(() => '')
    }))
  };
});

describe('SecretsService', () => {
  let secretsService: SecretsService;
  let mockSupabaseClient: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Set up environment variables
    process.env.SECRETS_SALT = 'test-salt';

    // Create mock Supabase client
    mockSupabaseClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    };

    secretsService = new SecretsService(mockSupabaseClient);
    
    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SECRETS_SALT;
  });

  describe('constructor', () => {
    it('should initialize with Supabase client', () => {
      expect(() => new SecretsService(mockSupabaseClient)).not.toThrow();
    });

    it('should throw error if client is missing', () => {
      expect(() => new SecretsService(null as unknown as ReturnType<typeof vi.fn>)).toThrow('Authenticated Supabase client is required');
    });
  });

  describe('storeSecret', () => {
    it('should store an encrypted secret successfully', async () => {
      const mockUpsert = vi.fn(() => ({ error: null }));
      mockSupabaseClient.from.mockReturnValue({
        upsert: mockUpsert
      });

      await secretsService.storeSecret('TEST_SECRET', 'secret-value', 'user-123');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('infrastructure_secrets');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          key: 'TEST_SECRET',
          encrypted_value: expect.any(String),
          updated_at: expect.any(String)
        }),
        { onConflict: 'user_id,key' }
      );
    });

    it('should validate required parameters', async () => {
      await expect(secretsService.storeSecret('', 'value', 'user-123'))
        .rejects.toThrow('Key, value, and userId are required');
      
      await expect(secretsService.storeSecret('KEY', '', 'user-123'))
        .rejects.toThrow('Key, value, and userId are required');
      
      await expect(secretsService.storeSecret('KEY', 'value', ''))
        .rejects.toThrow('Key, value, and userId are required');
    });

    it('should handle database errors', async () => {
      const mockUpsert = vi.fn(() => ({ error: { message: 'Database error' } }));
      mockSupabaseClient.from.mockReturnValue({
        upsert: mockUpsert
      });

      await expect(secretsService.storeSecret('TEST_SECRET', 'value', 'user-123'))
        .rejects.toThrow('Failed to store secret: Database error');
    });
  });

  describe('retrieveSecret', () => {
    it('should retrieve and decrypt a secret successfully', async () => {
      const mockSingle = vi.fn(() => ({
        data: { 
          encrypted_value: 'encrypted-data',
          iv: 'test-iv',
          auth_tag: 'test-auth-tag',
          salt: 'test-salt'
        },
        error: null
      }));
      
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: mockSingle
            }))
          }))
        }))
      });

      const result = await secretsService.retrieveSecret('TEST_SECRET', 'user-123');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('infrastructure_secrets');
      expect(result).toBeDefined();
    });

    it('should return null for non-existent secrets', async () => {
      const mockSingle = vi.fn(() => ({
        data: null,
        error: { code: 'PGRST116' } // No rows returned
      }));
      
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: mockSingle
            }))
          }))
        }))
      });

      const result = await secretsService.retrieveSecret('NON_EXISTENT', 'user-123');

      expect(result).toBeNull();
    });

    it('should validate required parameters', async () => {
      await expect(secretsService.retrieveSecret('', 'user-123'))
        .rejects.toThrow('Key and userId are required');
      
      await expect(secretsService.retrieveSecret('KEY', ''))
        .rejects.toThrow('Key and userId are required');
    });
  });

  describe('listSecretKeys', () => {
    it('should list all secret keys for a user', async () => {
      const mockOrder = vi.fn(() => ({
        data: [{ key: 'SECRET_1' }, { key: 'SECRET_2' }],
        error: null
      }));
      
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: mockOrder
          }))
        }))
      });

      const result = await secretsService.listSecretKeys('user-123');

      expect(result).toEqual(['SECRET_1', 'SECRET_2']);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('infrastructure_secrets');
    });

    it('should return empty array when no secrets exist', async () => {
      const mockOrder = vi.fn(() => ({
        data: null,
        error: null
      }));
      
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: mockOrder
          }))
        }))
      });

      const result = await secretsService.listSecretKeys('user-123');

      expect(result).toEqual([]);
    });

    it('should validate userId parameter', async () => {
      await expect(secretsService.listSecretKeys(''))
        .rejects.toThrow('UserId is required');
    });
  });

  describe('deleteSecret', () => {
    it('should delete a secret successfully', async () => {
      const mockDelete = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ error: null }))
        }))
      }));
      
      mockSupabaseClient.from.mockReturnValue({
        delete: mockDelete
      });

      await secretsService.deleteSecret('TEST_SECRET', 'user-123');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('infrastructure_secrets');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should validate required parameters', async () => {
      await expect(secretsService.deleteSecret('', 'user-123'))
        .rejects.toThrow('Key and userId are required');
      
      await expect(secretsService.deleteSecret('KEY', ''))
        .rejects.toThrow('Key and userId are required');
    });
  });

  describe('utility methods', () => {
    it('should sanitize secret keys correctly', () => {
      expect(secretsService.sanitizeSecretKey('my-secret-key')).toBe('MY_SECRET_KEY');
      expect(secretsService.sanitizeSecretKey('123invalid')).toBe('SECRET_123INVALID');
      expect(secretsService.sanitizeSecretKey('special@chars!')).toBe('SPECIAL_CHARS');
      expect(secretsService.sanitizeSecretKey('__multiple__underscores__')).toBe('MULTIPLE_UNDERSCORES');
    });

    it('should generate random secrets', () => {
      const secret1 = secretsService.generateRandomSecret(16);
      const secret2 = secretsService.generateRandomSecret(16);
      
      expect(secret1).toBeDefined();
      expect(secret2).toBeDefined();
      expect(secret1.length).toBeGreaterThan(0);
      expect(secret2.length).toBeGreaterThan(0);
    });

    it('should detect secret placeholders', () => {
      expect(secretsService.hasSecretPlaceholders('${SECRET_KEY}')).toBe(true);
      expect(secretsService.hasSecretPlaceholders('no secrets here')).toBe(false);
      expect(secretsService.hasSecretPlaceholders('${SECRET1} and ${SECRET2}')).toBe(true);
    });

    it('should extract secret placeholders', () => {
      const content = 'DB_PASSWORD=${DB_PASSWORD} and API_KEY=${API_KEY}';
      const placeholders = secretsService.extractSecretPlaceholders(content);
      
      expect(placeholders).toEqual(['DB_PASSWORD', 'API_KEY']);
    });

    it('should handle duplicate placeholders', () => {
      const content = '${SECRET} and ${SECRET} again';
      const placeholders = secretsService.extractSecretPlaceholders(content);
      
      expect(placeholders).toEqual(['SECRET']);
    });
  });
});