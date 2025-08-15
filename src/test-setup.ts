import '@testing-library/jest-dom'
import { vi, afterAll } from 'vitest'

// Mock crypto for tests
Object.defineProperty(window, 'crypto', {
  value: {
    getRandomValues: vi.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256)
      }
      return arr
    }),
    subtle: {
      importKey: vi.fn(),
      deriveKey: vi.fn(),
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      generateKey: vi.fn(),
      exportKey: vi.fn(),
      digest: vi.fn(),
    }
  }
})

// Mock localStorage and sessionStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock
})

// Mock fetch for API tests
global.fetch = vi.fn()

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      getSession: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          then: vi.fn(),
        })),
        then: vi.fn(),
      })),
      insert: vi.fn(() => ({
        then: vi.fn(),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          then: vi.fn(),
        })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          then: vi.fn(),
        })),
      })),
    })),
    rpc: vi.fn(() => ({
      then: vi.fn(),
    })),
  },
  SUPABASE_AUTH_STORAGE_KEY: 'test-auth-key',
  SUPABASE_NO_REMEMBER_FLAG_KEY: 'test-no-remember',
}))

// Security test utilities
export const securityTestUtils = {
  // Test XSS payloads
  xssPayloads: [
    '<script>alert("xss")</script>',
    'javascript:alert("xss")',
    'onload="alert(\'xss\')"',
    'data:text/html,<script>alert("xss")</script>',
    'vbscript:alert("xss")',
  ],
  
  // Test SQL injection payloads
  sqlInjectionPayloads: [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "' UNION SELECT * FROM users --",
    "'; EXEC xp_cmdshell('dir'); --",
  ],
  
  // Test path traversal payloads
  pathTraversalPayloads: [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
    '....//....//....//etc/passwd',
    '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
  ],
  
  // Test command injection payloads
  commandInjectionPayloads: [
    '; ls -la',
    '| cat /etc/passwd',
    '&& rm -rf /',
    '$(whoami)',
    '`id`',
  ],
  
  // Test for safe input
  safeInputs: [
    'Hello World',
    '12345',
    'user@example.com',
    'https://example.com',
    'Normal text with spaces',
  ],
}

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error
const originalConsoleWarn = console.warn
console.error = vi.fn()
console.warn = vi.fn()

// Restore console methods after tests
afterAll(() => {
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})