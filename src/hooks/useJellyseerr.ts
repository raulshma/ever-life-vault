import { useState, useCallback } from 'react';

export interface JellyseerrConfig {
  serverUrl: string;
  apiKey: string;
}

export interface MediaRequest {
  id: number;
  type: 'movie' | 'tv';
  status: 'pending' | 'approved' | 'declined' | 'available';
  media: {
    tmdbId: number;
    title: string;
    overview: string;
    posterPath?: string;
    releaseDate?: string;
    voteAverage?: number;
  };
  requestedBy: {
    displayName: string;
    email: string;
  };
  createdAt: string;
  modifiedBy?: {
    displayName: string;
  };
  seasons?: Array<{
    id: number;
    seasonNumber: number;
    status: string;
  }>;
}

export interface JellyseerrStatus {
  version: string;
  commitTag: string;
  updateAvailable: boolean;
  commitsBehind: number;
}

export interface SearchResult {
  id: number;
  mediaType: 'movie' | 'tv';
  title: string;
  name?: string;
  overview: string;
  posterPath?: string;
  releaseDate?: string;
  firstAirDate?: string;
  voteAverage: number;
  mediaInfo?: {
    status: 'unknown' | 'pending' | 'processing' | 'available' | 'partially_available';
    requests?: MediaRequest[];
  };
}

export const useJellyseerr = () => {
  const [config, setConfig] = useState<JellyseerrConfig>({
    serverUrl: localStorage.getItem('jellyseerr_url') || '',
    apiKey: localStorage.getItem('jellyseerr_api_key') || '',
  });
  
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateConfig = useCallback((newConfig: Partial<JellyseerrConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...newConfig };
      if (newConfig.serverUrl) {
        localStorage.setItem('jellyseerr_url', newConfig.serverUrl);
      }
      if (newConfig.apiKey) {
        localStorage.setItem('jellyseerr_api_key', newConfig.apiKey);
      }
      return updated;
    });
  }, []);

  const makeRequest = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    if (!config.serverUrl || !config.apiKey) {
      throw new Error('Jellyseerr server URL and API key are required');
    }

    const url = `${config.serverUrl}/api/v1${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': config.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }, [config]);

  const testConnection = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    
    try {
      const status: JellyseerrStatus = await makeRequest('/status');
      setIsConnected(true);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setIsConnected(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, [makeRequest]);

  const getRequests = useCallback(async (take = 20, skip = 0): Promise<{ results: MediaRequest[]; pageInfo: { pages: number; pageSize: number; results: number; page: number } }> => {
    return makeRequest(`/request?take=${take}&skip=${skip}&sort=added&filter=all`);
  }, [makeRequest]);

  const searchMedia = useCallback(async (query: string, page = 1): Promise<{ results: SearchResult[]; totalResults: number; totalPages: number }> => {
    return makeRequest(`/search?query=${encodeURIComponent(query)}&page=${page}`);
  }, [makeRequest]);

  const createRequest = useCallback(async (mediaId: number, mediaType: 'movie' | 'tv', seasons?: number[]): Promise<MediaRequest> => {
    const body: any = {
      mediaId,
      mediaType,
    };

    if (mediaType === 'tv' && seasons) {
      body.seasons = seasons;
    }

    return makeRequest('/request', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }, [makeRequest]);

  const updateRequestStatus = useCallback(async (requestId: number, status: 'approve' | 'decline'): Promise<MediaRequest> => {
    return makeRequest(`/request/${requestId}/${status}`, {
      method: 'POST',
    });
  }, [makeRequest]);

  const deleteRequest = useCallback(async (requestId: number): Promise<void> => {
    await makeRequest(`/request/${requestId}`, {
      method: 'DELETE',
    });
  }, [makeRequest]);

  const getStatus = useCallback(async (): Promise<JellyseerrStatus> => {
    return makeRequest('/status');
  }, [makeRequest]);

  const getSettings = useCallback(async () => {
    return makeRequest('/settings/public');
  }, [makeRequest]);

  return {
    config,
    updateConfig,
    isConnected,
    loading,
    error,
    testConnection,
    getRequests,
    searchMedia,
    createRequest,
    updateRequestStatus,
    deleteRequest,
    getStatus,
    getSettings,
  };
};