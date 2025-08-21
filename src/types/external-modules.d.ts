declare module "yjs" {
  export interface YDocument {
    // Add proper Y.js document interface
    [key: string]: unknown;
  }
  
  const Y: {
    Doc: new () => YDocument;
    [key: string]: unknown;
  };
  export = Y;
}

declare module "y-protocols/awareness" {
  export interface AwarenessState {
    [key: string]: unknown;
  }
  
  export class Awareness {
    constructor(doc: YDocument);
    on(event: string, callback: (...args: unknown[]) => void): void;
    off(event: string, callback: (...args: unknown[]) => void): void;
    getLocalState(): AwarenessState;
    setLocalState(state: AwarenessState): void;
  }
  
  export function applyAwarenessUpdate(awareness: Awareness, update: Uint8Array, origin?: unknown): void;
  export function encodeAwarenessUpdate(awareness: Awareness, clients: number[]): Uint8Array;
}

// react-mosaic-component removed; legacy types no longer needed

declare module "qrcode" {
  export interface QRCodeOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    type?: 'image/png' | 'image/jpeg' | 'image/webp';
    quality?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
    width?: number;
    scale?: number;
  }
  
  const QRCode: {
    toDataURL: (text: string, options?: QRCodeOptions) => Promise<string>;
    toString: (text: string, options?: QRCodeOptions) => string;
    toCanvas: (text: string, options?: QRCodeOptions) => HTMLCanvasElement;
    [key: string]: unknown;
  };
  
  export default QRCode;
  export const toDataURL: (text: string, options?: QRCodeOptions) => Promise<string>;
}


