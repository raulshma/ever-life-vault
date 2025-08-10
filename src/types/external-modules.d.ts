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


declare module 'react-mosaic-component' {
  import * as React from 'react'

  export type MosaicDirection = 'row' | 'column'
  export type MosaicKey = string
  export type MosaicNode<T extends MosaicKey> =
    | T
    | { direction: MosaicDirection; first: MosaicNode<T>; second: MosaicNode<T>; splitPercentage?: number }

  export interface MosaicProps<T extends MosaicKey> {
    value: MosaicNode<T> | null
    onChange: (node: MosaicNode<T> | null) => void
    renderTile: (id: T, path: any) => React.ReactNode
    className?: string
  }

  export class Mosaic<T extends MosaicKey> extends React.Component<MosaicProps<T>> {}

  export interface MosaicWindowProps<T extends MosaicKey> {
    path: any
    title: string
    renderToolbar?: () => React.ReactNode
    children?: React.ReactNode
  }

  export class MosaicWindow<T extends MosaicKey> extends React.Component<MosaicWindowProps<T>> {}
}


