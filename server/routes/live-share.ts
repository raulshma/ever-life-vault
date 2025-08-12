import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type RequireUser = (request: any, reply: any) => Promise<any | null>;

export function registerLiveShareRoutes(
  server: FastifyInstance,
  cfg: { requireSupabaseUser: RequireUser; SUPABASE_URL?: string; SUPABASE_ANON_KEY?: string }
) {
  const { requireSupabaseUser, SUPABASE_URL, SUPABASE_ANON_KEY } = cfg;
  const makeClientForRequest = (req: any): SupabaseClient | null => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    const token = (req.headers?.authorization || req.headers?.Authorization)?.toString()?.replace(/^Bearer\s+/i, '') || undefined;
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    });
    return client;
  };

  server.post('/live-share/rooms/:roomId/invites', async (req, reply) => {
    const user = await requireSupabaseUser(req, reply);
    if (!user) return;
    const params = z.object({ roomId: z.string() }).parse((req as any).params);
    const body = z
      .object({ expiresAt: z.string(), maxUses: z.number().int().positive().default(1) })
      .parse((req as any).body || {});
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const supabase = makeClientForRequest(req);
    if (!supabase) return reply.code(500).send({ error: 'server_not_configured' });

    // Insert invite; RLS ensures only room creator can insert for this room
    const { error } = await supabase.from('live_share_invites').insert({
      code,
      room_id: params.roomId,
      created_by: user.id,
      expires_at: new Date(body.expiresAt).toISOString(),
      max_uses: body.maxUses,
    } as any);
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ code });
  });

  server.post('/live-share/join', async (req, reply) => {
    const supabase = makeClientForRequest(req);
    if (!supabase) return reply.code(500).send({ error: 'server_not_configured' });
    const body = z
      .object({ code: z.string(), displayName: z.string().min(1).max(80).optional() })
      .parse((req as any).body || {});
    const { data, error } = await supabase.rpc('redeem_live_share_invite', {
      _code: body.code,
      _display_name: body.displayName ?? 'Guest',
    });
    if (error) return reply.code(400).send({ error: error.message });
    const row = Array.isArray(data) ? (data as any)[0] : (data as any);
    return reply.send({ roomId: row?.room_id, participantId: row?.participant_id });
  });

  server.post('/live-share/rooms/:roomId/approve', async (req, reply) => {
    const user = await requireSupabaseUser(req, reply);
    if (!user) return;
    const supabase = makeClientForRequest(req);
    if (!supabase) return reply.code(500).send({ error: 'server_not_configured' });
    const body = z.object({ participantId: z.string().uuid() }).parse((req as any).body || {});
    const { error } = await supabase.rpc('set_live_share_participant_status', {
      _participant_id: body.participantId,
      _status: 'approved',
    });
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ ok: true });
  });

  server.post('/live-share/rooms/:roomId/ban', async (req, reply) => {
    const user = await requireSupabaseUser(req, reply);
    if (!user) return;
    const supabase = makeClientForRequest(req);
    if (!supabase) return reply.code(500).send({ error: 'server_not_configured' });
    const body = z.object({ participantId: z.string().uuid() }).parse((req as any).body || {});
    const { error } = await supabase.rpc('set_live_share_participant_status', {
      _participant_id: body.participantId,
      _status: 'banned',
    });
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ ok: true });
  });

  // Permissions: list current permissions for room
  server.get('/live-share/rooms/:roomId/permissions', async (req, reply) => {
    const supabase = makeClientForRequest(req);
    if (!supabase) return reply.code(500).send({ error: 'server_not_configured' });
    const params = z.object({ roomId: z.string() }).parse((req as any).params);
    const { data, error } = await supabase
      .from('live_share_permissions')
      .select('*')
      .eq('room_id', params.roomId)
      .order('created_at', { ascending: false });
    if (error) return reply.code(400).send({ error: error.message });
    return reply.send({ items: data || [] });
  });

  // Permissions: upsert a single guest permission record for room
  server.post('/live-share/rooms/:roomId/permissions', async (req, reply) => {
    const user = await requireSupabaseUser(req, reply);
    if (!user) return;
    const supabase = makeClientForRequest(req);
    if (!supabase) return reply.code(500).send({ error: 'server_not_configured' });
    const params = z.object({ roomId: z.string() }).parse((req as any).params);
    const body = z
      .object({
        resourceType: z.string().default('room'),
        grantedTo: z.string().default('guests'),
        actions: z.array(z.string()).min(0),
        expiresAt: z.string().optional(),
      })
      .parse((req as any).body || {});

    // Replace any existing record for (room, resourceType, grantedTo)
    const { error: delErr } = await supabase
      .from('live_share_permissions')
      .delete()
      .eq('room_id', params.roomId)
      .eq('resource_type', body.resourceType)
      .eq('granted_to', body.grantedTo);
    if (delErr) return reply.code(400).send({ error: delErr.message });

    const insertPayload: any = {
      room_id: params.roomId,
      resource_type: body.resourceType,
      resource_id: params.roomId,
      actions: body.actions,
      granted_to: body.grantedTo,
    };
    if (body.expiresAt) insertPayload.expires_at = new Date(body.expiresAt).toISOString();
    const { error: insErr } = await supabase.from('live_share_permissions').insert(insertPayload);
    if (insErr) return reply.code(400).send({ error: insErr.message });
    return reply.send({ ok: true });
  });
}



