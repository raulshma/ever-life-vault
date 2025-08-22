import * as crypto from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';


export class SecretsService {
  private supabase: SupabaseClient;
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits

  constructor(supabaseClient: SupabaseClient) {
    if (!supabaseClient) {
      throw new Error('Authenticated Supabase client is required for SecretsService');
    }
    
    this.supabase = supabaseClient;
  }

  /**
   * Stores an encrypted secret for a user
   */
  async storeSecret(key: string, value: string, userId: string): Promise<void> {
    try {
      // Validate inputs
      if (!key || !value || !userId) {
        throw new Error('Key, value, and userId are required');
      }

      // Generate user-specific encryption key and salt
      const salt = crypto.randomBytes(32); // 256-bit salt
      const encryptionKey = this.generateUserKeyWithSalt(userId, salt);
      
      // Encrypt the secret value
      const encryptionResult = this.encryptWithSeparateFields(value, encryptionKey);
      
      // Store in database with upsert (insert or update)
      const { error } = await this.supabase
        .from('infrastructure_secrets')
        .upsert({
          user_id: userId,
          key: key,
          encrypted_value: encryptionResult.encrypted,
          iv: encryptionResult.iv,
          auth_tag: encryptionResult.authTag,
          salt: salt.toString('base64'),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,key'
        });

      if (error) {
        throw new Error(`Failed to store secret: ${error.message}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to store secret: ${errorMessage}`);
    }
  }

  /**
   * Retrieves and decrypts a secret for a user
   */
  async retrieveSecret(key: string, userId: string): Promise<string | null> {
    try {
      // Validate inputs
      if (!key || !userId) {
        throw new Error('Key and userId are required');
      }

      // Query the database
      const { data, error } = await this.supabase
        .from('infrastructure_secrets')
        .select('encrypted_value, iv, auth_tag, salt')
        .eq('user_id', userId)
        .eq('key', key)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned - secret doesn't exist
          return null;
        }
        throw new Error(`Failed to retrieve secret: ${error.message}`);
      }

      if (!data || !data.encrypted_value || !data.iv || !data.auth_tag || !data.salt) {
        return null;
      }

      // Generate user-specific encryption key using stored salt
      const salt = Buffer.from(data.salt as string, 'base64');
      const encryptionKey = this.generateUserKeyWithSalt(userId, salt);
      
      // Decrypt the secret value
      const decryptedValue = this.decryptWithSeparateFields({
        encrypted: data.encrypted_value as string,
        iv: data.iv as string,
        authTag: data.auth_tag as string
      }, encryptionKey);
      
      return decryptedValue;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      if (errorMessage.includes('No rows returned')) {
        return null;
      }
      throw new Error(`Failed to retrieve secret: ${errorMessage}`);
    }
  }

  /**
   * Lists all secret keys for a user (without values)
   */
  async listSecretKeys(userId: string): Promise<string[]> {
    try {
      if (!userId) {
        throw new Error('UserId is required');
      }

      const { data, error } = await this.supabase
        .from('infrastructure_secrets')
        .select('key')
        .eq('user_id', userId)
        .order('key');

      if (error) {
        throw new Error(`Failed to list secret keys: ${error.message}`);
      }

      return data ? data.map((row: { key: unknown }) => String(row.key)) : [];
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to list secret keys: ${errorMessage}`);
    }
  }

  /**
   * Deletes a secret for a user
   */
  async deleteSecret(key: string, userId: string): Promise<void> {
    try {
      if (!key || !userId) {
        throw new Error('Key and userId are required');
      }

      const { error } = await this.supabase
        .from('infrastructure_secrets')
        .delete()
        .eq('user_id', userId)
        .eq('key', key);

      if (error) {
        throw new Error(`Failed to delete secret: ${error.message}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to delete secret: ${errorMessage}`);
    }
  }

  /**
   * Injects secrets into a Docker Compose file content
   * Replaces placeholders like ${SECRET_NAME} with actual secret values
   */
  async injectSecrets(composeContent: string, userId: string): Promise<string> {
    try {
      if (!composeContent || !userId) {
        throw new Error('Compose content and userId are required');
      }

      // Find all secret placeholders in the format ${SECRET_NAME}
      const secretPlaceholders = composeContent.match(/\$\{([A-Z_][A-Z0-9_]*)\}/g);
      
      if (!secretPlaceholders || secretPlaceholders.length === 0) {
        // No secrets to inject
        return composeContent;
      }

      let injectedContent = composeContent;

      // Process each unique placeholder
      const uniquePlaceholders = [...new Set(secretPlaceholders)];
      
      for (const placeholder of uniquePlaceholders) {
        // Extract secret key from placeholder (remove ${ and })
        const secretKey = placeholder.slice(2, -1);
        
        // Retrieve the secret value
        const secretValue = await this.retrieveSecret(secretKey, userId);
        
        if (secretValue === null) {
          throw new Error(`Secret not found: ${secretKey}`);
        }

        // Replace all occurrences of this placeholder
        const regex = new RegExp(this.escapeRegExp(placeholder), 'g');
        injectedContent = injectedContent.replace(regex, secretValue);
      }

      return injectedContent;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to inject secrets: ${errorMessage}`);
    }
  }

  /**
   * Creates a template with placeholder secrets for export
   * Replaces actual secret values with placeholders like ${SECRET_NAME}
   */
  async createSecretTemplate(composeContent: string, userId: string, secretMappings: Record<string, string>): Promise<string> {
    try {
      if (!composeContent || !userId) {
        throw new Error('Compose content and userId are required');
      }

      let templateContent = composeContent;

      // Replace actual secret values with placeholders
      for (const [secretKey, secretValue] of Object.entries(secretMappings)) {
        if (secretValue) {
          // Escape special regex characters in the secret value
          const escapedValue = this.escapeRegExp(secretValue);
          const regex = new RegExp(escapedValue, 'g');
          templateContent = templateContent.replace(regex, `\${${secretKey}}`);
        }
      }

      return templateContent;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to create secret template: ${errorMessage}`);
    }
  }

  /**
   * Validates that all required secrets exist for a compose file
   */
  async validateSecretsExist(composeContent: string, userId: string): Promise<{ valid: boolean; missingSecrets: string[] }> {
    try {
      // Find all secret placeholders
      const secretPlaceholders = composeContent.match(/\$\{([A-Z_][A-Z0-9_]*)\}/g);
      
      if (!secretPlaceholders || secretPlaceholders.length === 0) {
        return { valid: true, missingSecrets: [] };
      }

      const uniqueSecretKeys = [...new Set(secretPlaceholders.map(p => p.slice(2, -1)))];
      const missingSecrets: string[] = [];

      // Check each secret exists
      for (const secretKey of uniqueSecretKeys) {
        const secretValue = await this.retrieveSecret(secretKey, userId);
        if (secretValue === null) {
          missingSecrets.push(secretKey);
        }
      }

      return {
        valid: missingSecrets.length === 0,
        missingSecrets
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to validate secrets: ${errorMessage}`);
    }
  }

  /**
   * Bulk import secrets from a key-value object
   */
  async bulkImportSecrets(secrets: Record<string, string>, userId: string): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    for (const [key, value] of Object.entries(secrets)) {
      try {
        await this.storeSecret(key, value, userId);
        imported++;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        errors.push(`Failed to import secret '${key}': ${errorMessage}`);
      }
    }

    return { imported, errors };
  }

  /**
   * Export all secrets for a user (for backup purposes)
   * Returns keys only, not values for security
   */
  async exportSecretKeys(userId: string): Promise<{ keys: string[]; count: number }> {
    try {
      const keys = await this.listSecretKeys(userId);
      return {
        keys,
        count: keys.length
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to export secret keys: ${errorMessage}`);
    }
  }

  // Private helper methods

  /**
   * Generates a user-specific encryption key (legacy method)
   */
  private generateUserKey(userId: string): Buffer {
    // Use PBKDF2 to derive a key from the user ID and a secret salt
    const salt = process.env.SECRETS_SALT || 'homelab-infrastructure-manager-salt';
    const iterations = 100000; // OWASP recommended minimum
    
    return crypto.pbkdf2Sync(userId, salt, iterations, this.keyLength, 'sha256');
  }

  /**
   * Generates a user-specific encryption key with custom salt
   */
  private generateUserKeyWithSalt(userId: string, salt: Buffer): Buffer {
    const iterations = 100000; // OWASP recommended minimum
    return crypto.pbkdf2Sync(userId, salt, iterations, this.keyLength, 'sha256');
  }

  /**
   * Encrypts a value using AES-256-GCM (legacy method)
   */
  private encrypt(text: string, key: Buffer): string {
    try {
      const iv = crypto.randomBytes(16); // 128-bit IV for GCM
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get the authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine IV, auth tag, and encrypted data
      const combined = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
      
      return combined;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown encryption error';
      throw new Error(`Encryption failed: ${errorMessage}`);
    }
  }

  /**
   * Encrypts a value using AES-256-GCM with separate fields
   */
  private encryptWithSeparateFields(text: string, key: Buffer): { encrypted: string; iv: string; authTag: string } {
    try {
      const iv = crypto.randomBytes(16); // 128-bit IV for GCM
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // Get the authentication tag
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64')
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown encryption error';
      throw new Error(`Encryption failed: ${errorMessage}`);
    }
  }

  /**
   * Decrypts a value using AES-256-GCM (legacy method)
   */
  private decrypt(encryptedData: string, key: Buffer): string {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown decryption error';
      throw new Error(`Decryption failed: ${errorMessage}`);
    }
  }

  /**
   * Decrypts a value using AES-256-GCM with separate fields
   */
  private decryptWithSeparateFields(data: { encrypted: string; iv: string; authTag: string }, key: Buffer): string {
    try {
      const iv = Buffer.from(data.iv, 'base64');
      const authTag = Buffer.from(data.authTag, 'base64');
      
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(data.encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown decryption error';
      throw new Error(`Decryption failed: ${errorMessage}`);
    }
  }

  /**
   * Escapes special regex characters
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Validates secret key format
   */
  private isValidSecretKey(key: string): boolean {
    // Secret keys should be uppercase with underscores, starting with a letter
    return /^[A-Z][A-Z0-9_]*$/.test(key);
  }

  /**
   * Sanitizes a secret key to ensure it follows naming conventions
   */
  sanitizeSecretKey(key: string): string {
    return key
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_')
      .replace(/^[0-9]/, 'SECRET_$&') // Ensure it starts with a letter
      .replace(/_+/g, '_') // Remove duplicate underscores
      .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
  }

  /**
   * Generates a secure random secret value
   */
  generateRandomSecret(length = 32): string {
    return crypto.randomBytes(length).toString('base64');
  }

  /**
   * Checks if a string contains secret placeholders
   */
  hasSecretPlaceholders(content: string): boolean {
    return /\$\{[A-Z_][A-Z0-9_]*\}/.test(content);
  }

  /**
   * Extracts all secret placeholder names from content
   */
  extractSecretPlaceholders(content: string): string[] {
    const matches = content.match(/\$\{([A-Z_][A-Z0-9_]*)\}/g);
    if (!matches) return [];
    
    return [...new Set(matches.map(match => match.slice(2, -1)))];
  }
}