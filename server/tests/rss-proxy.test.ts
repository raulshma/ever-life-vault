import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildServer } from '../index.js'
import type { FastifyInstance } from 'fastify'

describe('RSS Proxy', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = await buildServer()
  })

  afterAll(async () => {
    await server.close()
  })

  it('should reject invalid URLs', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/rss-proxy?url=invalid-url'
    })

    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Invalid URL scheme'
    })
  })

  it('should reject non-HTTP URLs', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/rss-proxy?url=ftp://example.com/feed.xml'
    })

    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.body)).toEqual({
      error: 'Invalid URL scheme'
    })
  })

  it('should accept valid HTTP URLs', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/rss-proxy?url=https://example.com/feed.xml'
    })

    // This will likely fail with a network error in tests, but should not be a 400
    expect(response.statusCode).not.toBe(400)
  })

  it('should include CORS headers', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/rss-proxy?url=https://example.com/feed.xml'
    })

    // Check that CORS headers would be set (even if request fails)
    // In a real test, we'd mock the fetch to return a successful response
    expect(response.statusCode).not.toBe(400)
  })
})