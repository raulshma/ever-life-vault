import { useCallback, useMemo, useState } from 'react';
import { useVaultSession } from '@/hooks/useVaultSession';

export type KarakeepItemType = 'link' | 'text' | 'asset';

export interface KarakeepTag {
  id: string | number;
  name: string;
  attachedBy?: string;
}

export interface KarakeepItem {
  id: string;
  type: KarakeepItemType;
  title?: string;
  url?: string;
  text?: string;
  tags?: Array<string | KarakeepTag>;
  created_at?: string;
  updated_at?: string;
  // Allow unknown fields
  [key: string]: unknown;
}

export interface KarakeepConfig {
  // IMPORTANT: Expect this to be the API base, e.g. https://your-host/api/v1
  serverUrl: string;
  apiKey: string;
}

export interface CreateKarakeepItemRequest {
  type: KarakeepItemType;
  title?: string;
  url?: string; // for type = 'link'
  text?: string; // for type = 'text'
  tags?: string[];
}

export interface KarakeepSearchResponse {
  items: KarakeepItem[];
  total?: number;
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export function useKarakeep(config: KarakeepConfig) {
  const { isUnlocked } = useVaultSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const headers = useMemo(() => {
    const hdrs: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      // Send both common auth header styles to maximize compatibility
      hdrs['Authorization'] = `Bearer ${config.apiKey}`;
      hdrs['X-Api-Key'] = config.apiKey;
    }
    return hdrs;
  }, [config.apiKey]);

  const ensureConfigured = useCallback(() => {
    if (!isUnlocked) {
      throw new Error('Vault locked - unlock to use Karakeep');
    }
    if (!config.serverUrl || !config.apiKey) {
      throw new Error('Karakeep server URL and API key are required');
    }
  }, [config.serverUrl, config.apiKey, isUnlocked]);

  const makeRequest = useCallback(
    async (path: string, init: RequestInit = {}) => {
      ensureConfigured();
      setLoading(true);
      setError(null);
      try {
        const inputBase = config.serverUrl.endsWith('/') ? config.serverUrl.slice(0, -1) : config.serverUrl;
        const isAbsolute = /^https?:\/\//i.test(inputBase);
        // If user provided an absolute base without explicit api version, default to /api/v1
        const effectiveBase = isAbsolute && !/\/api\/v\d+$/i.test(inputBase)
          ? `${inputBase}/api/v1`
          : inputBase;
        const target = joinUrl(effectiveBase, path);
        const url = isAbsolute ? `/proxy/dyn?url=${encodeURIComponent(target)}` : target;
        const response = await fetch(url, {
          ...init,
          headers: { ...headers, ...(init.headers || {}) },
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`HTTP ${response.status}: ${text || response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          return response.json();
        }
        return response.text();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        setError(message);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [config.serverUrl, headers, ensureConfigured]
  );

  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      // Try listing bookmarks with a small page to validate connectivity
      const result = await makeRequest('/bookmarks?limit=1', { method: 'GET' });
      if (result) {
        setIsConnected(true);
        return true;
      }
      setIsConnected(false);
      return false;
    } catch (_) {
      setIsConnected(false);
      return false;
    }
  }, [makeRequest]);

  const listItems = useCallback(
    async (params?: {
      q?: string;
      type?: KarakeepItemType;
      tags?: string[];
      sort?: 'newest' | 'oldest' | 'title';
      limit?: number;
      offset?: number;
    }): Promise<KarakeepSearchResponse> => {
      const search = new URLSearchParams();
      if (params?.q) search.set('q', params.q);
      if (params?.type) search.set('type', params.type);
      if (params?.tags && params.tags.length > 0) {
        // Common server styles: tags CSV or repeated 'tag'
        search.set('tags', params.tags.join(','));
        // Also add first tag for APIs that expect a singular parameter
        if (!search.has('tag')) search.set('tag', params.tags[0]);
      }
      if (params?.sort) {
        // Try common patterns for wider compatibility
        const field = params.sort === 'title' ? 'title' : 'created_at';
        const direction = params.sort === 'oldest' ? 'asc' : params.sort === 'title' ? 'asc' : 'desc';
        // Minimal set
        search.set('sort', field);
        search.set('order', direction);
        // Some APIs prefer `sort_by` and `direction`
        search.set('sort_by', field);
        search.set('direction', direction);
        // Others accept single combined sort
        search.set('sortCombined', `${field}:${direction}`);
      }
      if (params?.limit) search.set('limit', String(params.limit));
      if (params?.offset) search.set('offset', String(params.offset));
      const query = search.toString();
      const path = query ? `/bookmarks?${query}` : '/bookmarks';
      const data = await makeRequest(path, { method: 'GET' });
      // Normalize response to { items, total }
      if (Array.isArray(data)) {
        return { items: data as KarakeepItem[], total: data.length };
      }
      if (data && typeof data === 'object') {
        const maybeItems = (data.items || data.results || data.bookmarks) as KarakeepItem[];
        const total = (data.total || data.count || maybeItems?.length) as number | undefined;
        return { items: maybeItems || [], total };
      }
      return { items: [], total: 0 };
    },
    [makeRequest]
  );

  const searchItems = useCallback(
    async (query: string, options?: { type?: KarakeepItemType; tags?: string[]; sort?: 'newest' | 'oldest' | 'title' }): Promise<KarakeepItem[]> => {
      const { items } = await listItems({ q: query, type: options?.type, tags: options?.tags, sort: options?.sort, limit: 50, offset: 0 });
      return items;
    },
    [listItems]
  );

  const addItem = useCallback(
    async (payload: CreateKarakeepItemRequest): Promise<KarakeepItem> => {
      if (!payload.type) throw new Error('Item type is required');
      const body = JSON.stringify(payload);
      const created = await makeRequest('/bookmarks', { method: 'POST', body });
      return created as KarakeepItem;
    },
    [makeRequest]
  );

  return {
    loading,
    error,
    isConnected,
    testConnection,
    listItems,
    searchItems,
    addItem,
  };
}

export default useKarakeep;


