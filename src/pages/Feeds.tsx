import React, { useMemo, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Earth, Mail, Rss, ThumbsUp } from 'lucide-react'
import { useAggregator } from '@/hooks/useAggregator'
import { Separator } from '@/components/ui/separator'

export default function Feeds() {
  const { items, loading, refreshAll, startOAuth, listRssSources, addRssSource, removeRssSource, saveManualToken, getProviderData } = useAggregator()
  const [rssUrl, setRssUrl] = useState('')
  const [twitterBearer, setTwitterBearer] = useState(() => (getProviderData('twitter').bearer as string) || '')
  const [facebookToken, setFacebookToken] = useState(() => (getProviderData('facebook').access_token as string) || '')
  const [instagramToken, setInstagramToken] = useState(() => (getProviderData('instagram').access_token as string) || '')
  const sources = listRssSources()
  const grouped = useMemo(() => {
    const m = new Map<string, ReturnType<typeof Array.prototype.slice>>()
    for (const it of items) {
      const arr = m.get(it.provider) || []
      arr.push(it)
      m.set(it.provider, arr)
    }
    return m
  }, [items])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Feeds"
        description="Aggregated social, RSS, and email updates"
        icon={Earth}
      >
        <Button variant="outline" onClick={() => refreshAll()} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</Button>
      </PageHeader>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
          <TabsTrigger value="rss">RSS</TabsTrigger>
          <TabsTrigger value="mail">Mail</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <FeedList items={items} emptyLabel="No items yet. Connect providers and refresh." />
        </TabsContent>

        <TabsContent value="social">
          <div className="mb-3 flex gap-2 flex-wrap">
            <Button onClick={() => startOAuth('reddit')} variant="secondary" size="sm"><ThumbsUp className="h-4 w-4 mr-1"/>Connect Reddit</Button>
          </div>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-sm">Manual tokens (stored securely in Vault)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Twitter/X Bearer token</label>
                <div className="flex gap-2 mt-1">
                  <Input placeholder="Bearer ..." value={twitterBearer} onChange={(e) => setTwitterBearer(e.target.value)} />
                  <Button onClick={async () => { await saveManualToken('twitter', { bearer: twitterBearer }); }} size="sm">Save</Button>
                </div>
              </div>
              <Separator />
              <div>
                <label className="text-xs text-muted-foreground">Facebook Graph API token</label>
                <div className="flex gap-2 mt-1">
                  <Input placeholder="EAAB..." value={facebookToken} onChange={(e) => setFacebookToken(e.target.value)} />
                  <Button onClick={async () => { await saveManualToken('facebook', { access_token: facebookToken }); }} size="sm">Save</Button>
                </div>
              </div>
              <Separator />
              <div>
                <label className="text-xs text-muted-foreground">Instagram API token</label>
                <div className="flex gap-2 mt-1">
                  <Input placeholder="IGQV..." value={instagramToken} onChange={(e) => setInstagramToken(e.target.value)} />
                  <Button onClick={async () => { await saveManualToken('instagram', { access_token: instagramToken }); }} size="sm">Save</Button>
                </div>
              </div>
            </CardContent>
          </Card>
          <FeedList items={[...(grouped.get('reddit') || []), ...(grouped.get('twitter') || []), ...(grouped.get('facebook') || []), ...(grouped.get('instagram') || [])]} emptyLabel="No social items yet." />
        </TabsContent>

        <TabsContent value="rss">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-sm">RSS Sources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-3">
                <Input placeholder="https://example.com/feed.xml" value={rssUrl} onChange={(e) => setRssUrl(e.target.value)} />
                <Button onClick={async () => { if (rssUrl) { await addRssSource(rssUrl); setRssUrl(''); } }}><Rss className="h-4 w-4 mr-1"/>Add</Button>
              </div>
              {sources.length === 0 ? (
                <p className="text-muted-foreground text-sm">No sources yet.</p>
              ) : (
                <ul className="space-y-1">
                  {sources.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                      <a href={s.url} target="_blank" className="truncate hover:underline">{s.title || s.url}</a>
                      <Button variant="ghost" size="sm" onClick={() => removeRssSource(s.id)}>Remove</Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <FeedList items={grouped.get('rss') || []} emptyLabel="No RSS items yet." />
        </TabsContent>

        <TabsContent value="mail">
          <div className="mb-3 flex gap-2 flex-wrap">
            <Button onClick={() => startOAuth('gmail')} variant="secondary" size="sm"><Mail className="h-4 w-4 mr-1"/>Connect Gmail</Button>
            <Button onClick={() => startOAuth('outlook')} variant="secondary" size="sm"><Mail className="h-4 w-4 mr-1"/>Connect Outlook</Button>
          </div>
          <FeedList items={[...(grouped.get('gmail') || []), ...(grouped.get('outlook') || [])]} emptyLabel="No unread emails." />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function FeedList({ items, emptyLabel }: { items: ReturnType<typeof Array.prototype.slice>, emptyLabel: string }) {
  if (!items || items.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyLabel}</p>
  }
  return (
    <div className="grid gap-2 sm:gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((it) => (
        <Card key={it.id} className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              <span className="inline-flex items-center gap-2">
                <ProviderBadge provider={it.provider} />
                <a href={it.url} target="_blank" className="hover:underline truncate inline-block max-w-[14rem] align-middle">{it.title}</a>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span className="truncate">{it.author || ''}</span>
              {it.timestamp && <span>{new Date(it.timestamp).toLocaleString()}</span>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ProviderBadge({ provider }: { provider: string }) {
  const map: Record<string, React.ReactNode> = {
    reddit: <span className="px-2 py-0.5 rounded bg-orange-500/15 text-orange-500 text-[11px]">Reddit</span>,
    twitter: <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-500 text-[11px]">Twitter</span>,
    facebook: <span className="px-2 py-0.5 rounded bg-blue-600/15 text-blue-600 text-[11px]">Facebook</span>,
    instagram: <span className="px-2 py-0.5 rounded bg-fuchsia-500/15 text-fuchsia-500 text-[11px]">Instagram</span>,
    rss: <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 text-[11px]">RSS</span>,
    gmail: <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-500 text-[11px]">Gmail</span>,
    outlook: <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-500 text-[11px]">Outlook</span>,
  }
  return <>{map[provider] || <span className="px-2 py-0.5 rounded bg-muted text-foreground/60 text-[11px]">{provider}</span>}</>
}


