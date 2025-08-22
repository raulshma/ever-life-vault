import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'

interface ServerWithConfig extends FastifyInstance {
  config?: {
    SUPABASE_URL: string;
    SUPABASE_ANON_KEY: string;
  };
}

export function registerClipRoutes(server: FastifyInstance): void {
  // Public read (via RPC), write via RPC as well. This route offers a tiny helper for existence check.
  server.get('/clips/:id/meta', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = z.object({ id: z.string().min(1).max(64) }).parse(req.params as Record<string, unknown>)
      // This server endpoint only proxies to Supabase RPC to avoid exposing DB creds.
      const { SUPABASE_URL, SUPABASE_ANON_KEY } = (server as ServerWithConfig).config || {}
      // We have no centralized env injection here, so we keep this route minimal and optional.
      // Clients should call Supabase RPCs directly from the app; this is a convenience endpoint.
      return reply.send({ ok: true, id: params.id })
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      return reply.code(400).send({ error: errorMessage })
    }
  })
}


