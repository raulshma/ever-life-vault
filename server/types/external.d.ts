// Type declarations for external modules

declare module 'simple-git' {
  export interface SimpleGit {
    clone(repo: string, path?: string, options?: string[]): Promise<void>
    cwd(path: string): SimpleGit
    listRemote(args?: string[]): Promise<string>
    raw(args: string[]): Promise<string>
    status(): Promise<{ files: Array<{ path: string; working_dir: string; index: string }> }>
    revparse(args: string[]): Promise<string>
  }
  
  export function simpleGit(baseDir?: string): SimpleGit
}

declare module 'marked' {
  export interface MarkedOptions {
    gfm?: boolean
    breaks?: boolean
    sanitize?: boolean
  }
  
  export function marked(text: string, options?: MarkedOptions): string
  export function marked(text: string, callback?: (error: any, parseResult: string) => void): string
}

declare module 'highlight.js' {
  export interface HighlightResult {
    value: string
    language?: string
    relevance: number
  }
  
  export interface HighlightOptions {
    language?: string
    ignoreIllegals?: boolean
  }
  
  export function highlight(code: string, options?: HighlightOptions): HighlightResult
  export function highlight(code: string, language: string, ignoreIllegals?: boolean): HighlightResult
  export function highlightAuto(code: string, languageSubset?: string[]): HighlightResult
  
  export const languages: Record<string, any>
  export const listLanguages: () => string[]
  
  export function getLanguage(name: string): any
  
  export default {
    highlight,
    highlightAuto,
    languages,
    listLanguages,
    getLanguage
  }
}

declare module 'yaml' {
  export function parse(text: string): any
  export function stringify(obj: any): string
  export function parseAll(text: string): any[]
}

declare module 'js-yaml' {
  export function load(text: string): any
  export function dump(obj: any): string
  export function safeLoad(text: string): any
  export function safeDump(obj: any): string
}

declare module 'xterm' {
  export class Terminal {
    constructor(options?: any)
    open(container: HTMLElement): void
    write(text: string): void
    writeln(text: string): void
    clear(): void
    focus(): void
    blur(): void
    dispose(): void
    on(event: string, callback: (...args: any[]) => void): void
    off(event: string, callback: (...args: any[]) => void): void
  }
}

declare module 'xterm-addon-fit' {
  export class FitAddon {
    activate(terminal: any): void
    fit(): void
    dispose(): void
  }
}

declare module 'vitest' {
  export const vi: {
    fn(): jest.Mock
    mock(path: string, factory?: () => any): void
  }
  export const afterAll: (fn: () => void | Promise<void>) => void
}

declare module '@fastify/rate-limit' {
  const plugin: any
  export default plugin
}
