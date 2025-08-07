/**
 * Cryptographic utilities for end-to-end encryption
 * Uses industry-standard AES-256-GCM with PBKDF2 key derivation
 */

// Crypto configuration constants
export const CRYPTO_CONFIG = {
  PBKDF2_ITERATIONS: 100000, // OWASP recommended minimum
  SALT_LENGTH: 32, // 256 bits
  IV_LENGTH: 12, // 96 bits for GCM
  KEY_LENGTH: 32, // 256 bits
  TAG_LENGTH: 16, // 128 bits for GCM authentication tag
} as const;

/**
 * Generate a cryptographically secure random salt
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.SALT_LENGTH));
}

/**
 * Generate a cryptographically secure random IV
 */
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.IV_LENGTH));
}

/**
 * Derive encryption key from master password using PBKDF2
 */
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  // Derive AES key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: CRYPTO_CONFIG.PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: CRYPTO_CONFIG.KEY_LENGTH * 8, // Convert to bits
    },
    false, // Not extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt data using AES-256-GCM
 */
export async function encryptData(
  data: string,
  key: CryptoKey,
  iv?: Uint8Array
): Promise<{
  encryptedData: ArrayBuffer;
  iv: Uint8Array;
  authTag: Uint8Array;
}> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  // Generate IV if not provided
  const actualIV = iv || generateIV();
  
  // Encrypt with AES-GCM
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: actualIV,
      tagLength: CRYPTO_CONFIG.TAG_LENGTH * 8, // Convert to bits
    },
    key,
    dataBuffer
  );
  
  // Extract encrypted data and authentication tag
  const encryptedData = encryptedBuffer.slice(0, -CRYPTO_CONFIG.TAG_LENGTH);
  const authTag = encryptedBuffer.slice(-CRYPTO_CONFIG.TAG_LENGTH);
  
  return {
    encryptedData,
    iv: actualIV,
    authTag: new Uint8Array(authTag),
  };
}

/**
 * Decrypt data using AES-256-GCM
 */
export async function decryptData(
  encryptedData: ArrayBuffer,
  key: CryptoKey,
  iv: Uint8Array,
  authTag: Uint8Array
): Promise<string> {
  // Combine encrypted data with auth tag for GCM
  const combinedBuffer = new Uint8Array(encryptedData.byteLength + authTag.byteLength);
  combinedBuffer.set(new Uint8Array(encryptedData), 0);
  combinedBuffer.set(authTag, encryptedData.byteLength);
  
  try {
    // Decrypt with AES-GCM
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: CRYPTO_CONFIG.TAG_LENGTH * 8,
      },
      key,
      combinedBuffer
    );
    
    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (error) {
    throw new Error('Decryption failed - invalid key or corrupted data');
  }
}

/**
 * Convert ArrayBuffer to base64 string for storage
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string back to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Convert Uint8Array to base64 string
 */
export function uint8ArrayToBase64(array: Uint8Array): string {
  return arrayBufferToBase64(array.buffer);
}

/**
 * Convert base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  return new Uint8Array(base64ToArrayBuffer(base64));
}

/**
 * Validate master password strength
 */
export function validateMasterPassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Encrypted vault item structure for database storage
 */
export interface EncryptedVaultItem {
  id: string;
  user_id: string;
  encrypted_data: string; // Base64 encoded encrypted JSON
  iv: string; // Base64 encoded IV
  auth_tag: string; // Base64 encoded authentication tag
  item_type: 'login' | 'note' | 'api' | 'document';
  metadata: {
    name: string; // Unencrypted for search/display
    created_at: string;
    updated_at: string;
  };
}

/**
 * Decrypted vault item structure for client use
 */
export interface VaultItem {
  id: string;
  type: 'login' | 'note' | 'api' | 'document';
  name: string;
  data: {
    username?: string;
    password?: string;
    url?: string;
    notes?: string;
    apiKey?: string;
    content?: string;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

/**
 * Encrypt a vault item for storage
 */
export async function encryptVaultItem(
  item: Omit<VaultItem, 'id' | 'created_at' | 'updated_at'>,
  key: CryptoKey,
  userId: string
): Promise<Omit<EncryptedVaultItem, 'id'>> {
  const itemData = JSON.stringify(item.data);
  const { encryptedData, iv, authTag } = await encryptData(itemData, key);
  
  return {
    user_id: userId,
    encrypted_data: arrayBufferToBase64(encryptedData),
    iv: uint8ArrayToBase64(iv),
    auth_tag: uint8ArrayToBase64(authTag),
    item_type: item.type,
    metadata: {
      name: item.name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

/**
 * Decrypt a vault item from storage
 */
export async function decryptVaultItem(
  encryptedItem: EncryptedVaultItem,
  key: CryptoKey
): Promise<VaultItem> {
  const encryptedData = base64ToArrayBuffer(encryptedItem.encrypted_data);
  const iv = base64ToUint8Array(encryptedItem.iv);
  const authTag = base64ToUint8Array(encryptedItem.auth_tag);
  
  const decryptedDataString = await decryptData(encryptedData, key, iv, authTag);
  const data = JSON.parse(decryptedDataString);
  
  return {
    id: encryptedItem.id,
    type: encryptedItem.item_type,
    name: encryptedItem.metadata.name,
    data,
    created_at: encryptedItem.metadata.created_at,
    updated_at: encryptedItem.metadata.updated_at,
  };
}