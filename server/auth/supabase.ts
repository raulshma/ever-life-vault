import type { FastifyBaseLogger } from 'fastify'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function createSupabaseClient(url?: string, anonKey?: string, options?: any): SupabaseClient | null {
  if (!url || !anonKey) return null
  // Basic validation to avoid throwing inside supabase-js when URL is malformed
  try {
    // eslint-disable-next-line no-new
    new URL(url)
  } catch {
    return null
  }
  return createClient(url, anonKey, options)
}

export function requireSupabaseUserFactory(
  supabase: SupabaseClient | null,
  log: FastifyBaseLogger
) {
  return async function requireSupabaseUser(request: any, reply: any) {
    if (!supabase) {
      reply.code(500).send({ error: 'Server auth not configured' })
      return null
    }
    const auth = request.headers['authorization'] || request.headers['Authorization']
    if (!auth || !auth.toString().startsWith('Bearer ')) {
      log.debug({ hasAuthHeader: !!auth }, 'Missing or malformed Authorization header')
      reply.code(401).send({ error: 'Missing Authorization header' })
      return null
    }
    const token = auth.toString().slice('Bearer '.length)
    // Mask token in logs but provide length for diagnostics
    log.debug({ tokenLength: token.length, tokenPreview: token.slice(0, 6) + '...' }, 'Verifying supabase token')
    try {
      const { data, error } = await supabase.auth.getUser(token)
      if (error || !data?.user) {
        log.warn({ error, data }, 'Supabase token rejected')
        reply.code(401).send({ error: 'Invalid token' })
        return null
      }
      log.debug({ userId: data.user?.id }, 'Supabase token validated')
      return data.user
    } catch (e) {
      log.error({ err: e }, 'Auth verification failed')
      reply.code(401).send({ error: 'Auth verification failed' })
      return null
    }
  }
}


