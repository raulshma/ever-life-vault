import { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// Badge is used inside cards, not in this page
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Bookmark,
  Search,
  Plus,
  Link as LinkIcon,
  Type,
  Settings,
  RefreshCw,
  Filter,
  X,
  LayoutGrid,
  List as ListIcon,
  Tag
} from 'lucide-react';
import { useServiceApiConfig } from '@/hooks/useServiceApiConfig';
import { useVaultSession } from '@/hooks/useVaultSession';
import { useKarakeep, type KarakeepItem, type KarakeepItemType } from '@/hooks/useKarakeep';
import { useToast } from '@/hooks/use-toast';
import KarakeepItemCard from '@/components/KarakeepItemCard';

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

  // UI/UX: local filters, sorting, and view mode
  const [activeType, setActiveType] = useState<'all' | KarakeepItemType>('all');
  const [tagFilter, setTagFilter] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const isConfigured = useMemo(
    () => isUnlocked && !!(serviceConfig.config.serverUrl && serviceConfig.config.apiKey),
    [isUnlocked, serviceConfig.config.serverUrl, serviceConfig.config.apiKey]
  );

  const canAdd = useMemo(() => {
    if (!isConfigured || !isUnlocked) return false;
    if (addType === 'link') return Boolean(addUrl.trim());
    if (addType === 'text') return Boolean(addText.trim());
    return true;
  }, [addType, addUrl, addText, isConfigured, isUnlocked]);

  useEffect(() => {
    setLocalServerUrl(serviceConfig.config.serverUrl || '');
    setLocalApiKey(serviceConfig.config.apiKey || '');
  }, [serviceConfig.config.serverUrl, serviceConfig.config.apiKey]);

  const loadInitial = async () => {
    setIsLoading(true);
    try {
      const tagList = tagFilter
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const { items: fetched } = await karakeep.listItems({
        q: searchQuery.trim() || undefined,
        type: activeType === 'all' ? undefined : activeType,
        tags: tagList.length ? tagList : undefined,
        sort: sortBy,
        limit: 60,
        offset: 0,
      });
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
    setIsSearching(true);
    try {
      const tagList = tagFilter
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const results = await karakeep.searchItems(searchQuery.trim(), {
        type: activeType === 'all' ? undefined : activeType,
        tags: tagList.length ? tagList : undefined,
        sort: sortBy,
      });
      setItems(results);
    } catch (e) {
      toast({ title: 'Search failed', description: e instanceof Error ? e.message : 'Failed to search', variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    loadInitial();
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

  const displayedItems = useMemo(() => {
    const byType = activeType === 'all' ? items : items.filter((i) => {
      const t: any = (i as any).type || (i as any).content?.type;
      return t === activeType;
    });
    const byTag = tagFilter.trim()
      ? byType.filter((i) => {
          const tags: any[] = Array.isArray((i as any).tags) ? (i as any).tags : [];
          const labelIncludes = (v: any) =>
            (typeof v === 'string' ? v : v?.name || '')
              .toLowerCase()
              .includes(tagFilter.trim().toLowerCase());
          return tags.some(labelIncludes);
        })
      : byType;
    const sorted = [...byTag].sort((a, b) => {
      const at = (a as any).createdAt || (a as any).created_at || 0;
      const bt = (b as any).createdAt || (b as any).created_at || 0;
      if (sortBy === 'title') {
        const atitle = ((a as any).title || (a as any).content?.title || '').toString().toLowerCase();
        const btitle = ((b as any).title || (b as any).content?.title || '').toString().toLowerCase();
        return atitle.localeCompare(btitle);
      }
      if (sortBy === 'oldest') return Number(at) - Number(bt);
      // newest
      return Number(bt) - Number(at);
    });
    return sorted;
  }, [items, activeType, tagFilter, sortBy]);

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
                  onValueChange={(val) => serviceConfig.linkVaultItem(val === '' || val === 'Manual' ? null : val)}
                  disabled={!isUnlocked || serviceConfig.saving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select saved API credential" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Manual">Manual configuration</SelectItem>
                    {serviceConfig.availableVaultItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                  <p className="text-xs text-muted-foreground mt-1">Pick a saved API credential from your secure vault.</p>
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
                  <p className="text-xs text-[hsl(var(--success))] mt-1">Using linked vault credential.</p>
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

      {/* Quick Add composer */}
      <Card className="mb-4 bg-gradient-card">
        <CardHeader>
          <CardTitle>Add to Karakeep</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={addType} onValueChange={(v) => setAddType(v as KarakeepItemType)}>
            <div className="flex flex-col gap-3">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="link" className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4" /> Link
                </TabsTrigger>
                <TabsTrigger value="text" className="flex items-center gap-2">
                  <Type className="w-4 h-4" /> Note
                </TabsTrigger>
              </TabsList>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Title</label>
                  <Input value={addTitle} onChange={(e) => setAddTitle(e.target.value)} placeholder="Optional" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Tags (comma separated)</label>
                  <Input value={addTags} onChange={(e) => setAddTags(e.target.value)} placeholder="reading, research" />
                </div>
              </div>

              <TabsContent value="link" className="mt-0">
                <label className="text-xs text-muted-foreground">URL</label>
                <Input
                  autoFocus
                  value={addUrl}
                  onChange={(e) => setAddUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleAdd();
                  }}
                />
              </TabsContent>
              <TabsContent value="text" className="mt-0">
                <label className="text-xs text-muted-foreground">Text</label>
                <Textarea
                  value={addText}
                  onChange={(e) => setAddText(e.target.value)}
                  placeholder="Write a quick note…"
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleAdd();
                  }}
                />
              </TabsContent>

              <div className="flex items-center gap-2">
                <Button onClick={handleAdd} disabled={karakeep.loading || !canAdd}>
                  <Plus className="w-4 h-4 mr-2" /> Add
                </Button>
                <p className="text-xs text-muted-foreground">Tip: Press Ctrl/⌘+Enter to add quickly</p>
              </div>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Browse & filter */}
      <Card className="bg-gradient-card">
        <CardHeader>
          <CardTitle>Browse</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search bar */}
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="Search (e.g. is:fav #tag url:example.com)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') runSearch();
                    if (e.key === 'Escape') clearSearch();
                  }}
                />
                {searchQuery && (
                  <button
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={clearSearch}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button onClick={runSearch} disabled={isSearching || !searchQuery.trim() || !isUnlocked || !isConfigured}>
                {isSearching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Tabs value={activeType} onValueChange={(v) => { setActiveType(v as 'all' | KarakeepItemType); setTimeout(loadInitial, 0); }}>
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="link">Links</TabsTrigger>
                    <TabsTrigger value="text">Notes</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <Input
                  className="h-9 w-[220px]"
                  placeholder="Filter tags (e.g. research)"
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  onBlur={loadInitial}
                />
              </div>

              <div className="ml-auto flex items-center gap-2">
                <Select value={sortBy} onValueChange={(v) => { setSortBy(v as any); setTimeout(loadInitial, 0); }}>
                  <SelectTrigger className="h-9 w-[160px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest</SelectItem>
                    <SelectItem value="oldest">Oldest</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                  </SelectContent>
                </Select>
                <div className="hidden sm:flex rounded-md border">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-none"
                    onClick={() => setViewMode('grid')}
                    aria-label="Grid view"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    className="rounded-none"
                    onClick={() => setViewMode('list')}
                    aria-label="List view"
                  >
                    <ListIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="mt-2 max-h-[65vh] overflow-auto">
              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Array.from({ length: 9 }).map((_, idx) => (
                    <div key={idx} className="h-[180px] animate-pulse rounded-lg bg-muted" />
                  ))}
                </div>
              ) : displayedItems.length === 0 ? (
                <div className="rounded-md border bg-background p-6 text-center text-sm text-muted-foreground">
                  No items match your filters. Try clearing search or adjusting filters.
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {displayedItems.map((item) => (
                    <KarakeepItemCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedItems.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3 hover:bg-muted/40">
                      <KarakeepItemCard item={item} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


