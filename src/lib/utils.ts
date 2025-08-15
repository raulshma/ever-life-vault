import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Security utilities for input validation and sanitization
 */

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string') return '';
  
  // Create a temporary DOM element to parse and sanitize HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Remove dangerous tags
  const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button', 'link', 'meta', 'style'];
  dangerousTags.forEach(tag => {
    const elements = tempDiv.getElementsByTagName(tag);
    while (elements.length > 0) {
      elements[0].remove();
    }
  });
  
  // Remove dangerous attributes from remaining elements
  const allElements = tempDiv.getElementsByTagName('*');
  for (let i = 0; i < allElements.length; i++) {
    const element = allElements[i];
    const attributes = element.attributes;
    
    for (let j = attributes.length - 1; j >= 0; j--) {
      const attr = attributes[j];
      const attrName = attr.name.toLowerCase();
      const attrValue = attr.value.toLowerCase();
      
      // Remove event handlers
      if (attrName.startsWith('on')) {
        element.removeAttribute(attrName);
        continue;
      }
      
      // Remove dangerous protocols
      if (attrValue.includes('javascript:') || attrValue.includes('data:') || attrValue.includes('vbscript:')) {
        element.removeAttribute(attrName);
        continue;
      }
      
      // For href/src with dangerous protocols, set to empty string instead of removing
      if ((attrName === 'href' || attrName === 'src') && 
          (attrValue.startsWith('javascript:') || attrValue.startsWith('data:') || attrValue.startsWith('vbscript:'))) {
        element.setAttribute(attrName, '');
      }
    }
  }
  
  return tempDiv.innerHTML;
}

/**
 * Validate and sanitize user input with security checks
 */
export function validateInput(input: any, maxLength: number = 1000): string {
  if (typeof input !== 'string') return '';
  
  let sanitized = input.trim();
  
  // Block dangerous patterns
  const dangerousPatterns = [
    /javascript:/gi,
    /data:/gi,
    /vbscript:/gi,
    /<script/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<form/gi,
    /on\w+\s*=/gi,
    /DROP\s+TABLE/gi,
    /UNION\s+SELECT/gi,
    /xp_cmdshell/gi,
    /\.\.\//g,
    /\.\.\\/g,
    /etc\/passwd/gi,
    /windows\\system32/gi,
    /[;&|`$()]/g,
  ];
  
  dangerousPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Validate email format with stricter rules
 */
export function validateEmail(email: string): boolean {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (!trimmed) return false;
  
  // Check for consecutive dots or dots at start/end
  if (trimmed.includes('..') || trimmed.startsWith('.') || trimmed.endsWith('.')) {
    return false;
  }
  
  // Check for valid domain structure
  const parts = trimmed.split('@');
  if (parts.length !== 2) return false;
  
  const [local, domain] = parts;
  if (!local || !domain) return false;
  
  // Domain must have at least one dot and not start/end with dot
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed);
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): boolean {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate file type based on extension
 */
export function validateFileType(filename: string, allowedExtensions: string[]): boolean {
  if (typeof filename !== 'string') return false;
  const extension = filename.toLowerCase().split('.').pop();
  return extension ? allowedExtensions.includes(extension) : false;
}

/**
 * Generate a secure random string
 */
export function generateSecureRandomString(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomArray = new Uint8Array(length);
  crypto.getRandomValues(randomArray);
  for (let i = 0; i < length; i++) {
    result += chars[randomArray[i] % chars.length];
  }
  return result;
}

/**
 * Utility for batching multiple database operations
 * This helps reduce the number of database round trips
 */
export class BatchDBOperations {
  private operations: Array<() => Promise<any>> = []
  private results: any[] = []

  /**
   * Add a database operation to the batch
   */
  add<T>(operation: () => Promise<T>): void {
    this.operations.push(operation)
  }

  /**
   * Execute all operations in parallel
   */
  async execute(): Promise<any[]> {
    if (this.operations.length === 0) {
      return []
    }

    try {
      this.results = await Promise.all(this.operations.map(op => op()))
      return this.results
    } catch (error) {
      console.error('Batch database operations failed:', error)
      throw error
    }
  }

  /**
   * Execute operations sequentially (useful when order matters)
   */
  async executeSequential(): Promise<any[]> {
    if (this.operations.length === 0) {
      return []
    }

    this.results = []
    for (const operation of this.operations) {
      try {
        const result = await operation()
        this.results.push(result)
      } catch (error) {
        console.error('Sequential database operation failed:', error)
        throw error
      }
    }
    return this.results
  }

  /**
   * Clear all operations
   */
  clear(): void {
    this.operations = []
    this.results = []
  }

  /**
   * Get the number of pending operations
   */
  get size(): number {
    return this.operations.length
  }
}

/**
 * Helper function to create a batch operation
 */
export function createBatchDBOperations(): BatchDBOperations {
  return new BatchDBOperations()
}

/**
 * Database connection pool utility for optimizing Supabase connections
 * This helps reduce connection overhead and improve performance
 */
export class DatabaseConnectionPool {
  private connections: Map<string, { client: any; lastUsed: number; inUse: boolean }> = new Map()
  private maxConnections: number
  private connectionTimeout: number
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(maxConnections = 5, connectionTimeout = 300000) { // 5 minutes default
    this.maxConnections = maxConnections
    this.connectionTimeout = connectionTimeout
    this.startCleanup()
  }

  /**
   * Get or create a database connection for a specific user/context
   */
  async getConnection(key: string, createClient: () => any): Promise<any> {
    const existing = this.connections.get(key)
    
    if (existing && !existing.inUse) {
      existing.lastUsed = Date.now()
      existing.inUse = true
      return existing.client
    }

    // Check if we're at max connections
    if (this.connections.size >= this.maxConnections) {
      // Find oldest unused connection to evict
      const oldestKey = Array.from(this.connections.entries())
        .filter(([_, conn]) => !conn.inUse)
        .sort(([_, a], [__, b]) => a.lastUsed - b.lastUsed)[0]?.[0]
      
      if (oldestKey) {
        this.connections.delete(oldestKey)
      }
    }

    const client = createClient()
    this.connections.set(key, {
      client,
      lastUsed: Date.now(),
      inUse: true
    })

    return client
  }

  /**
   * Release a connection back to the pool
   */
  releaseConnection(key: string): void {
    const connection = this.connections.get(key)
    if (connection) {
      connection.inUse = false
      connection.lastUsed = Date.now()
    }
  }

  /**
   * Clean up expired connections
   */
  private cleanup(): void {
    const now = Date.now()
    for (const [key, connection] of this.connections.entries()) {
      if (!connection.inUse && (now - connection.lastUsed) > this.connectionTimeout) {
        this.connections.delete(key)
      }
    }
  }

  /**
   * Start periodic cleanup
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000) // Clean up every minute
  }

  /**
   * Stop the connection pool and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.connections.clear()
  }

  /**
   * Get pool statistics
   */
  getStats(): { total: number; inUse: number; available: number } {
    let inUse = 0
    for (const connection of this.connections.values()) {
      if (connection.inUse) inUse++
    }
    
    return {
      total: this.connections.size,
      inUse,
      available: this.connections.size - inUse
    }
  }
}

/**
 * Helper function to create a database connection pool
 */
export function createDatabaseConnectionPool(maxConnections?: number, connectionTimeout?: number): DatabaseConnectionPool {
  return new DatabaseConnectionPool(maxConnections, connectionTimeout)
}
