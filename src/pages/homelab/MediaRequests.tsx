import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Film, 
  Tv, 
  Search, 
  Plus,
  Settings,
  CheckCircle,
  Clock,
  X,
  User,
  Calendar,
  Star,
  RefreshCw,
  ExternalLink,
  Trash2
} from 'lucide-react';
import { useJellyseerr, type MediaRequest, type SearchResult } from '@/hooks/useJellyseerr';
import { useServiceApiConfig } from '@/hooks/useServiceApiConfig';
import { useVaultSession } from '@/hooks/useVaultSession';

export default function MediaRequests() {
  const { toast } = useToast();
  const { isUnlocked } = useVaultSession();
  const serviceConfig = useServiceApiConfig('jellyseerr');
  const jellyseerr = useJellyseerr(serviceConfig.config);
  
  const [requests, setRequests] = useState<MediaRequest[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-[hsl(var(--warning))]" />;
      case 'approved': return <CheckCircle className="w-4 h-4 text-[hsl(var(--success))]" />;
      case 'declined': return <X className="w-4 h-4 text-[hsl(var(--destructive))]" />;
      case 'available': return <CheckCircle className="w-4 h-4 text-[hsl(var(--info))]" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending': return 'warning' as const;
      case 'approved': return 'success' as const;
      case 'declined': return 'destructive' as const;
      case 'available': return 'info' as const;
      default: return 'secondary' as const;
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'movie' ? <Film className="w-4 h-4" /> : <Tv className="w-4 h-4" />;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const loadRequests = async () => {
    setIsLoadingRequests(true);
    try {
      const response = await jellyseerr.getRequests();
      setRequests(response.results);
    } catch (error) {
      toast({
        title: "Error loading requests",
        description: error instanceof Error ? error.message : "Failed to load requests",
        variant: "destructive",
      });
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const response = await jellyseerr.searchMedia(searchQuery);
      setSearchResults(response.results);
      setShowSearch(true);
    } catch (error) {
      toast({
        title: "Search failed",
        description: error instanceof Error ? error.message : "Failed to search media",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleCreateRequest = async (mediaId: number, mediaType: 'movie' | 'tv') => {
    try {
      await jellyseerr.createRequest(mediaId, mediaType);
      toast({
        title: "Request created",
        description: "Your media request has been submitted successfully",
      });
      loadRequests();
      setShowSearch(false);
      setSearchQuery('');
    } catch (error) {
      toast({
        title: "Request failed",
        description: error instanceof Error ? error.message : "Failed to create request",
        variant: "destructive",
      });
    }
  };

  const handleApproveRequest = async (requestId: number) => {
    try {
      await jellyseerr.updateRequestStatus(requestId, 'approve');
      toast({
        title: "Request approved",
        description: "The media request has been approved",
      });
      loadRequests();
    } catch (error) {
      toast({
        title: "Approval failed",
        description: error instanceof Error ? error.message : "Failed to approve request",
        variant: "destructive",
      });
    }
  };

  const handleDeclineRequest = async (requestId: number) => {
    try {
      await jellyseerr.updateRequestStatus(requestId, 'decline');
      toast({
        title: "Request declined",
        description: "The media request has been declined",
      });
      loadRequests();
    } catch (error) {
      toast({
        title: "Decline failed",
        description: error instanceof Error ? error.message : "Failed to decline request",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRequest = async (requestId: number) => {
    try {
      await jellyseerr.deleteRequest(requestId);
      toast({
        title: "Request deleted",
        description: "The media request has been deleted",
      });
      loadRequests();
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete request",
        variant: "destructive",
      });
    }
  };

  const handleTestConnection = async () => {
    const success = await jellyseerr.testConnection();
    if (success) {
      toast({
        title: "Connection successful",
        description: "Successfully connected to Jellyseerr",
      });
      loadRequests();
    } else {
      toast({
        title: "Connection failed",
        description: jellyseerr.error || "Failed to connect to Jellyseerr",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (jellyseerr.isConnected) {
      loadRequests();
    }
  }, [jellyseerr.isConnected, loadRequests]);

  const statusCounts = {
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    available: requests.filter(r => r.status === 'available').length,
    declined: requests.filter(r => r.status === 'declined').length
  };

  // Helper: disabled if vault locked
  const vaultLockedBanner = !isUnlocked && (
    <Card className="border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.12)]">
      <CardContent className="pt-6">
        <p className="text-[hsl(var(--warning))] text-sm font-medium">Unlock your secure vault to access Jellyseerr integration.</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Media Requests</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowConfig(!showConfig)}
            disabled={!isUnlocked}
          >
            <Settings className="w-4 h-4 mr-2" />
            Configure
          </Button>
          <Button 
            variant="outline"
            onClick={loadRequests}
            disabled={isLoadingRequests || !jellyseerr.isConnected || !isUnlocked}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingRequests ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowSearch(!showSearch)} disabled={!jellyseerr.isConnected || !isUnlocked}>
            <Plus className="w-4 h-4 mr-2" />
            New Request
          </Button>
        </div>
      </div>

      {vaultLockedBanner}

      {/* Connection Status */}
  <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${jellyseerr.isConnected ? 'bg-[hsl(var(--success))]' : 'bg-destructive'}`}></div>
              <span className="font-medium">
                Jellyseerr Connection: {jellyseerr.isConnected ? 'Connected' : 'Disconnected'}
              </span>
              {jellyseerr.loading && (
                <RefreshCw className="w-4 h-4 animate-spin text-[hsl(var(--info))]" />
              )}
            </div>
            <div className="text-sm text-muted-foreground">
      {jellyseerr.config.serverUrl || 'Not configured'}
            </div>
          </div>
          {jellyseerr.error && (
            <div className="mt-2 text-sm text-[hsl(var(--destructive))]">
              Error: {jellyseerr.error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Panel */}
      {showConfig && (
        <Card>
          <CardHeader>
            <CardTitle>Jellyseerr Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {serviceConfig.availableVaultItems.length > 0 && (
              <div>
                <label className="text-sm font-medium">Use Existing Credential</label>
                <Select
                  value={serviceConfig.linkedVaultItemId || ''}
                  onValueChange={(val) => serviceConfig.linkVaultItem(val === '' ? null : val)}
                  disabled={!isUnlocked || serviceConfig.saving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select saved API credential" />
                  </SelectTrigger>
                  <SelectContent>
                   <SelectItem value="Manual">Manual configuration</SelectItem>
                    {serviceConfig.availableVaultItems.map(item => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground mt-1">Pick a saved API credential from your secure vault.</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Server URL</label>
              <Input
                placeholder="http://localhost:5055"
                value={serviceConfig.config.serverUrl}
                onChange={(e) => serviceConfig.updateConfig({ serverUrl: e.target.value })}
                disabled={!isUnlocked || serviceConfig.saving || !!serviceConfig.linkedVaultItemId}
              />
              <p className="text-xs text-muted-foreground mt-1">
                The URL where your Jellyseerr instance is running
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">API Key</label>
              <Input
                type="password"
                placeholder="Your Jellyseerr API key"
                value={serviceConfig.config.apiKey}
                onChange={(e) => serviceConfig.updateConfig({ apiKey: e.target.value })}
                disabled={!isUnlocked || serviceConfig.saving || !!serviceConfig.linkedVaultItemId}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Found in Jellyseerr Settings → General → API Key
              </p>
              {serviceConfig.source === 'linked' && (
                <p className="text-xs text-[hsl(var(--success))] mt-1">Using linked vault credential.</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleTestConnection} disabled={jellyseerr.loading || !serviceConfig.isConfigured || !isUnlocked}>
                {jellyseerr.loading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Test Connection
              </Button>
              <Button variant="outline" onClick={() => setShowConfig(false)}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Request Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-[hsl(var(--warning))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-[hsl(var(--success))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.approved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <CheckCircle className="h-4 w-4 text-[hsl(var(--info))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.available}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Declined</CardTitle>
            <X className="h-4 w-4 text-[hsl(var(--destructive))]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.declined}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search Panel */}
  {showSearch && isUnlocked && (
        <Card>
          <CardHeader>
            <CardTitle>Search Media</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search for movies or TV shows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
                 {isSearching ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>
            
            {searchResults.length > 0 && (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {searchResults.map((result) => (
                   <div key={result.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-start space-x-3">
                      {result.posterPath && (
                        <img
                          src={`https://image.tmdb.org/t/p/w92${result.posterPath}`}
                          alt={result.title || result.name}
                          className="w-12 h-18 object-cover rounded"
                        />
                      )}
                      <div>
                        <h4 className="font-medium">{result.title || result.name}</h4>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          {getTypeIcon(result.mediaType)}
                          <span>{result.mediaType === 'movie' ? 'Movie' : 'TV Show'}</span>
                          {result.voteAverage > 0 && (
                            <div className="flex items-center space-x-1">
                              <Star className="w-3 h-3 text-[hsl(var(--warning))]" />
                              <span>{result.voteAverage.toFixed(1)}</span>
                            </div>
                          )}
                          <span>{result.releaseDate || result.firstAirDate}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 max-w-md">
                          {result.overview.length > 150 
                            ? `${result.overview.substring(0, 150)}...` 
                            : result.overview}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {result.mediaInfo?.status === 'available' && (
                        <Badge variant="info">Available</Badge>
                      )}
                      {result.mediaInfo?.status === 'pending' && (
                        <Badge variant="warning">Requested</Badge>
                      )}
                      {(!result.mediaInfo || result.mediaInfo.status === 'unknown') && (
                        <Button 
                          size="sm"
                          onClick={() => handleCreateRequest(result.id, result.mediaType)}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Request
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowSearch(false)}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      )}



      {/* Requests List */}
  {isLoadingRequests ? (
        <Card>
          <CardContent className="pt-6">
             <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 text-muted-foreground mx-auto mb-4 animate-spin" />
              <p className="text-muted-foreground">Loading requests...</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    {request.media.posterPath && (
                      <img
                        src={`https://image.tmdb.org/t/p/w92${request.media.posterPath}`}
                        alt={request.media.title}
                        className="w-16 h-24 object-cover rounded"
                      />
                    )}
                    <div className="flex items-center space-x-2">
                      {getTypeIcon(request.type)}
                      <div>
                        <h3 className="font-semibold text-lg">{request.media.title}</h3>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                          <div className="flex items-center space-x-1">
                            <User className="w-3 h-3" />
                            <span>{request.requestedBy.displayName}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDate(request.createdAt)}</span>
                          </div>
                          {request.media.releaseDate && (
                            <span>Released: {formatDate(request.media.releaseDate)}</span>
                          )}
                          {request.media.voteAverage && (
                            <div className="flex items-center space-x-1">
                             <Star className="w-3 h-3 text-[hsl(var(--warning))]" />
                              <span>{request.media.voteAverage.toFixed(1)}</span>
                            </div>
                          )}
                          {request.seasons && (
                            <span>{request.seasons.length} seasons</span>
                          )}
                        </div>
                         <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
                          {request.media.overview}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(request.status)}
                      <Badge variant={getStatusBadgeVariant(request.status)}>
                        {request.status}
                      </Badge>
                    </div>
                    
                    <div className="flex gap-2">
                      {request.status === 'pending' && (
                        <>
                          <Button 
                            size="sm" 
                            onClick={() => handleApproveRequest(request.id)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleDeclineRequest(request.id)}
                          >
                            <X className="w-4 h-4 mr-1" />
                            Decline
                          </Button>
                        </>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleDeleteRequest(request.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                      {jellyseerr.config.serverUrl && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => window.open(`${jellyseerr.config.serverUrl}/requests/${request.id}`, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoadingRequests && requests.length === 0 && (
        <Card>
          <CardContent className="pt-6">
             <div className="text-center py-8">
              <Film className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No requests found</h3>
              <p className="text-muted-foreground">
                {!isUnlocked ? 'Unlock the vault to access Jellyseerr.' : (!jellyseerr.isConnected 
                  ? 'Connect to Jellyseerr to view requests.' 
                  : 'No media requests have been made yet.')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}