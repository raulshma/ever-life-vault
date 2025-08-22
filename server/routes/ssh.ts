/// <reference path="../types/ssh2-shim.d.ts" />
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
// @ts-ignore - types are provided via local shims
// WebSocket plugin is registered globally in server/index.ts
// import fastifyWebsocket from '@fastify/websocket'
// @ts-ignore - ambient types provided in server/types/external.d.ts
import { Client as SSHClient } from 'ssh2'
import { z } from 'zod'

interface DeleteSessionRoute {
  Params: {
    sessionId: string;
  };
}

type RequireUser = (request: any, reply: any) => Promise<any | null>

type Session = {
  id: string
  ssh: SSHClient
  stream?: any
  createdAt: number
  userId: string
  host: string
  port: number
  username: string
  cleaningUp?: boolean
}

const sessions = new Map<string, Session>()
const SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes

export function registerSshRoutes(server: FastifyInstance, cfg: { requireSupabaseUser: RequireUser }) {
  const { requireSupabaseUser } = cfg

  // Debug endpoint to test WebSocket connectivity
  server.get('/ssh/debug', async (req, reply) => {
    server.log.info('SSH debug endpoint called')
    return reply.send({
      status: 'ok',
      message: 'SSH service is running',
      timestamp: new Date().toISOString(),
      websocketSupport: !!(server as any).websocketServer,
      activeSessions: sessions.size
    })
  })

  // Test WebSocket endpoint without authentication
  server.get('/ssh/test-ws', { websocket: true } as any, async (socket: any) => {
    server.log.info('Test WebSocket connection received')
    socket.send(JSON.stringify({ type: 'connected', message: 'WebSocket test successful' }))

    socket.on('message', (msg: any) => {
      server.log.info('Test WebSocket message received: ' + msg)
      socket.send(JSON.stringify({ type: 'echo', data: msg }))
    })

    socket.on('close', (code: number, reason: Buffer | string) => {
      server.log.info('Test WebSocket closed: ' + code + ' - ' + reason)
    })

    socket.on('error', (err: any) => {
      server.log.error('Test WebSocket error: ' + err)
    })
  })

  // WebSocket plugin is now registered globally in server/index.ts

  // Create SSH session via HTTP POST; returns sessionId
  server.post('/ssh/sessions', async (req, reply) => {
    try {
      server.log.debug('SSH session creation request received')

      const user = await requireSupabaseUser(req, reply)
      if (!user) {
        server.log.warn('SSH session creation failed: no authenticated user')
        return
      }

      const body = z.object({
        host: z.string().min(1, 'Host is required'),
        port: z.number().int().positive().default(22),
        username: z.string().min(1, 'Username is required'),
        password: z.string().optional(),
        privateKey: z.string().optional(),
        passphrase: z.string().optional(),
        readyTimeout: z.number().int().positive().optional(),
      }).parse((req as any).body || {})

      server.log.debug({ host: body.host, port: body.port, username: body.username }, 'SSH connection parameters')

      if (!body.password && !body.privateKey) {
        server.log.warn('SSH session creation failed: no auth method provided')
        return reply.status(400).send({ error: 'auth_required', message: 'Provide password or privateKey' })
      }

      const ssh = new SSHClient()
      const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      const session: Session = {
        id: sessionId,
        ssh,
        createdAt: Date.now(),
        userId: user.id,
        host: body.host,
        port: body.port,
        username: body.username
      }

      const connectOpts: any = {
        host: body.host,
        port: body.port,
        username: body.username,
        readyTimeout: body.readyTimeout ?? 15000,
      }

      if (body.privateKey) {
        connectOpts.privateKey = body.privateKey
        server.log.debug('Using private key authentication')
      }
      if (body.passphrase) connectOpts.passphrase = body.passphrase
      if (body.password) {
        connectOpts.password = body.password
        server.log.debug('Using password authentication')
      }

      await new Promise<void>((resolve, reject) => {
        ssh
          .on('ready', () => {
            server.log.info({ sessionId, host: body.host, username: body.username }, 'SSH connection established')
            sessions.set(sessionId, session)
            resolve()
          })
          .on('error', (err: any) => {
            server.log.error({ err, sessionId, host: body.host }, 'SSH connection failed')
            reject(err)
          })
          .connect(connectOpts)
      })

      if (!sessions.has(sessionId)) {
        server.log.error({ sessionId }, 'SSH session was not stored after connection')
        return reply.status(502).send({ error: 'ssh_connect_failed', message: 'Failed to establish SSH connection' })
      }

      server.log.info({ sessionId, userId: user.id }, 'SSH session created successfully')
      return reply.send({ sessionId, status: 'connected' })

    } catch (error) {
      server.log.error({ error }, 'SSH session creation error')
      return reply.status(500).send({ error: 'internal_error', message: 'Failed to create SSH session' })
    }
  })

  // Upgrade WS for interactive terminal binding to an existing session
  server.get('/ssh/sessions/:sessionId/attach', { websocket: true } as any, async (socket: any, req: any) => {
    const sessionId = (req.params || {}).sessionId
    server.log.info({ sessionId, url: req.url, headers: req.headers }, 'SSH WebSocket attach request received')

    // Log all request details for debugging
    server.log.debug({
      sessionId,
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: req.query,
      queryType: typeof req.query,
      queryKeys: req.query ? Object.keys(req.query) : 'NO_QUERY',
      params: req.params,
      raw: req.raw ? {
        url: req.raw.url,
        query: req.raw.query
      } : 'NO_RAW'
    }, 'WebSocket attach request details')

    try {
      // Browser WS cannot set Authorization header; accept token in query param
      const token = (req.query?.token as string | undefined) || ''
      server.log.debug({ sessionId, tokenLength: token?.length ?? 0 }, 'WebSocket attach token received')

      if (!token) {
        server.log.warn({ sessionId }, 'No token provided for WebSocket attach')
        try { socket.close(4401, 'no_token') } catch (e) { server.log.debug({ e }, 'socket.close threw') }
        return
      }

      // Token from query param is URL-encoded, need to decode it for Supabase auth
      let decodedToken: string
      try {
        decodedToken = decodeURIComponent(token)
        server.log.debug({ sessionId, decodedLength: decodedToken.length }, 'Token decoded successfully')
      } catch (decodeError) {
        server.log.error({ sessionId, decodeError }, 'Failed to decode token')
        try { socket.close(4401, 'invalid_token') } catch (e) { server.log.debug({ e }, 'socket.close threw') }
        return
      }

      const fakeReq = { headers: { Authorization: `Bearer ${decodedToken}` } }
      let user: any = null
      try {
        user = await cfg.requireSupabaseUser(fakeReq, { code: () => ({ send: () => {} }) })
        if (!user) {
          server.log.warn({ sessionId }, 'Supabase authentication failed')
          try { socket.close(4401, 'unauthorized') } catch (e) { server.log.debug({ e }, 'socket.close threw') }
          return
        }
        server.log.debug({ sessionId, userId: user.id }, 'User authenticated successfully')
      } catch (authError) {
        server.log.error({ sessionId, authError }, 'Error during Supabase authentication')
        try { socket.close(4401, 'auth_error') } catch (e) { server.log.debug({ e }, 'socket.close threw') }
        return
      }

      // Check if session exists
      const session = sessions.get(sessionId)
      if (!session) {
        server.log.warn({ sessionId }, 'No SSH session found for attach')
        try { socket.close(4404, 'no_session') } catch (e) { server.log.debug({ e }, 'socket.close threw') }
        return
      }

      // Check session ownership
      if (session.userId !== user.id) {
        server.log.warn({ sessionId, sessionUserId: session.userId, requestUserId: user.id }, 'User mismatch for session access')
        try { socket.close(4403, 'forbidden') } catch (e) { server.log.debug({ e }, 'socket.close threw') }
        return
      }

      // Check session age
      const sessionAge = Date.now() - session.createdAt
      if (sessionAge > SESSION_TIMEOUT) {
        server.log.warn({ sessionId, sessionAge, timeout: SESSION_TIMEOUT }, 'Session expired')
        try { socket.close(4404, 'session_expired') } catch (e) { server.log.debug({ e }, 'socket.close threw') }
        return
      }

      server.log.info({ sessionId, host: session.host, username: session.username }, 'WebSocket attach authorized')

      // Open a shell if not already
      const openShell = async (): Promise<any> => {
        if (session.stream) {
          server.log.debug({ sessionId }, 'Reusing existing shell stream')
          return session.stream
        }

        server.log.debug({ sessionId }, 'Opening new SSH shell')
        return new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Shell opening timeout'))
          }, 10000)

          session.ssh.shell({ term: 'xterm-256color' }, (err: Error | undefined, stream: any) => {
            clearTimeout(timeout)
            if (err) {
              server.log.error({ err, sessionId }, 'Failed to open SSH shell')
              return reject(err)
            }
            server.log.info({ sessionId }, 'SSH shell opened successfully')
            session.stream = stream
            resolve(stream)
          })
        })
      }

      try {
        const stream = await openShell()
        server.log.info({ sessionId }, 'Shell ready for WebSocket communication')

        // Set up data flow: SSH -> WebSocket
        const sshDataHandler = (data: Buffer) => {
          try {
            if (socket.readyState === 1) { // OPEN
              socket.send(data)
            }
          } catch (err) {
            server.log.warn({ err, sessionId }, 'Failed to send SSH data over WebSocket')
          }
        }

        const sshCloseHandler = () => {
          server.log.info({ sessionId }, 'SSH shell stream closed')
          try {
            if (socket.readyState === 1) {
              socket.close(1000, 'shell_closed')
            }
          } catch (e) {
            server.log.debug({ e }, 'socket.close threw')
          }
          // Clean up session
          const session = sessions.get(sessionId)
          if (session) {
            session.cleaningUp = true
          }
          sessions.delete(sessionId)
        }

        const sshConnectionCloseHandler = () => {
          server.log.info({ sessionId }, 'SSH connection closed')
          try {
            if (socket.readyState === 1) {
              socket.close(1000, 'ssh_closed')
            }
          } catch (e) {
            server.log.debug({ e }, 'socket.close threw')
          }
          const session = sessions.get(sessionId)
          if (session) {
            session.cleaningUp = true
          }
          sessions.delete(sessionId)
        }

        stream.on('data', sshDataHandler)
        stream.on('close', sshCloseHandler)
        session.ssh.on('close', sshConnectionCloseHandler)

        // Set up data flow: WebSocket -> SSH
        socket.on('message', (msg: any) => {
          try {
            if (typeof msg === 'string') {
              // Try to parse as JSON control message first
              try {
                const cmd = JSON.parse(msg)
                if (cmd.type === 'resize' && cmd.cols && cmd.rows) {
                  stream.setWindow(cmd.rows, cmd.cols, cmd.height || 600, cmd.width || 800)
                  server.log.debug({ sessionId, cols: cmd.cols, rows: cmd.rows }, 'Terminal resize handled')
                  return
                }
              } catch {
                // Not JSON, treat as plain terminal input
              }
              // Send as terminal input
              stream.write(msg)
            } else if (msg instanceof Buffer || Array.isArray(msg)) {
              stream.write(msg)
            }
          } catch (err) {
            server.log.warn({ err, sessionId }, 'Error processing WebSocket message')
          }
        })

        socket.on('error', (err: any) => {
          server.log.error({ err, sessionId }, 'WebSocket error')
        })

        socket.on('close', (code: number, reason: Buffer | string) => {
          const reasonStr = reason?.toString?.() || 'unknown'
          server.log.info({ sessionId, code, reason: reasonStr }, 'WebSocket closed')

          // Clean up event listeners
          try { stream.removeListener('data', sshDataHandler) } catch (e) {}
          try { stream.removeListener('close', sshCloseHandler) } catch (e) {}
          try { session.ssh.removeListener('close', sshConnectionCloseHandler) } catch (e) {}

          // Close SSH stream if WebSocket is closed
          try {
            stream.end()
          } catch (e) {
            server.log.debug({ e }, 'stream.end threw')
          }
        })

        server.log.info({ sessionId }, 'WebSocket attached to SSH session successfully')

      } catch (shellError) {
        server.log.error({ shellError, sessionId }, 'Failed to open SSH shell')
        try {
          socket.close(1011, 'shell_error')
        } catch (e) {
          server.log.debug({ e }, 'socket.close threw')
        }
      }

    } catch (error) {
      server.log.error({ error, sessionId }, 'WebSocket attach error')
      try {
        socket.close(1011, 'internal_error')
      } catch (e) {
        server.log.debug({ e }, 'socket.close threw')
      }
    }
  })

  // Close and cleanup session
  server.delete<DeleteSessionRoute>('/ssh/sessions/:sessionId', async (req: FastifyRequest<DeleteSessionRoute>, reply: FastifyReply) => {
    try {
      server.log.debug({
        params: req.params,
        url: req.url
      }, 'DELETE session request received')

      const user = await requireSupabaseUser(req, reply)
      if (!user) return

      // Add validation with better error handling
      const params = req.params
      server.log.debug({ params, paramsType: typeof params }, 'Parsed params')

      if (!params || !params.sessionId) {
        server.log.error({ params }, 'Missing sessionId parameter')
        return reply.status(400).send({ error: 'bad_request', message: 'Missing sessionId parameter' })
      }

      const sessionId = params.sessionId
      server.log.debug({ sessionId, sessionIdType: typeof sessionId, sessionIdLength: sessionId.length }, 'Extracted sessionId')

      if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
        server.log.error({ sessionId, sessionIdType: typeof sessionId }, 'Invalid sessionId parameter')
        return reply.status(400).send({ error: 'bad_request', message: 'Invalid sessionId parameter' })
      }

      server.log.info({ sessionId, userId: user.id }, 'Session deletion requested')

      const session = sessions.get(sessionId)
      if (!session) {
        server.log.warn({ sessionId, availableSessions: Array.from(sessions.keys()) }, 'Session not found for deletion')
        return reply.status(404).send({ error: 'not_found', message: 'Session not found' })
      }

      // Check if session is already being cleaned up
      if (session.cleaningUp) {
        server.log.warn({ sessionId }, 'Session is already being cleaned up')
        return reply.status(409).send({ error: 'conflict', message: 'Session is already being cleaned up' })
      }

      if (session.userId !== user.id) {
        server.log.warn({ sessionId, sessionUserId: session.userId, requestUserId: user.id }, 'Unauthorized session deletion')
        return reply.status(403).send({ error: 'forbidden', message: 'Not authorized to delete this session' })
      }

      // Mark session as being cleaned up
      session.cleaningUp = true

      // Clean up session resources
      try {
        if (session.stream) {
          session.stream.end()
          server.log.debug({ sessionId }, 'SSH stream ended')
        }
      } catch (streamError) {
        server.log.warn({ streamError, sessionId }, 'Error ending SSH stream')
      }

      try {
        session.ssh.end()
        server.log.debug({ sessionId }, 'SSH connection ended')
      } catch (sshError) {
        server.log.warn({ sshError, sessionId }, 'Error ending SSH connection')
      }

      // Remove from sessions map
      sessions.delete(sessionId)
      server.log.info({ sessionId }, 'SSH session deleted successfully')

      return reply.send({ ok: true, message: 'Session deleted' })

    } catch (error) {
      server.log.error({ error }, 'Session deletion error')
      return reply.status(500).send({ error: 'internal_error', message: 'Failed to delete session' })
    }
  })

  // Session cleanup utility
  const cleanupExpiredSessions = () => {
    const now = Date.now()
    let cleaned = 0

    for (const [sessionId, session] of sessions.entries()) {
      const age = now - session.createdAt
      if (age > SESSION_TIMEOUT) {
        session.cleaningUp = true
        try {
          session.stream?.end()
          session.ssh.end()
        } catch (e) {
          server.log.debug({ sessionId, error: e }, 'Error during session cleanup')
        }
        sessions.delete(sessionId)
        cleaned++
      }
    }

    if (cleaned > 0) {
      server.log.info({ cleaned, total: sessions.size }, 'Expired SSH sessions cleaned up')
    }
  }

  // Run cleanup every 5 minutes
  setInterval(cleanupExpiredSessions, 5 * 60 * 1000)

  // Add session monitoring endpoint
  server.get('/ssh/sessions', async (req, reply) => {
    try {
      const user = await requireSupabaseUser(req, reply)
      if (!user) return

      const userSessions = Array.from(sessions.entries())
        .filter(([_, session]) => session.userId === user.id)
        .map(([sessionId, session]) => ({
          sessionId,
          host: session.host,
          port: session.port,
          username: session.username,
          createdAt: session.createdAt,
          age: Date.now() - session.createdAt,
          hasStream: !!session.stream
        }))

      return reply.send({
        sessions: userSessions,
        total: userSessions.length,
        maxSessions: 10
      })
    } catch (error) {
      server.log.error({ error }, 'Error listing SSH sessions')
      return reply.status(500).send({ error: 'internal_error', message: 'Failed to list sessions' })
    }
  })
}
