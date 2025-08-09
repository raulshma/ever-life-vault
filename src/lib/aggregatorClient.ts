import { supabase } from '@/integrations/supabase/client'

export async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

export async function fetchWithAuth(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken()
  const headers = new Headers(init?.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(input, { ...init, headers })
}

export async function agpFetch(targetUrl: string, options?: { method?: string; headers?: Record<string, string>; body?: any }): Promise<Response> {
  const token = await getAccessToken()
  const headers = new Headers(options?.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const url = `/agp?url=${encodeURIComponent(targetUrl)}`
  const method = options?.method || 'GET'
  const body = options?.body
  return fetch(url, { method, headers, body: body && typeof body === 'object' ? JSON.stringify(body) : body })
}

export async function dynFetch(targetUrl: string, init?: RequestInit): Promise<Response> {
  const url = `/dyn?url=${encodeURIComponent(targetUrl)}`
  return fetch(url, init)
}


