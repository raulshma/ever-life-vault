/**
 * Cryptographic utilities for end-to-end encryption
 * Uses industry-standard AES-256-GCM with PBKDF2 key derivation
 */

// Crypto configuration constants
export const CRYPTO_CONFIG = {
  PBKDF2_ITERATIONS: 310000, // Increased for stronger KDF per OWASP 2023+ guidance
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
export async function deriveKey(password: string, salt: Uint8Array, extractable: boolean = false): Promise<CryptoKey> {
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
      salt: new Uint8Array(salt),
      iterations: CRYPTO_CONFIG.PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: CRYPTO_CONFIG.KEY_LENGTH * 8, // Convert to bits
    },
    extractable, // Extractable toggled based on caller need
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
      iv: new Uint8Array(actualIV),
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
        iv: new Uint8Array(iv),
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
  return arrayBufferToBase64(array.buffer as ArrayBuffer);
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

export type VaultItem = {
  id: string;
  type: 'login' | 'note' | 'api' | 'document' | 'ssh';
  name: string;
  data: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type EncryptedVaultItem = {
  id: string;
  user_id: string;
  encrypted_data: string; // base64
  iv: string; // base64
  auth_tag: string; // base64
  item_type: 'login' | 'note' | 'api' | 'document' | 'ssh';
  name: string;
  created_at: string;
  updated_at: string;
};

export async function encryptVaultItem(
  item: Omit<VaultItem, 'id' | 'created_at' | 'updated_at'>,
  key: CryptoKey,
  userId: string
): Promise<Omit<EncryptedVaultItem, 'id' | 'created_at' | 'updated_at'>> {
  const iv = generateIV();
  const plaintext = JSON.stringify(item.data);
  const { encryptedData, authTag } = await encryptData(plaintext, key, iv);

  return {
    user_id: userId,
    encrypted_data: arrayBufferToBase64(encryptedData),
    iv: uint8ArrayToBase64(iv),
    auth_tag: uint8ArrayToBase64(authTag),
    item_type: item.type,
    name: item.name,
  };
}

export async function decryptVaultItem(
  encryptedItem: EncryptedVaultItem,
  key: CryptoKey
): Promise<VaultItem> {
  const plaintext = await decryptData(
    base64ToArrayBuffer(encryptedItem.encrypted_data),
    key,
    base64ToUint8Array(encryptedItem.iv),
    base64ToUint8Array(encryptedItem.auth_tag)
  );

  return {
    id: encryptedItem.id,
    type: encryptedItem.item_type,
    name: encryptedItem.name,
    data: JSON.parse(plaintext),
    created_at: encryptedItem.created_at,
    updated_at: encryptedItem.updated_at,
  };
}

/**
 * Generate a new AES‑256‑GCM key.
 */
export async function generateAesKey(extractable: boolean = true): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    extractable,
    ['encrypt', 'decrypt']
  );
}

/**
 * Export an AES key (raw) to base64 for transport/storage.
 */
export async function exportAesKeyToBase64(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(raw);
}

/**
 * Import an AES key from a base64 string.
 */
export async function importAesKeyFromBase64(keyB64: string, extractable: boolean = true): Promise<CryptoKey> {
  const raw = base64ToArrayBuffer(keyB64);
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', extractable, ['encrypt', 'decrypt']);
}