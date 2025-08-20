import type { FastifyInstance } from 'fastify'
// @ts-ignore - types are provided via local shims
import fastifyWebsocket from '@fastify/websocket'
// @ts-ignore - ambient types provided in server/types/external.d.ts
import { Client as SSHClient } from 'ssh2'
import { z } from 'zod'

type RequireUser = (request: any, reply: any) => Promise<any | null>

type Session = {
  id: string
  ssh: SSHClient
  stream?: any
  createdAt: number
  userId: string
}

const sessions = new Map<string, Session>()

export function registerSshRoutes(server: FastifyInstance, cfg: { requireSupabaseUser: RequireUser }) {
  const { requireSupabaseUser } = cfg

  // Ensure websocket plugin
  if (!(server as any).websocketServer) {
    server.register(fastifyWebsocket as any)
  }

  // Create SSH session via HTTP POST; returns sessionId
  server.post('/ssh/sessions', async (req, reply) => {
    const user = await requireSupabaseUser(req, reply)
    if (!user) return

    const body = z.object({
      host: z.string(),
      port: z.number().int().positive().default(22),
      username: z.string(),
      // Prefer key-based auth; password optional. One of password or privateKey must be present
      password: z.string().optional(),
      privateKey: z.string().optional(), // PEM string
      passphrase: z.string().optional(),
      readyTimeout: z.number().int().positive().optional(),
    }).parse((req as any).body || {})

    if (!body.password && !body.privateKey) {
      return reply.status(400).send({ error: 'auth_required', message: 'Provide password or privateKey' })
    }

  const ssh = new SSHClient()
    const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const session: Session = { id: sessionId, ssh, createdAt: Date.now(), userId: user.id }

    const connectOpts: any = {
      host: body.host,
      port: body.port || 22,
      username: body.username,
      readyTimeout: body.readyTimeout ?? 15000,
    }
    if (body.privateKey) connectOpts.privateKey = body.privateKey
    if (body.passphrase) connectOpts.passphrase = body.passphrase
    if (body.password) connectOpts.password = body.password

    await new Promise<void>((resolve, reject) => {
      ssh
        .on('ready', () => {
          sessions.set(sessionId, session)
          resolve()
        })
  .on('error', (err: any) => {
          reject(err)
        })
        .connect(connectOpts)
    }).catch((err) => {
      server.log.warn({ err }, 'SSH connection failed')
    })

    if (!sessions.has(sessionId)) {
      return reply.status(502).send({ error: 'ssh_connect_failed' })
    }

    return reply.send({ sessionId })
  })

  // Upgrade WS for interactive terminal binding to an existing session
  server.get('/ssh/sessions/:sessionId/attach', { websocket: true } as any, async (socket: any, req: any) => {
    // Log incoming WS attach request (trim headers that may contain large tokens)
    try {
      server.log.info({ url: req.url, method: req.method, headers: { host: req.headers?.host, origin: req.headers?.origin }, query: req.query }, 'SSH WS attach requested')
    } catch (e) {
      server.log.debug({ err: e }, 'Failed to log attach request metadata')
    }

    // Browser WS cannot set Authorization header; accept token in query param
    const token = (req.query?.token as string | undefined) || ''
    server.log.debug({ tokenLength: token?.length ?? 0, sessionQuery: req.params }, 'Attach token/query received')

    const fakeReq = { headers: { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } }
    let user: any = null
    try {
      user = await cfg.requireSupabaseUser(fakeReq, { code: () => ({ send: () => {} }) })
    } catch (err) {
      server.log.warn({ err }, 'Error while validating Supabase token on WS attach')
    }

    if (!user) {
      server.log.info({ reason: 'unauthorized' }, 'Rejecting WS attach - missing/invalid user')
      try { socket.close(4401, 'unauthorized') } catch (e) { server.log.debug({ e }, 'socket.close threw') }
      return
    }

    const { sessionId } = (req.params || {}) as any
    server.log.debug({ sessionId, userId: user?.id }, 'Looking up SSH session for attach')
    const session = sessions.get(sessionId)
    if (!session) {
      server.log.info({ sessionId }, 'No session found for attach')
      try { socket.close(4404, 'no_session') } catch (e) { server.log.debug({ e }, 'socket.close threw') }
      return
    }
    if (session.userId !== user.id) {
      server.log.info({ sessionId, sessionUserId: session.userId, userId: user.id }, 'Forbidden WS attach - user mismatch')
      try { socket.close(4403, 'forbidden') } catch (e) { server.log.debug({ e }, 'socket.close threw') }
      return
    }

    // Open a shell if not already
    const openShell = async () => {
      if (session.stream) return session.stream
      session.stream = await new Promise<any>((resolve, reject) => {
        session.ssh.shell({ term: 'xterm-256color' }, (err: Error | undefined, stream: any) => {
          if (err) return reject(err)
          resolve(stream)
        })
      })
      return session.stream
    }

    try {
      const stream = await openShell()
      server.log.info({ sessionId }, 'Shell opened for WS attach')

      // Data from SSH -> WS
      stream.on('data', (data: Buffer) => {
        try {
          socket.send(data)
        } catch (err) {
          server.log.warn({ err, sessionId }, 'Failed to send data over WS')
        }
      })
      stream.on('close', () => {
        server.log.info({ sessionId }, 'SSH shell stream closed')
        try { socket.close(1000, 'shell_closed') } catch (e) { server.log.debug({ e }, 'socket.close threw') }
      })
      session.ssh.on('close', () => {
        server.log.info({ sessionId }, 'SSH connection closed')
        sessions.delete(sessionId)
        try { socket.close(1000, 'ssh_closed') } catch (e) { server.log.debug({ e }, 'socket.close threw') }
      })

      // Data from WS -> SSH
      socket.on('message', (msg: any) => {
        try {
          if (typeof msg === 'string') {
            // Expect control messages as JSON
            try {
              const cmd = JSON.parse(msg)
              if (cmd.type === 'resize' && cmd.cols && cmd.rows) {
                stream.setWindow(cmd.rows, cmd.cols, cmd.height || 600, cmd.width || 800)
                server.log.debug({ sessionId, cols: cmd.cols, rows: cmd.rows }, 'Handled resize command')
                return
              }
            } catch {
              // treat as plain input
              stream.write(msg)
            }
          } else if (msg instanceof Buffer || Array.isArray(msg)) {
            stream.write(msg)
          }
        } catch (err) {
          server.log.warn({ err, sessionId }, 'Error handling WS message')
        }
      })

      socket.on('error', (err: any) => {
        server.log.warn({ err, sessionId }, 'SSH WS error')
      })

      socket.on('close', (code: number, reason: Buffer | string) => {
        server.log.info({ sessionId, code, reason: reason?.toString?.() }, 'SSH WS closed')
        // do not end SSH session immediately; keep it alive to allow reattach or multiple tabs? for now, end stream
        try { stream.end() } catch (e) { server.log.debug({ e }, 'stream.end threw') }
      })
    } catch (err) {
      server.log.warn({ err, sessionId }, 'Failed to open shell')
      try { socket.close(1011, 'shell_error') } catch (e) { server.log.debug({ e }, 'socket.close threw') }
    }
  })

  // Close and cleanup session
  server.delete('/ssh/sessions/:sessionId', async (req, reply) => {
    const user = await requireSupabaseUser(req, reply)
    if (!user) return
    const params = z.object({ sessionId: z.string() }).parse((req as any).params)
    const session = sessions.get(params.sessionId)
    if (session) {
      try { session.stream?.end() } catch {}
      try { session.ssh.end() } catch {}
      sessions.delete(params.sessionId)
    }
    return reply.send({ ok: true })
  })
}
