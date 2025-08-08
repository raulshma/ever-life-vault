import { useState, useCallback } from "react";
import { useVaultSession } from "./useVaultSession";

export interface JellyfinConfig {
  serverUrl: string;
  apiKey: string;
}

export interface JellyfinUser {
  Id: string;
  Name: string;
  LastActivityDate: string;
  LastLoginDate: string;
  IsActive: boolean;
  IsAdministrator: boolean;
}

export interface JellyfinSession {
  Id: string;
  UserId: string;
  UserName: string;
  Client: string;
  DeviceName: string;
  ApplicationVersion: string;
  IsActive: boolean;
  SupportsRemoteControl: boolean;
  NowPlayingItem?: {
    Id: string;
    Name: string;
    Type: string;
    RunTimeTicks: number;
    ProductionYear?: number;
    SeriesName?: string;
    SeasonName?: string;
    IndexNumber?: number;
    ParentIndexNumber?: number;
  };
  PlayState?: {
    PositionTicks: number;
    IsPaused: boolean;
    IsMuted: boolean;
    VolumeLevel: number;
    RepeatMode: string;
  };
}

export interface JellyfinStats {
  UserCount: number;
  ItemCount: number;
  MovieCount: number;
  SeriesCount: number;
  EpisodeCount: number;
  ArtistCount: number;
  AlbumCount: number;
  SongCount: number;
  MusicVideoCount: number;
  BoxSetCount: number;
  BookCount: number;
  PhotoCount: number;
}

export interface JellyfinSystemInfo {
  SystemUpdateLevel: string;
  DisplayName: string;
  Id: string;
  LogPath: string;
  OperatingSystem: string;
  OperatingSystemDisplayName: string;
  PackageName: string;
  ProductName: string;
  ServerName: string;
  Version: string;
  WebPath: string;
  HasPendingRestart: boolean;
  SupportsLibraryMonitor: boolean;
  WebSocketPortNumber: number;
  CompletedInstallations: unknown[];
  CanSelfRestart: boolean;
  CanSelfUpdate: boolean;
  CanLaunchWebBrowser: boolean;
  ProgramDataPath: string;
  ItemsByNamePath: string;
  CachePath: string;
  InternalMetadataPath: string;
  TranscodingTempPath: string;
  HttpServerPortNumber: number;
  SupportsHttps: boolean;
  HttpsPortNumber: number;
  HasUpdateAvailable: boolean;
  SupportsAutoRunAtStartup: boolean;
  HardwareAccelerationRequiresPremiere: boolean;
}

export const useJellyfin = (config: JellyfinConfig) => {
  const { isUnlocked } = useVaultSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const makeRequest = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      if (!isUnlocked) {
        throw new Error("Vault locked - unlock to use Jellyfin");
      }
      if (!config.serverUrl || !config.apiKey) {
        throw new Error("Jellyfin server URL and API key are required");
      }
      try {
        setLoading(true);
        setError(null);

        const base = config.serverUrl.endsWith("/")
          ? config.serverUrl.slice(0, -1)
          : config.serverUrl;
        const url = `${base}${endpoint}`;
        const response = await fetch(url, {
          ...options,
          headers: {
            "X-Emby-Token": config.apiKey,
            "Content-Type": "application/json",
            ...options.headers,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [config.serverUrl, config.apiKey, isUnlocked]
  );

  const getSystemInfo = useCallback(async (): Promise<JellyfinSystemInfo> => {
    const info = await makeRequest("/System/Info");
    // If we can fetch system info successfully we consider the connection established
    setIsConnected(true);
    return info;
  }, [makeRequest]);

  const getUsers = useCallback(async (): Promise<JellyfinUser[]> => {
    return makeRequest("/Users");
  }, [makeRequest]);

  const getSessions = useCallback(async (): Promise<JellyfinSession[]> => {
    return makeRequest("/Sessions");
  }, [makeRequest]);

  const getStats = useCallback(async (): Promise<JellyfinStats> => {
    return makeRequest("/Items/Counts");
  }, [makeRequest]);

  const playCommand = useCallback(
    async (sessionId: string) => {
      return makeRequest(`/Sessions/${sessionId}/Playing/Unpause`, {
        method: "POST",
      });
    },
    [makeRequest]
  );

  const pauseCommand = useCallback(
    async (sessionId: string) => {
      return makeRequest(`/Sessions/${sessionId}/Playing/Pause`, {
        method: "POST",
      });
    },
    [makeRequest]
  );

  const stopCommand = useCallback(
    async (sessionId: string) => {
      return makeRequest(`/Sessions/${sessionId}/Playing/Stop`, {
        method: "POST",
      });
    },
    [makeRequest]
  );

  const seekCommand = useCallback(
    async (sessionId: string, positionTicks: number) => {
      return makeRequest(
        `/Sessions/${sessionId}/Playing/Seek?seekPositionTicks=${positionTicks}`,
        {
          method: "POST",
        }
      );
    },
    [makeRequest]
  );

  const setVolumeCommand = useCallback(
    async (sessionId: string, volume: number) => {
      return makeRequest(`/Sessions/${sessionId}/Command`, {
        method: "POST",
        body: JSON.stringify({
          Name: "SetVolume",
          Arguments: {
            Volume: volume.toString(),
          },
        }),
      });
    },
    [makeRequest]
  );

  const testConnection = useCallback(async (): Promise<boolean> => {
    try {
      await getSystemInfo();
      return true;
    } catch {
      setIsConnected(false);
      return false;
    }
  }, [getSystemInfo]);

  return {
    loading,
    error,
    isConnected,
    testConnection,
    getSystemInfo,
    getUsers,
    getSessions,
    getStats,
    playCommand,
    pauseCommand,
    stopCommand,
    seekCommand,
    setVolumeCommand,
  };
};
