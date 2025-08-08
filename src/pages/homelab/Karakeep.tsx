import { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Bookmark, Search, Plus, Link as LinkIcon, Type, Settings, RefreshCw } from 'lucide-react';
import { useServiceApiConfig } from '@/hooks/useServiceApiConfig';
import { useVaultSession } from '@/hooks/useVaultSession';
import { useKarakeep, type KarakeepItem, type KarakeepItemType } from '@/hooks/useKarakeep';
import { useToast } from '@/hooks/use-toast';

export default function Karakeep() {
  const { isUnlocked } = useVaultSession();
  const { toast } = useToast();
  const serviceConfig = useServiceApiConfig('karakeep');

  const karakeep = useKarakeep({
    serverUrl: serviceConfig.config.serverUrl || '',
    apiKey: serviceConfig.config.apiKey || '',
  });

  const [showConfig, setShowConfig] = useState(false);
  const [localServerUrl, setLocalServerUrl] = useState(serviceConfig.config.serverUrl || '');
  const [localApiKey, setLocalApiKey] = useState(serviceConfig.config.apiKey || '');

  const [items, setItems] = useState<KarakeepItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [addType, setAddType] = useState<KarakeepItemType>('link');
  const [addTitle, setAddTitle] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [addText, setAddText] = useState('');
  const [addTags, setAddTags] = useState('');

  const isConfigured = useMemo(
    () => isUnlocked && !!(serviceConfig.config.serverUrl && serviceConfig.config.apiKey),
    [isUnlocked, serviceConfig.config.serverUrl, serviceConfig.config.apiKey]
  );

  useEffect(() => {
    setLocalServerUrl(serviceConfig.config.serverUrl || '');
    setLocalApiKey(serviceConfig.config.apiKey || '');
  }, [serviceConfig.config.serverUrl, serviceConfig.config.apiKey]);

  const loadInitial = async () => {
    setIsLoading(true);
    try {
      const { items: fetched } = await karakeep.listItems({ limit: 25 });
      setItems(fetched);
    } catch (e) {
      // surfaced in toast or error state in hook
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConfigured) {
      loadInitial();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigured]);

  const handleTestConnection = async () => {
    const ok = await karakeep.testConnection();
    if (ok) {
      toast({ title: 'Connected', description: 'Successfully connected to Karakeep' });
      loadInitial();
    } else {
      toast({ title: 'Connection failed', description: karakeep.error || 'Could not connect', variant: 'destructive' });
    }
  };

  const handleSaveConfig = async () => {
    if (!isUnlocked) return;
    try {
      await serviceConfig.updateConfig({ serverUrl: localServerUrl, apiKey: localApiKey });
      toast({ title: 'Saved', description: 'Karakeep configuration updated' });
      await handleTestConnection();
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : 'Failed to save', variant: 'destructive' });
    }
  };

  const runSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await karakeep.searchItems(searchQuery.trim());
      setItems(results);
    } catch (e) {
      toast({ title: 'Search failed', description: e instanceof Error ? e.message : 'Failed to search', variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAdd = async () => {
    try {
      const payload: any = { type: addType as KarakeepItemType, title: addTitle || undefined };
      if (addType === 'link') payload.url = addUrl;
      if (addType === 'text') payload.text = addText;
      const tags = addTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      if (tags.length) payload.tags = tags;

      const created = await karakeep.addItem(payload);
      toast({ title: 'Item added', description: created.title || created.url || created.id?.toString() });
      setAddTitle('');
      setAddUrl('');
      setAddText('');
      setAddTags('');
      // refresh list
      await loadInitial();
    } catch (e) {
      toast({ title: 'Add failed', description: e instanceof Error ? e.message : 'Failed to add item', variant: 'destructive' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2">
          <Bookmark className="w-6 h-6 text-primary" />
          <h1 className="text-xl sm:text-2xl font-bold">Karakeep</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowConfig((v) => !v)} disabled={!isUnlocked}>
          <Settings className="w-4 h-4 mr-2" /> Settings
        </Button>
      </div>

      {!isUnlocked && (
        <Card className="border-amber-200 bg-amber-50 mb-4">
          <CardContent className="pt-6">
            <p className="text-amber-700 text-sm font-medium">Unlock your secure vault to access Karakeep integration.</p>
          </CardContent>
        </Card>
      )}

      {showConfig && (
        <Card className="mb-4 bg-gradient-card">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
                    <SelectItem value="">Manual configuration</SelectItem>
                    {serviceConfig.availableVaultItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">Pick a saved API credential from your secure vault.</p>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Server URL</label>
                <Input
                  placeholder="https://your-domain/api/v1"
                  value={localServerUrl}
                  onChange={(e) => setLocalServerUrl(e.target.value)}
                  disabled={!isUnlocked || serviceConfig.saving || !!serviceConfig.linkedVaultItemId}
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">API Key</label>
                <Input
                  placeholder="••••••••"
                  value={localApiKey}
                  onChange={(e) => setLocalApiKey(e.target.value)}
                  disabled={!isUnlocked || serviceConfig.saving || !!serviceConfig.linkedVaultItemId}
                />
                {serviceConfig.source === 'linked' && (
                  <p className="text-xs text-emerald-600 mt-1">Using linked vault credential.</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveConfig} disabled={!isUnlocked || serviceConfig.saving}>Save</Button>
              <Button variant="secondary" onClick={handleTestConnection} disabled={!isUnlocked || !serviceConfig.isConfigured}>
                <RefreshCw className="w-4 h-4 mr-2" /> Test
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 bg-gradient-card">
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Search query (e.g. is:fav #tag url:example.com)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              />
              <Button onClick={runSearch} disabled={isSearching || !searchQuery.trim() || !isUnlocked || !isConfigured}>
                {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-auto">
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : items.length === 0 ? (
                <div className="text-sm text-muted-foreground">No items</div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="p-3 rounded-md border flex items-start justify-between">
                    <div className="pr-3">
                      <div className="font-medium">{item.title || item.url || 'Untitled'}</div>
                      <div className="text-xs text-muted-foreground break-all flex items-center gap-1">
                        {item.type === 'link' ? <LinkIcon className="w-3 h-3" /> : <Type className="w-3 h-3" />}
                        {item.url || item.text?.slice(0, 120)}
                      </div>
                      <div className="mt-1 flex gap-1 flex-wrap">
                        {(item.tags || []).map((t: string) => (
                          <Badge key={t} variant="secondary" className="text-[10px]">#{t}</Badge>
                        ))}
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px] uppercase">{item.type}</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card">
          <CardHeader>
            <CardTitle>Add Item</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Type</label>
                <Select value={addType} onValueChange={(v) => setAddType(v as KarakeepItemType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="link">Link</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="asset" disabled>
                      Asset (via CLI)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Title</label>
                <Input value={addTitle} onChange={(e) => setAddTitle(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            {addType === 'link' && (
              <div>
                <label className="text-xs text-muted-foreground">URL</label>
                <Input value={addUrl} onChange={(e) => setAddUrl(e.target.value)} placeholder="https://…" />
              </div>
            )}
            {addType === 'text' && (
              <div>
                <label className="text-xs text-muted-foreground">Text</label>
                <Input value={addText} onChange={(e) => setAddText(e.target.value)} placeholder="Note text" />
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">Tags (comma separated)</label>
              <Input value={addTags} onChange={(e) => setAddTags(e.target.value)} placeholder="reading, research" />
            </div>
            <Button onClick={handleAdd} disabled={karakeep.loading || !isUnlocked || !isConfigured}>
              <Plus className="w-4 h-4 mr-2" /> Add
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


