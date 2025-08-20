declare module '@fastify/websocket' {
  import type { FastifyPluginCallback } from 'fastify'
  import type { Socket } from 'ws'
  export interface SocketStream {
    socket: Socket & { send: (data: any) => void; close: (code?: number, reason?: string) => void }
    destroy(error?: Error): void
  }
  const plugin: FastifyPluginCallback
  export default plugin
}

declare module 'ssh2' {
  export class Client {
    on(event: 'ready', listener: () => void): this
    on(event: 'error', listener: (err: any) => void): this
    on(event: 'close', listener: () => void): this
    connect(config: any): void
    shell(options: any, cb: (err?: Error, stream?: any) => void): void
    end(): void
  }
}
