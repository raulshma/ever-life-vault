import React, { startTransition } from 'react';
import { Link, LinkProps, useNavigate } from 'react-router-dom';
import { useSettings } from '@/hooks/useSettings';

interface ViewTransitionLinkProps extends LinkProps {
  children: React.ReactNode;
}

export const ViewTransitionLink: React.FC<ViewTransitionLinkProps> = ({ to, children, ...props }) => {
  const navigate = useNavigate();
  const { viewTransitionsEnabled } = useSettings();

  const handleMouseEnter = () => {
    // Best-effort prefetch for common routes to make navigation feel instant
    if (typeof to !== 'string') return;
    const path = to;
    const prefetchers: Array<{ test: (p: string) => boolean; load: () => Promise<unknown> }> = [
      { test: (p) => p === '/', load: () => import('@/pages/Dashboard') },
      { test: (p) => p.startsWith('/day-tracker'), load: () => import('@/pages/DayTracker') },
      { test: (p) => p.startsWith('/knowledge'), load: () => import('@/pages/KnowledgeBase') },
      { test: (p) => p.startsWith('/focus'), load: () => import('@/pages/Focus') },
      { test: (p) => p.startsWith('/feeds'), load: () => import('@/pages/Feeds') },
      { test: (p) => p.startsWith('/vault'), load: () => import('@/pages/Vault') },
      { test: (p) => p.startsWith('/documents'), load: () => import('@/pages/Documents') },
      { test: (p) => p.startsWith('/inventory'), load: () => import('@/pages/Inventory') },
      { test: (p) => p.startsWith('/steam'), load: () => import('@/pages/steam/SteamStandalone') },
      // homelab static pages removed
      { test: (p) => p.startsWith('/homelab/jellyfin'), load: () => import('@/pages/homelab/Jellyfin') },
      { test: (p) => p.startsWith('/homelab/karakeep'), load: () => import('@/pages/homelab/Karakeep') },
    ];
    const match = prefetchers.find((f) => f.test(path));
    if (match && 'connection' in navigator) {
      const conn: any = (navigator as any).connection;
      const saveData = Boolean(conn?.saveData);
      const slow = ['slow-2g', '2g'].includes(conn?.effectiveType);
      if (saveData || slow) return; // Respect Data Saver/slow connections
    }
    if (match) match.load().catch(() => {});
  };

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const isSteamTarget = typeof to === 'string' && (to as string).startsWith('/steam');
    const shouldUseVT = (viewTransitionsEnabled || isSteamTarget) && ('startViewTransition' in document);
    if (!shouldUseVT) {
      return; // Let the default Link behavior handle navigation
    }

    e.preventDefault();

    if (isSteamTarget) {
      document.documentElement.classList.add('steam-vt');
    }
    const transition = (document as any).startViewTransition(() => {
      startTransition(() => navigate(to as string));
    });
    // Always cleanup the flag, whether success or error
    Promise.resolve(transition?.finished).finally(() => {
      document.documentElement.classList.remove('steam-vt');
    });
  };

  return (
    <Link to={to} onMouseEnter={handleMouseEnter} onFocus={handleMouseEnter} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
};