import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { KarakeepItem } from '@/hooks/useKarakeep';
import { Link as LinkIcon, Type as TypeIcon } from 'lucide-react';

interface KarakeepItemCardProps {
  item: KarakeepItem;
}

type KarakeepContent = {
  type?: 'link' | 'text' | 'asset' | 'unknown' | string;
  url?: string;
  title?: string | null;
  text?: string | null;
  imageUrl?: string | null;
  imageAssetId?: string | null;
  screenshotAssetId?: string | null;
};

function normalizeKarakeepContent(item: KarakeepItem): KarakeepContent {
  const c: any = (item as any).content || {};
  // Prefer spec-compliant content fields
  if (c && typeof c === 'object' && c.type) {
    return {
      type: c.type,
      url: c.url || (c.type === 'text' ? c.sourceUrl : undefined),
      title: c.title ?? (item as any).title ?? null,
      text: c.text ?? null,
      imageUrl: c.imageUrl ?? null,
      imageAssetId: c.imageAssetId ?? null,
      screenshotAssetId: c.screenshotAssetId ?? null,
    } as KarakeepContent;
  }
  // Back-compat with older/alternate shapes where fields are top-level
  return {
    type: (item as any).type,
    url: (item as any).url,
    title: (item as any).title ?? null,
    text: (item as any).text ?? null,
    imageUrl: (item as any).image || (item as any).thumbnail || null,
  } as KarakeepContent;
}

function proxifyImageUrlIfNeeded(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const url = String(rawUrl);
  // Keep data/blob URLs as-is (already allowed by CSP)
  if (/^(data|blob):/i.test(url)) return url;
  // If absolute external URL, route via dynamic proxy to make it same-origin
  if (/^https?:\/\//i.test(url)) {
    try {
      return `/proxy/dyn?url=${encodeURIComponent(url)}`;
    } catch (_) {
      return url;
    }
  }
  return url;
}

function getCandidateImageFields(item: KarakeepItem): Array<string | undefined> {
  const content = normalizeKarakeepContent(item);
  const assets: Array<any> = (item as any).assets || [];
  // Try official fields first (per /karakeep-app/karakeep API)
  const officialCandidates: Array<string | undefined> = [
    content.imageUrl || undefined,
  ];
  // Try common banner/screenshot assets if present. Note: these endpoints may require auth;
  // we only construct best-effort relative paths which work when the proxy upstream is configured.
  const assetId = content.imageAssetId || content.screenshotAssetId || assets.find((a: any) => a.assetType === 'bannerImage')?.id || assets.find((a: any) => a.assetType === 'screenshot')?.id;
  const proxiedAssetUrl = assetId ? `/karakeep/assets/${assetId}` : undefined;
  // Back-compat fallbacks
  const legacyCandidates: Array<string | undefined> = [
    (item as any).image,
    (item as any).poster,
    (item as any).cover,
    (item as any).thumbnail,
    (item as any)['og:image'],
    (item as any).og_image,
    (item as any).preview_image,
    (item as any).preview?.image,
    (item as any).meta?.image,
    (item as any).metadata?.image,
    (item as any).open_graph?.image,
    (item as any).og?.image,
    (item as any).images?.[0],
    (item as any).thumbnails?.[0],
  ];
  return [
    ...officialCandidates,
    proxiedAssetUrl,
    ...legacyCandidates,
  ];
}

function getBackgroundImage(item: KarakeepItem): string | null {
  const candidates = getCandidateImageFields(item)
    .filter(Boolean)
    .map((v) => String(v));
  for (const candidate of candidates) {
    const proxied = proxifyImageUrlIfNeeded(candidate);
    if (proxied) return proxied;
  }
  return null;
}

function getHost(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.host.replace(/^www\./, '');
  } catch (_) {
    return undefined;
  }
}

export default function KarakeepItemCard({ item }: KarakeepItemCardProps) {
  const content = normalizeKarakeepContent(item);
  const bg = getBackgroundImage(item) || '/placeholder.svg';
  const host = getHost(content.url);
  const title = (item as any).title || content.title || content.url || 'Untitled';
  const subtitle = content.type === 'link' ? content.url : content.text || undefined;

  return (
    <a
      href={content.url || '#'}
      target={content.url ? '_blank' : undefined}
      rel={content.url ? 'noreferrer' : undefined}
      className={cn(
        'group relative block overflow-hidden rounded-lg border',
        'bg-muted text-muted-foreground',
        'shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
      )}
      aria-label={title}
    >
      <div
        className="relative aspect-[16/9] w-full bg-cover bg-center"
        style={{ backgroundImage: `url(${bg})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/40 to-transparent" />
        <div className="absolute left-2 top-2 flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] uppercase">
            {content.type}
          </Badge>
          {host && (
            <span className="hidden sm:inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] text-foreground">
              {host}
            </span>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3 text-foreground">
          <div className="line-clamp-2 text-sm sm:text-base font-semibold drop-shadow">
            {title}
          </div>
          {subtitle && (
            <div className="mt-0.5 line-clamp-1 text-[11px] opacity-90 flex items-center gap-1">
              {content.type === 'link' ? (
                <LinkIcon className="h-3 w-3" />
              ) : (
                <TypeIcon className="h-3 w-3" />
              )}
              <span className="break-all">{subtitle}</span>
            </div>
          )}
          {Array.isArray(item.tags) && item.tags.length > 0 && (
            <div className="pointer-events-none mt-1 flex max-h-[44px] flex-wrap gap-1 overflow-hidden">
              {(item.tags as Array<string | { id?: string | number; name?: string }>).slice(0, 6).map((t, idx) => {
                const key = typeof t === 'string' ? `tag:${t}` : `tag:${t?.id ?? idx}`;
                const label = typeof t === 'string' ? t : t?.name ?? '';
                return (
                  <span
                    key={key}
                    className="rounded bg-muted px-1.5 py-0.5 text-[10px] leading-none text-foreground/95"
                  >
                    #{label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </a>
  );
}


