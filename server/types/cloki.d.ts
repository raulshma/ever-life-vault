declare module '@miketako3/cloki' {
  export class Cloki {
    constructor(options: {
      lokiHost: string
      lokiUser: string
      lokiToken: string
      defaultLabels?: Record<string, string>
    })
    info(payload: any, labels?: Record<string, string>): Promise<void>
    error(payload: any, labels?: Record<string, string>): Promise<void>
    warn?(payload: any, labels?: Record<string, string>): Promise<void>
    debug?(payload: any, labels?: Record<string, string>): Promise<void>
  }
}


