import type { FastifyBaseLogger } from 'fastify'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export function createSupabaseClient(url?: string, anonKey?: string): SupabaseClient | null {
  if (!url || !anonKey) return null
  return createClient(url, anonKey)
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
      reply.code(401).send({ error: 'Missing Authorization header' })
      return null
    }
    const token = auth.toString().slice('Bearer '.length)
    try {
      const { data, error } = await supabase.auth.getUser(token)
      if (error || !data?.user) {
        reply.code(401).send({ error: 'Invalid token' })
        return null
      }
      return data.user
    } catch (e) {
      log.error(e)
      reply.code(401).send({ error: 'Auth verification failed' })
      return null
    }
  }
}


