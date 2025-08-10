declare module "yjs" {
  const Y: any;
  export = Y;
}

declare module "y-protocols/awareness" {
  export class Awareness {
    constructor(doc: any);
    on: (...args: any[]) => void;
    off: (...args: any[]) => void;
    getLocalState: () => any;
    setLocalState: (s: any) => void;
  }
  export function applyAwarenessUpdate(awareness: any, update: Uint8Array, origin?: any): void;
  export function encodeAwarenessUpdate(awareness: any, clients: number[]): Uint8Array;
}

// react-mosaic-component removed; legacy types no longer needed


