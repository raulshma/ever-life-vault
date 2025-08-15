import { describe, it, expect, beforeEach } from 'vitest'
import { 
  sanitizeHtml, 
  validateInput, 
  validateEmail, 
  validateUrl, 
  escapeHtml, 
  validateFileType, 
  generateSecureRandomString 
} from '../utils'
import { securityTestUtils } from '../../test-setup'

describe('Security Utilities', () => {
  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const input = '<p>Hello</p><script>alert("xss")</script><div>World</div>'
      const result = sanitizeHtml(input)
      expect(result).toBe('<p>Hello</p><div>World</div>')
    })

    it('should remove javascript: protocol', () => {
      const input = '<a href="javascript:alert(\'xss\')">Click me</a>'
      const result = sanitizeHtml(input)
      expect(result).toBe('<a href="">Click me</a>')
    })

    it('should remove event handlers', () => {
      const input = '<img src="test.jpg" onload="alert(\'xss\')" alt="test">'
      const result = sanitizeHtml(input)
      expect(result).toBe('<img src="test.jpg" alt="test">')
    })

    it('should remove dangerous HTML elements', () => {
      const input = '<iframe src="evil.com"></iframe><object data="evil.swf"></object>'
      const result = sanitizeHtml(input)
      expect(result).toBe('')
    })

    it('should preserve safe HTML', () => {
      const input = '<p>Hello <strong>World</strong></p>'
      const result = sanitizeHtml(input)
      expect(result).toBe(input)
    })
  })

  describe('validateInput', () => {
    it('should validate string input', () => {
      expect(validateInput('Hello World')).toBe('Hello World')
      expect(validateInput('   Trim me   ')).toBe('Trim me')
    })

    it('should handle non-string input', () => {
      expect(validateInput(null)).toBe('')
      expect(validateInput(undefined)).toBe('')
      expect(validateInput(123)).toBe('')
      expect(validateInput({})).toBe('')
    })

    it('should respect max length', () => {
      const longString = 'a'.repeat(100)
      const result = validateInput(longString, 50)
      expect(result.length).toBe(50)
    })

    it('should handle empty strings', () => {
      expect(validateInput('')).toBe('')
      expect(validateInput('   ')).toBe('')
    })
  })

  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      expect(validateEmail('user@example.com')).toBe(true)
      expect(validateEmail('user.name@domain.co.uk')).toBe(true)
      expect(validateEmail('user+tag@example.org')).toBe(true)
    })

    it('should reject invalid email formats', () => {
      expect(validateEmail('invalid-email')).toBe(false)
      expect(validateEmail('user@')).toBe(false)
      expect(validateEmail('@domain.com')).toBe(false)
      expect(validateEmail('user@domain')).toBe(false)
      expect(validateEmail('')).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(validateEmail('user@domain..com')).toBe(false)
      expect(validateEmail('user@.domain.com')).toBe(false)
      expect(validateEmail('user@domain.com.')).toBe(false)
    })
  })

  describe('validateUrl', () => {
    it('should validate correct URL formats', () => {
      expect(validateUrl('https://example.com')).toBe(true)
      expect(validateUrl('http://localhost:3000')).toBe(true)
      expect(validateUrl('https://sub.domain.com/path?param=value')).toBe(true)
    })

    it('should reject invalid URL formats', () => {
      expect(validateUrl('not-a-url')).toBe(false)
      expect(validateUrl('ftp://example.com')).toBe(false)
      expect(validateUrl('javascript:alert("xss")')).toBe(false)
      expect(validateUrl('')).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(validateUrl('https://')).toBe(false)
      expect(validateUrl('http://')).toBe(false)
    })
  })

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>'))
        .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
    })

    it('should handle all special characters', () => {
      expect(escapeHtml('&<>"\'/'))
        .toBe('&amp;&lt;&gt;&quot;&#x27;&#x2F;')
    })

    it('should preserve safe text', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World')
      expect(escapeHtml('123')).toBe('123')
    })

    it('should handle empty strings', () => {
      expect(escapeHtml('')).toBe('')
    })
  })

  describe('validateFileType', () => {
    const allowedTypes = ['jpg', 'png', 'pdf', 'txt']

    it('should validate allowed file types', () => {
      expect(validateFileType('document.pdf', allowedTypes)).toBe(true)
      expect(validateFileType('image.jpg', allowedTypes)).toBe(true)
      expect(validateFileType('file.txt', allowedTypes)).toBe(true)
    })

    it('should reject disallowed file types', () => {
      expect(validateFileType('script.js', allowedTypes)).toBe(false)
      expect(validateFileType('executable.exe', allowedTypes)).toBe(false)
      expect(validateFileType('malware.bat', allowedTypes)).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(validateFileType('', allowedTypes)).toBe(false)
      expect(validateFileType('noextension', allowedTypes)).toBe(false)
      expect(validateFileType('.hidden', allowedTypes)).toBe(false)
    })
  })

  describe('generateSecureRandomString', () => {
    it('should generate strings of correct length', () => {
      const result = generateSecureRandomString(16)
      expect(result.length).toBe(16)
    })

    it('should generate different strings on each call', () => {
      const result1 = generateSecureRandomString(10)
      const result2 = generateSecureRandomString(10)
      expect(result1).not.toBe(result2)
    })

    it('should only contain allowed characters', () => {
      const result = generateSecureRandomString(100)
      expect(result).toMatch(/^[A-Za-z0-9]+$/)
    })

    it('should handle default length', () => {
      const result = generateSecureRandomString()
      expect(result.length).toBe(32)
    })
  })

  describe('XSS Prevention', () => {
    it('should sanitize all XSS payloads', () => {
      securityTestUtils.xssPayloads.forEach(payload => {
        const sanitized = sanitizeHtml(payload)
        expect(sanitized).not.toContain('<script>')
        expect(sanitized).not.toContain('javascript:')
        expect(sanitized).not.toContain('onload=')
        expect(sanitized).not.toContain('data:')
        expect(sanitized).not.toContain('vbscript:')
      })
    })

    it('should preserve safe inputs', () => {
      securityTestUtils.safeInputs.forEach(input => {
        const sanitized = sanitizeHtml(input)
        expect(sanitized).toBe(input)
      })
    })
  })

  describe('Input Validation', () => {
    it('should reject SQL injection attempts', () => {
      securityTestUtils.sqlInjectionPayloads.forEach(payload => {
        const sanitized = validateInput(payload)
        expect(sanitized).not.toContain('DROP TABLE')
        expect(sanitized).not.toContain('UNION SELECT')
        expect(sanitized).not.toContain('xp_cmdshell')
      })
    })

    it('should reject path traversal attempts', () => {
      securityTestUtils.pathTraversalPayloads.forEach(payload => {
        const sanitized = validateInput(payload)
        expect(sanitized).not.toContain('..')
        expect(sanitized).not.toContain('etc/passwd')
        expect(sanitized).not.toContain('windows/system32')
      })
    })

    it('should reject command injection attempts', () => {
      securityTestUtils.commandInjectionPayloads.forEach(payload => {
        const sanitized = validateInput(payload)
        expect(sanitized).not.toContain(';')
        expect(sanitized).not.toContain('|')
        expect(sanitized).not.toContain('&&')
        expect(sanitized).not.toContain('$(')
        expect(sanitized).not.toContain('`')
      })
    })
  })
})
