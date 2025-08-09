import { Readable } from 'node:stream'

export function buildForwardHeaders(incomingHeaders: Record<string, any>, omitAuthorization: boolean = false) {
  const forwardHeaders: Record<string, any> = {}
  for (const [key, value] of Object.entries(incomingHeaders)) {
    const k = key.toLowerCase()
    if (['host', 'content-length', 'connection', 'origin', 'referer'].includes(k)) continue
    if (omitAuthorization && k === 'authorization') continue
    forwardHeaders[k] = value
  }
  return forwardHeaders
}

export async function sendUpstreamResponse(reply: any, res: Response) {
  for (const [hk, hv] of (res.headers as any)) {
    if (['content-type', 'set-cookie', 'cache-control', 'etag', 'last-modified'].includes(hk.toLowerCase())) {
      reply.header(hk, hv)
    }
  }
  reply.code(res.status)
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const text = await res.text()
    return reply.send(text)
  }
  if ((res as any).body) {
    return reply.send(Readable.fromWeb((res as any).body))
  }
  return reply.send()
}

export function prepareBody(method: string, incomingHeaders: Record<string, any>, requestBody: any, forwardHeaders: Record<string, any>) {
  let body: any
  if (!['GET', 'HEAD'].includes(method)) {
    const ct = (incomingHeaders['content-type'] || (incomingHeaders as any)['Content-Type'] || '').toString()
    if (typeof requestBody === 'string' || Buffer.isBuffer(requestBody)) {
      body = requestBody
    } else if (requestBody && typeof requestBody === 'object') {
      if (!ct) {
        forwardHeaders['content-type'] = 'application/json'
      }
      body = JSON.stringify(requestBody)
    }
  }
  return body
}


