import React, { startTransition } from 'react';
import { Link, LinkProps, useNavigate, useLocation } from 'react-router-dom';
import { useSettings } from '@/hooks/useSettings';

interface ViewTransitionLinkProps extends LinkProps {
  children: React.ReactNode;
}

interface NetworkConnection {
  saveData?: boolean;
  effectiveType?: string;
}

export const ViewTransitionLink: React.FC<ViewTransitionLinkProps> = ({ to, children, ...props }) => {
  const navigate = useNavigate();
  const location = useLocation();
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
      { test: (p) => p.startsWith('/anime'), load: () => import('@/pages/mal/MALStandalone') },
      // homelab static pages removed
      { test: (p) => p.startsWith('/homelab/jellyfin'), load: () => import('@/pages/homelab/Jellyfin') },
      { test: (p) => p.startsWith('/homelab/karakeep'), load: () => import('@/pages/homelab/Karakeep') },
    ];
    const match = prefetchers.find((f) => f.test(path));
    if (match && 'connection' in navigator) {
      const conn: NetworkConnection = (navigator as Navigator & { connection?: NetworkConnection }).connection;
      const saveData = Boolean(conn?.saveData);
      const slow = ['slow-2g', '2g'].includes(conn?.effectiveType || '');
      if (saveData || slow) return; // Respect Data Saver/slow connections
    }
    if (match) match.load().catch(() => {});
  };

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const isSteamTarget = typeof to === 'string' && (to as string).startsWith('/steam');
    const isFromSteam = location.pathname.startsWith('/steam');
    const isAnimeTarget = typeof to === 'string' && (to as string).startsWith('/anime');
    const isFromAnime = location.pathname.startsWith('/anime');
    const forceVt = isSteamTarget || isFromSteam || isAnimeTarget || isFromAnime;
    const shouldUseVT = (viewTransitionsEnabled || forceVt) && ('startViewTransition' in document);
    if (!shouldUseVT) {
      return; // Let the default Link behavior handle navigation
    }

    e.preventDefault();

    const vtClass = isSteamTarget || isFromSteam ? 'steam-vt' : (isAnimeTarget || isFromAnime ? 'anime-vt' : '');
    if (vtClass) document.documentElement.classList.add(vtClass);
    const transition = (document as Document & { startViewTransition: () => ViewTransition }).startViewTransition(() => {
      startTransition(() => navigate(to as string));
    });
    // Always cleanup the flag, whether success or error
    Promise.resolve(transition?.finished).finally(() => {
      if (vtClass) document.documentElement.classList.remove(vtClass);
    });
  };

  return (
    <Link to={to} onMouseEnter={handleMouseEnter} onFocus={handleMouseEnter} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
};