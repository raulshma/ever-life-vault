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
  server.get('/ssh/sessions/:sessionId/attach', { websocket: true } as any, async (connection: any, req: any) => {
    // Browser WS cannot set Authorization header; accept token in query param
    const token = (req.query?.token as string | undefined) || ''
    const fakeReq = { headers: { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } }
  const user = await cfg.requireSupabaseUser(fakeReq, { code: () => ({ send: () => {} }) })
    if (!user) {
      connection.socket.close(4401, 'unauthorized')
      return
    }

  const { sessionId } = (req.params || {}) as any
    const session = sessions.get(sessionId)
    if (!session) {
      connection.socket.close(4404, 'no_session')
      return
    }
    if (session.userId !== user.id) {
      connection.socket.close(4403, 'forbidden')
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
      // Data from SSH -> WS
      stream.on('data', (data: Buffer) => {
        try { connection.socket.send(data) } catch {}
      })
      stream.on('close', () => {
        try { connection.socket.close(1000, 'shell_closed') } catch {}
      })
      session.ssh.on('close', () => {
        sessions.delete(sessionId)
        try { connection.socket.close(1000, 'ssh_closed') } catch {}
      })

      // Data from WS -> SSH
  connection.socket.on('message', (msg: any) => {
        if (typeof msg === 'string') {
          // Expect control messages as JSON
          try {
            const cmd = JSON.parse(msg)
            if (cmd.type === 'resize' && cmd.cols && cmd.rows) {
              stream.setWindow(cmd.rows, cmd.cols, cmd.height || 600, cmd.width || 800)
              return
            }
          } catch {
            // treat as plain input
            stream.write(msg)
          }
  } else if (msg instanceof Buffer || Array.isArray(msg)) {
          stream.write(msg)
        }
      })

      connection.socket.on('close', () => {
        // do not end SSH session immediately; keep it alive to allow reattach or multiple tabs? for now, end stream
        try { stream.end() } catch {}
      })
    } catch (err) {
      server.log.warn({ err }, 'Failed to open shell')
      try { connection.socket.close(1011, 'shell_error') } catch {}
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
