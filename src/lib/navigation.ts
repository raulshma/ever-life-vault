import {
  Home,
  Calendar,
  Sparkles,
  Bookmark,
  BookOpen,
  Shield,
  FileText,
  Package2,
  Share2,
  Server,
  Monitor,
  Network,
  Database,
  Play,
  Film,
  User,
  Gamepad2,
} from "lucide-react";
import type { ComponentType } from "react";

export type NavItem = {
  name: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
};

export type NavGroups = Record<
  "daily" | "share" | "homelab" | "account",
  NavItem[]
>;

export const moduleCategories: NavGroups = {
  daily: [
    { name: "Dashboard", path: "/", icon: Home },
    { name: "Day Tracker", path: "/day-tracker", icon: Calendar },
    { name: "Focus", path: "/focus", icon: Sparkles },
    { name: "Feeds", path: "/feeds", icon: Bookmark },
    { name: "Knowledge Base", path: "/knowledge", icon: BookOpen },
    { name: "Vault", path: "/vault", icon: Shield },
    { name: "Documents", path: "/documents", icon: FileText },
    { name: "Inventory", path: "/inventory", icon: Package2 },
    { name: "Steam Games", path: "/steam", icon: Gamepad2 },
    { name: "MyAnimeList", path: "/anime", icon: Bookmark },
  ],
  share: [
    { name: "Live Share", path: "/share/new", icon: Share2 },
    { name: "Clip", path: "/clip/new", icon: FileText },
  ],
  homelab: [
    { name: "Infrastructure", path: "/infrastructure", icon: Server },
    { name: "Jellyfin", path: "/homelab/jellyfin", icon: Play },
    { name: "Media Requests", path: "/homelab/media-requests", icon: Film },
    { name: "Karakeep", path: "/homelab/karakeep", icon: Bookmark },
  ],
  account: [
    { name: "Profile", path: "/profile", icon: User },
  ],
};

export const orderedGroupTitles = [
  { key: "daily", title: "Daily" },
  { key: "share", title: "Share" },
  { key: "homelab", title: "Homelab" },
  { key: "account", title: "Account" },
] as const;

export function flattenAllNavItems(): { name: string; path: string }[] {
  return [
    ...moduleCategories.daily,
    ...moduleCategories.share,
    ...moduleCategories.homelab,
    ...moduleCategories.account,
  ].map(({ name, path }) => ({ name, path }));
}


