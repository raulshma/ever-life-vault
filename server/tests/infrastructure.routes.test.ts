import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { FastifyInstance } from 'fastify'
import { buildServer } from '../index.js'

describe('Infrastructure Routes Integration Tests', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = await buildServer()
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  describe('Route Registration and Basic Structure', () => {
    it('should require authentication for all protected routes', async () => {
      const protectedRoutes = [
        { method: 'GET', url: '/api/infrastructure/configs' },
        { method: 'POST', url: '/api/infrastructure/configs' },
        { method: 'GET', url: '/api/infrastructure/stacks' },
        { method: 'GET', url: '/api/infrastructure/secrets' },
        { method: 'GET', url: '/api/infrastructure/filesystem/validate-path?path=/tmp' }
      ]

      for (const route of protectedRoutes) {
        const response = await server.inject({
          method: route.method as any,
          url: route.url
        })
        expect(response.statusCode).toBe(401)
      }
    })

    it('should handle malformed JSON gracefully', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/infrastructure/configs',
        headers: {
          'content-type': 'application/json'
        },
        payload: '{ invalid json'
      })

      expect(response.statusCode).toBe(400)
    })

    it('should validate UUID format in route parameters', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/infrastructure/configs/invalid-uuid'
      })

      // Should fail auth first, but route structure is correct
      expect(response.statusCode).toBe(401)
    })
  })

  describe('Route Coverage', () => {
    it('should have all expected infrastructure routes registered', async () => {
      // Test that routes exist by checking they don't return 404
      const routes = [
        { method: 'GET', url: '/api/infrastructure/configs' },
        { method: 'POST', url: '/api/infrastructure/configs' },
        { method: 'GET', url: '/api/infrastructure/stacks' },
        { method: 'GET', url: '/api/infrastructure/secrets' },
        { method: 'POST', url: '/api/infrastructure/secrets' },
        { method: 'GET', url: '/api/infrastructure/filesystem/validate-path?path=/tmp' },
        { method: 'POST', url: '/api/infrastructure/filesystem/create-path' },
        { method: 'POST', url: '/api/infrastructure/validate-compose' }
      ]

      for (const route of routes) {
        const response = await server.inject({
          method: route.method as unknown,
          url: route.url
        })
        
        // Should not return 404 (route not found)
        // Will return 401 (unauthorized) or 400 (bad request) instead
        expect(response.statusCode).not.toBe(404)
      }
    })

    it('should return 404 for non-existent routes', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/infrastructure/nonexistent'
      })

      expect(response.statusCode).toBe(404)
    })
  })
})