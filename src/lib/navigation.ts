import type React from "react";
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
  GitBranch,
  TerminalSquare,
} from "lucide-react";
import type { ComponentType } from "react";

export type NavItem = {
  name: string;
  path: string;
  // Icons from lucide-react are SVG components — use the SVG element props for better compatibility in JSX
  icon: ComponentType<React.SVGProps<SVGSVGElement>>;
};

export type NavGroups = Record<
  "productivity" | "media" | "infrastructure" | "account",
  NavItem[]
>;

export const moduleCategories: NavGroups = {
  productivity: [
    { name: "Dashboard", path: "/", icon: Home },
    { name: "Day Tracker", path: "/day-tracker", icon: Calendar },
    { name: "Focus", path: "/focus", icon: Sparkles },
    { name: "Tasks", path: "/tasks", icon: Bookmark },
    { name: "Knowledge Base", path: "/knowledge", icon: BookOpen },
    { name: "Documents", path: "/documents", icon: FileText },
    { name: "Inventory", path: "/inventory", icon: Package2 },
  ],
  media: [
    { name: "Feeds", path: "/feeds", icon: Bookmark },
    { name: "Steam Games", path: "/steam", icon: Gamepad2 },
    { name: "MyAnimeList", path: "/anime", icon: Bookmark },
    { name: "Jellyfin", path: "/homelab/jellyfin", icon: Play },
    { name: "Media Requests", path: "/homelab/media-requests", icon: Film },
    { name: "Karakeep", path: "/homelab/karakeep", icon: Bookmark },
  ],
  infrastructure: [
    { name: "Infrastructure", path: "/infrastructure", icon: Server },
    { name: "Terminals", path: "/infrastructure/terminals", icon: TerminalSquare },
    { name: "Vault", path: "/vault", icon: Shield },
    { name: "Repo Flattener", path: "/repo-flatten", icon: GitBranch },
    { name: "Live Share", path: "/share/new", icon: Share2 },
    { name: "Clip", path: "/clip/new", icon: FileText },
  ],
  account: [
    { name: "Profile", path: "/profile", icon: User },
  ],
};

export const orderedGroupTitles = [
  { key: "productivity", title: "Productivity" },
  { key: "media", title: "Media & Entertainment" },
  { key: "infrastructure", title: "Infrastructure" },
  { key: "account", title: "Account" },
] as const;

export function flattenAllNavItems(): { name: string; path: string }[] {
  return [
    ...moduleCategories.productivity,
    ...moduleCategories.media,
    ...moduleCategories.infrastructure,
    ...moduleCategories.account,
  ].map(({ name, path }) => ({ name, path }));
}


