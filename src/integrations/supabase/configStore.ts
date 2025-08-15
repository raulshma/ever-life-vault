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

interface BatchConfigOperation {
  namespace: string
  key: string
  value?: any // undefined means delete
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

// New batch operations for better performance

/**
 * Get multiple config values in a single database call
 */
export async function getConfigValues(operations: Array<{ namespace: string; key: string }>): Promise<Array<{ namespace: string; key: string; value: any }>> {
  const userId = await getCurrentUserId()
  if (!userId || operations.length === 0) return []
  
  const client: any = supabase
  
  // Group operations by namespace for optimal querying
  const namespaceGroups = operations.reduce((acc, op) => {
    if (!acc[op.namespace]) acc[op.namespace] = []
    acc[op.namespace].push(op.key)
    return acc
  }, {} as Record<string, string[]>)
  
  const results: Array<{ namespace: string; key: string; value: any }> = []
  
  // Query each namespace separately since we need to match specific keys
  for (const [namespace, keys] of Object.entries(namespaceGroups)) {
    const { data, error } = await client
      .from('user_configs')
      .select('key, value')
      .eq('user_id', userId)
      .eq('namespace', namespace)
      .in('key', keys)
    
    if (!error && data) {
      results.push(...data.map(row => ({ namespace, key: row.key, value: row.value })))
    }
  }
  
  return results
}

/**
 * Set multiple config values in a single database call
 */
export async function setConfigValues(operations: Array<{ namespace: string; key: string; value: any }>): Promise<boolean> {
  const userId = await getCurrentUserId()
  if (!userId || operations.length === 0) return false
  
  const client: any = supabase
  
  // Prepare rows for batch upsert
  const rows: UserConfigRow[] = operations.map(op => ({
    user_id: userId,
    namespace: String(op.namespace).slice(0, 64),
    key: String(op.key).slice(0, 128),
    value: op.value
  }))
  
  const { error } = await client
    .from('user_configs')
    .upsert(rows, { onConflict: 'user_id,namespace,key' })
  
  return !error
}

/**
 * Batch get and set operations for maximum efficiency
 * This is the most optimized function for multiple operations
 */
export async function batchConfigOperations(
  gets: Array<{ namespace: string; key: string }> = [],
  sets: Array<{ namespace: string; key: string; value: any }> = []
): Promise<{
  gets: Array<{ namespace: string; key: string; value: any }>
  sets: boolean
}> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return { gets: [], sets: false }
  }
  
  const client: any = supabase
  const results = { gets: [] as Array<{ namespace: string; key: string; value: any }>, sets: false }
  
  // Execute gets and sets in parallel if both exist
  if (gets.length > 0 && sets.length > 0) {
    const [getResults, setResults] = await Promise.all([
      getConfigValues(gets),
      setConfigValues(sets)
    ])
    results.gets = getResults
    results.sets = setResults
  } else if (gets.length > 0) {
    results.gets = await getConfigValues(gets)
  } else if (sets.length > 0) {
    results.sets = await setConfigValues(sets)
  }
  
  return results
}


