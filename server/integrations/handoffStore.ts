interface HandoffRecord<T = any> {
  payload: T
  expiresAt: number
}

export class HandoffStore<T = any> {
  private readonly store = new Map<string, HandoffRecord<T>>()

  put(id: string, payload: T, ttlMs = 5 * 60_000): void {
    const expiresAt = Date.now() + ttlMs
    this.store.set(id, { payload, expiresAt })
    setTimeout(() => {
      const v = this.store.get(id)
      if (v && v.expiresAt <= Date.now()) this.store.delete(id)
    }, ttlMs + 1_000)
  }

  take(id: string): T | null {
    const v = this.store.get(id)
    if (!v || v.expiresAt <= Date.now()) return null
    this.store.delete(id)
    return v.payload
  }

  peek(id: string): T | null {
    const v = this.store.get(id)
    if (!v || v.expiresAt <= Date.now()) return null
    return v.payload
  }
}


