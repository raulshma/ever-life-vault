import { supabase } from '@/integrations/supabase/client'

export type ConfigPrimitive = string | number | boolean | null
export type ConfigValue = ConfigPrimitive | ConfigValue[] | { [key: string]: ConfigValue }

interface UserConfigRow {
  user_id: string
  namespace: string
  key: string
  value: any
  created_at?: string
  updated_at?: string
}

async function getCurrentUserId(): Promise<string | null> {
  try {
    // Prefer local session (no network) for user id
    const { data } = await supabase.auth.getSession()
    return data.session?.user?.id ?? null
  } catch {
    return null
  }
}

export async function getConfigValue<T = unknown>(namespace: string, key: string): Promise<T | null> {
  const userId = await getCurrentUserId()
  if (!userId) return null
  const client: any = supabase
  const { data, error } = await client
    .from('user_configs')
    .select('value')
    .eq('user_id', userId)
    .eq('namespace', namespace)
    .eq('key', key)
    .maybeSingle()
  if (error || !data) return null
  return (data.value as T) ?? null
}

export async function setConfigValue<T = unknown>(namespace: string, key: string, value: T): Promise<boolean> {
  const userId = await getCurrentUserId()
  if (!userId) return false
  const safeNamespace = String(namespace).slice(0, 64)
  const safeKey = String(key).slice(0, 128)
  const row: UserConfigRow = { user_id: userId, namespace: safeNamespace, key: safeKey, value }
  const client: any = supabase
  const { error } = await client
    .from('user_configs')
    .upsert(row, { onConflict: 'user_id,namespace,key' })
  return !error
}

export async function getNamespaceValues(namespace: string): Promise<Record<string, any>> {
  const userId = await getCurrentUserId()
  if (!userId) return {}
  const client: any = supabase
  const { data, error } = await client
    .from('user_configs')
    .select('key, value')
    .eq('user_id', userId)
    .eq('namespace', namespace)
  if (error || !data) return {}
  return Object.fromEntries((data as Array<{ key: string; value: any }>).map((r) => [r.key, r.value]))
}


