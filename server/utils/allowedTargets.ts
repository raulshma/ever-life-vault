export function makeIsTargetAllowed(allowedTargetHosts: string[]) {
  const normalized = allowedTargetHosts.map((s) => s.trim().toLowerCase()).filter(Boolean)
  return function isTargetAllowed(targetUrl: string): boolean {
    try {
      const u = new URL(targetUrl)
      if (!['http:', 'https:'].includes(u.protocol)) return false
      if (normalized.length === 0) return true
      return normalized.includes(u.hostname.toLowerCase())
    } catch {
      return false
    }
  }
}


