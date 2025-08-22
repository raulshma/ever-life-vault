declare module 'ssh2' {
  import { EventEmitter } from 'events'
  export class Client extends EventEmitter {
    connect(config: any): this
    on(event: 'ready', listener: () => void): this
    on(event: 'error', listener: (err: any) => void): this
    on(event: 'close', listener: () => void): this
    shell(opts: any, cb: (err: any, stream: any) => void): void
    end(): void
  }
}
