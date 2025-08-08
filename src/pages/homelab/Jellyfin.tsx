import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Play,
  Pause,
  Square,
  Volume2,
  Users,
  Film,
  Tv,
  Music,
  Settings,
  Server,
  Activity,
  Clock,
  Monitor,
  SkipForward,
  SkipBack,
} from "lucide-react";
import {
  useJellyfin,
  JellyfinConfig,
  JellyfinSession,
  JellyfinUser,
  JellyfinStats,
  JellyfinSystemInfo,
} from "@/hooks/useJellyfin";

export default function Jellyfin() {
  const [config, setConfig] = useState<JellyfinConfig>({
    serverUrl: "http://localhost:8096",
    apiKey: "",
  });
  const [isConfigured, setIsConfigured] = useState(false);
  const [sessions, setSessions] = useState<JellyfinSession[]>([]);
  const [users, setUsers] = useState<JellyfinUser[]>([]);
  const [stats, setStats] = useState<JellyfinStats | null>(null);
  const [systemInfo, setSystemInfo] = useState<JellyfinSystemInfo | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(
    null
  );
  const [isSeeking, setIsSeeking] = useState<string | null>(null); // Track which session is seeking
  const [seekTimeout, setSeekTimeout] = useState<NodeJS.Timeout | null>(null);

  const {
    loading,
    error,
    getSystemInfo,
    getUsers,
    getSessions,
    getStats,
    playCommand,
    pauseCommand,
    stopCommand,
    seekCommand,
    setVolumeCommand,
  } = useJellyfin(config);

  const fetchData = useCallback(async () => {
    if (!isConfigured) return;

    try {
      const [sessionsData, usersData, statsData, systemData] =
        await Promise.all([
          getSessions(),
          getUsers(),
          getStats(),
          getSystemInfo(),
        ]);

      setSessions(sessionsData);
      setUsers(usersData);
      setStats(statsData);
      setSystemInfo(systemData);
    } catch (err) {
      console.error("Failed to fetch Jellyfin data:", err);
    }
  }, [isConfigured, getSessions, getUsers, getStats, getSystemInfo]);

  useEffect(() => {
    if (isConfigured) {
      fetchData();
      const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
      setRefreshInterval(interval);

      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [isConfigured, fetchData]);

  const handleConfigSave = () => {
    if (config.serverUrl && config.apiKey) {
      setIsConfigured(true);
    }
  };

  const formatTime = (ticks: number) => {
    const totalSeconds = Math.floor(ticks / 10000000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getProgressPercentage = (session: JellyfinSession) => {
    if (!session.NowPlayingItem || !session.PlayState) return 0;
    return (
      (session.PlayState.PositionTicks / session.NowPlayingItem.RunTimeTicks) *
      100
    );
  };

  const handlePlayPause = async (session: JellyfinSession) => {
    try {
      if (session.PlayState?.IsPaused) {
        await playCommand(session.Id);
      } else {
        await pauseCommand(session.Id);
      }
      fetchData(); // Refresh data after command
    } catch (err) {
      console.error("Failed to control playback:", err);
    }
  };

  const handleStop = async (sessionId: string) => {
    try {
      await stopCommand(sessionId);
      fetchData();
    } catch (err) {
      console.error("Failed to stop playback:", err);
    }
  };

  const handleVolumeChange = async (sessionId: string, volume: number) => {
    try {
      await setVolumeCommand(sessionId, volume);
    } catch (err) {
      console.error("Failed to change volume:", err);
    }
  };

  const handleSeek = useCallback(
    async (session: JellyfinSession, percentage: number) => {
      if (!session.NowPlayingItem) {
        console.log("No playing item found for seek");
        return;
      }

      console.log(`Seeking to ${percentage}% for session ${session.Id}`);
      setIsSeeking(session.Id);

      try {
        const positionTicks = Math.floor(
          (percentage / 100) * session.NowPlayingItem.RunTimeTicks
        );
        console.log(`Seeking to position: ${positionTicks} ticks`);

        await seekCommand(session.Id, positionTicks);
        console.log("Seek command successful");

        // Clear seeking state and refresh after a short delay
        setTimeout(() => {
          setIsSeeking(null);
          fetchData();
        }, 500);
      } catch (err) {
        console.error("Failed to seek:", err);
        setIsSeeking(null);
      }
    },
    [seekCommand, fetchData]
  );

  const handleSeekDebounced = useCallback(
    (session: JellyfinSession, percentage: number) => {
      // Clear any existing timeout
      if (seekTimeout) {
        clearTimeout(seekTimeout);
      }

      // Set a new timeout to debounce the seek operation
      const timeout = setTimeout(() => {
        handleSeek(session, percentage);
      }, 300); // 300ms debounce

      setSeekTimeout(timeout);
    },
    [seekTimeout, handleSeek]
  );

  const handleSkip = async (session: JellyfinSession, seconds: number) => {
    if (!session.NowPlayingItem || !session.PlayState) return;

    try {
      const currentTicks = session.PlayState.PositionTicks;
      const skipTicks = seconds * 10000000; // Convert seconds to ticks
      const newPositionTicks = Math.max(
        0,
        Math.min(currentTicks + skipTicks, session.NowPlayingItem.RunTimeTicks)
      );

      await seekCommand(session.Id, newPositionTicks);
      fetchData(); // Refresh data after seeking
    } catch (err) {
      console.error("Failed to skip:", err);
    }
  };

  if (!isConfigured) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">Jellyfin Media Server</h1>

        <Card>
          <CardHeader>
            <CardTitle>Configure Jellyfin Connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Server URL
              </label>
              <Input
                placeholder="http://localhost:8096"
                value={config.serverUrl}
                onChange={(e) =>
                  setConfig({ ...config, serverUrl: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">API Key</label>
              <Input
                type="password"
                placeholder="Your Jellyfin API Key"
                value={config.apiKey}
                onChange={(e) =>
                  setConfig({ ...config, apiKey: e.target.value })
                }
              />
            </div>
            <Button
              onClick={handleConfigSave}
              disabled={!config.serverUrl || !config.apiKey}
            >
              Connect to Jellyfin
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Jellyfin Media Server</h1>
        <Button variant="outline" onClick={() => setIsConfigured(false)}>
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* System Info */}
      {systemInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Server className="w-5 h-5 mr-2" />
              Server Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Server Name</p>
                <p className="font-medium">{systemInfo.ServerName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Version</p>
                <p className="font-medium">{systemInfo.Version}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Operating System</p>
                <p className="font-medium">
                  {systemInfo.OperatingSystemDisplayName}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <Badge
                  className={
                    systemInfo.HasUpdateAvailable
                      ? "bg-yellow-500"
                      : "bg-green-500"
                  }
                >
                  {systemInfo.HasUpdateAvailable
                    ? "Update Available"
                    : "Up to Date"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Users className="w-8 h-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">{stats.UserCount}</p>
                  <p className="text-xs text-gray-600">Users</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Film className="w-8 h-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">{stats.MovieCount}</p>
                  <p className="text-xs text-gray-600">Movies</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Tv className="w-8 h-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">{stats.SeriesCount}</p>
                  <p className="text-xs text-gray-600">Series</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Tv className="w-8 h-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">{stats.EpisodeCount}</p>
                  <p className="text-xs text-gray-600">Episodes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Music className="w-8 h-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">{stats.ArtistCount}</p>
                  <p className="text-xs text-gray-600">Artists</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Music className="w-8 h-8 text-pink-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">{stats.AlbumCount}</p>
                  <p className="text-xs text-gray-600">Albums</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Music className="w-8 h-8 text-indigo-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">{stats.SongCount}</p>
                  <p className="text-xs text-gray-600">Songs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Activity className="w-8 h-8 text-teal-600" />
                <div className="ml-4">
                  <p className="text-2xl font-bold">{stats.ItemCount}</p>
                  <p className="text-xs text-gray-600">Total Items</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Monitor className="w-5 h-5 mr-2" />
            Active Sessions ({sessions.filter((s) => s.NowPlayingItem).length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.filter((s) => s.NowPlayingItem).length === 0 ? (
            <p className="text-gray-600">No active playback sessions</p>
          ) : (
            <div className="space-y-4">
              {sessions
                .filter((s) => s.NowPlayingItem)
                .map((session) => (
                  <div key={session.Id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold">
                          {session.NowPlayingItem?.Name}
                        </h3>
                        {session.NowPlayingItem?.SeriesName && (
                          <p className="text-sm text-gray-600">
                            {session.NowPlayingItem.SeriesName}
                            {session.NowPlayingItem.SeasonName &&
                              ` - ${session.NowPlayingItem.SeasonName}`}
                            {session.NowPlayingItem.IndexNumber &&
                              ` Episode ${session.NowPlayingItem.IndexNumber}`}
                          </p>
                        )}
                        <p className="text-sm text-gray-600">
                          {session.UserName} on {session.DeviceName} (
                          {session.Client})
                        </p>
                      </div>
                      <Badge
                        className={
                          session.PlayState?.IsPaused
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }
                      >
                        {session.PlayState?.IsPaused ? "Paused" : "Playing"}
                      </Badge>
                    </div>

                    {/* Interactive Seek Bar */}
                    <div className="mb-3">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>
                          {session.PlayState
                            ? formatTime(session.PlayState.PositionTicks)
                            : "0:00"}
                        </span>
                        <span>
                          {session.NowPlayingItem
                            ? formatTime(session.NowPlayingItem.RunTimeTicks)
                            : "0:00"}
                        </span>
                      </div>
                      {session.SupportsRemoteControl ? (
                        <div className="relative">
                          <Slider
                            value={[getProgressPercentage(session)]}
                            onValueChange={([value]) => {
                              console.log(`Slider value changing: ${value}%`);
                              handleSeekDebounced(session, value);
                            }}
                            onValueCommit={([value]) => {
                              console.log(`Slider value committed: ${value}%`);
                              // Clear debounce and seek immediately on commit
                              if (seekTimeout) {
                                clearTimeout(seekTimeout);
                                setSeekTimeout(null);
                              }
                              handleSeek(session, value);
                            }}
                            max={100}
                            step={0.5}
                            className="w-full cursor-pointer"
                            disabled={loading || isSeeking === session.Id}
                          />
                          <div className="text-xs text-gray-500 mt-1 text-center">
                            {isSeeking === session.Id ? (
                              <span className="text-blue-600">Seeking...</span>
                            ) : session.SupportsRemoteControl ? (
                              "Click or drag to seek"
                            ) : (
                              "Remote control not supported"
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${getProgressPercentage(session)}%`,
                            }}
                          ></div>
                        </div>
                      )}
                    </div>

                    {/* Controls */}
                    {session.SupportsRemoteControl && (
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSkip(session, -30)}
                            disabled={loading}
                            title="Skip back 30 seconds"
                          >
                            <SkipBack className="w-4 h-4" />
                            <span className="text-xs ml-1">30s</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSkip(session, -10)}
                            disabled={loading}
                            title="Skip back 10 seconds"
                          >
                            <SkipBack className="w-4 h-4" />
                            <span className="text-xs ml-1">10s</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePlayPause(session)}
                            disabled={loading}
                          >
                            {session.PlayState?.IsPaused ? (
                              <Play className="w-4 h-4" />
                            ) : (
                              <Pause className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSkip(session, 10)}
                            disabled={loading}
                            title="Skip forward 10 seconds"
                          >
                            <span className="text-xs mr-1">10s</span>
                            <SkipForward className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSkip(session, 30)}
                            disabled={loading}
                            title="Skip forward 30 seconds"
                          >
                            <span className="text-xs mr-1">30s</span>
                            <SkipForward className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStop(session.Id)}
                            disabled={loading}
                          >
                            <Square className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Volume Control */}
                        <div className="flex items-center gap-2 flex-1 max-w-xs">
                          <Volume2 className="w-4 h-4" />
                          <Slider
                            value={[session.PlayState?.VolumeLevel || 100]}
                            onValueChange={([value]) =>
                              handleVolumeChange(session.Id, value)
                            }
                            max={100}
                            step={1}
                            className="flex-1"
                            disabled={loading}
                          />
                          <span className="text-sm w-8">
                            {session.PlayState?.VolumeLevel || 100}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Users ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((user) => (
              <div key={user.Id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">{user.Name}</h3>
                  <div className="flex gap-1">
                    {user.IsAdministrator && (
                      <Badge variant="secondary">Admin</Badge>
                    )}
                    <Badge
                      className={user.IsActive ? "bg-green-500" : "bg-gray-500"}
                    >
                      {user.IsActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  {user.LastActivityDate && (
                    <div className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      Last activity:{" "}
                      {new Date(user.LastActivityDate).toLocaleDateString()}
                    </div>
                  )}
                  {user.LastLoginDate && (
                    <div className="flex items-center">
                      <Activity className="w-3 h-3 mr-1" />
                      Last login:{" "}
                      {new Date(user.LastLoginDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* All Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Monitor className="w-5 h-5 mr-2" />
            All Sessions ({sessions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sessions.map((session) => (
              <div
                key={session.Id}
                className="flex justify-between items-center p-3 border rounded"
              >
                <div>
                  <p className="font-medium">{session.UserName}</p>
                  <p className="text-sm text-gray-600">
                    {session.DeviceName} ({session.Client}{" "}
                    {session.ApplicationVersion})
                  </p>
                </div>
                <div className="text-right">
                  <Badge
                    className={
                      session.IsActive ? "bg-green-500" : "bg-gray-500"
                    }
                  >
                    {session.IsActive ? "Active" : "Inactive"}
                  </Badge>
                  {session.NowPlayingItem && (
                    <p className="text-sm text-gray-600 mt-1">
                      Playing: {session.NowPlayingItem.Name}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
