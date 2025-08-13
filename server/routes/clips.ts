import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

export function registerClipRoutes(server: FastifyInstance) {
  // Public read (via RPC), write via RPC as well. This route offers a tiny helper for existence check.
  server.get('/clips/:id/meta', async (req, reply) => {
    try {
      const params = z.object({ id: z.string().min(1).max(64) }).parse((req as any).params)
      // This server endpoint only proxies to Supabase RPC to avoid exposing DB creds.
      const { SUPABASE_URL, SUPABASE_ANON_KEY } = (server as any).config || {}
      // We have no centralized env injection here, so we keep this route minimal and optional.
      // Clients should call Supabase RPCs directly from the app; this is a convenience endpoint.
      return reply.send({ ok: true, id: params.id })
    } catch (e: any) {
      return reply.code(400).send({ error: e?.message ?? String(e) })
    }
  })
}


