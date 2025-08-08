import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { ViewTransitionLink } from "@/components/ViewTransitionLink";
import {
  Calendar,
  BookOpen,
  Shield,
  FileText,
  Package2,
  Plus,
  Home,
  Search,
  LogOut,
  Server,
  Monitor,
  Network,
  Database,
  ChevronDown,
  Film,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddTaskDialog } from "@/components/AddTaskDialog";

const moduleCategories = {
  daily: [
    { name: "Dashboard", path: "/", icon: Home },
    { name: "Day Tracker", path: "/day-tracker", icon: Calendar },
    { name: "Knowledge Base", path: "/knowledge", icon: BookOpen },
    { name: "Vault", path: "/vault", icon: Shield },
    { name: "Documents", path: "/documents", icon: FileText },
    { name: "Inventory", path: "/inventory", icon: Package2 },
  ],
  homelab: [
    { name: "Servers", path: "/homelab/servers", icon: Server },
    { name: "Monitoring", path: "/homelab/monitoring", icon: Monitor },
    { name: "Network", path: "/homelab/network", icon: Network },
    { name: "Storage", path: "/homelab/storage", icon: Database },
    { name: "Media Requests", path: "/homelab/media-requests", icon: Film },
  ],
};

// Helper function to check if any item in a category is active
const isCategoryActive = (category: typeof moduleCategories.daily) => {
  return category.some((module) => window.location.pathname === module.path);
};

// Category Dropdown Component
const CategoryDropdown: React.FC<{
  title: string;
  items: typeof moduleCategories.daily;
  location: ReturnType<typeof useLocation>;
}> = ({ title, items, location }) => {
  const isActive = items.some((item) => location.pathname === item.path);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 touch-manipulation",
            isActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          <span>{title}</span>
          <ChevronDown size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem key={item.path} asChild>
              <ViewTransitionLink
                to={item.path}
                className={cn(
                  "flex items-center space-x-2 w-full",
                  location.pathname === item.path &&
                    "bg-primary/10 text-primary"
                )}
              >
                <Icon size={16} />
                <span>{item.name}</span>
              </ViewTransitionLink>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Mobile Category Dropdown Component
const MobileCategoryDropdown: React.FC<{
  title: string;
  items: typeof moduleCategories.daily;
  location: ReturnType<typeof useLocation>;
}> = ({ title, items, location }) => {
  const isActive = items.some((item) => location.pathname === item.path);
  const activeItem = items.find((item) => location.pathname === item.path);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex flex-col items-center justify-center py-2 px-3 transition-colors min-h-[3.5rem] touch-manipulation min-w-[4rem]",
            isActive
              ? "text-primary"
              : "text-muted-foreground active:text-foreground"
          )}
        >
          <div
            className={cn(
              "flex items-center justify-center w-6 h-6 mb-1 transition-transform",
              isActive && "scale-110"
            )}
          >
            {activeItem ? (
              <activeItem.icon size={18} />
            ) : (
              <ChevronDown size={18} />
            )}
          </div>
          <span
            className={cn(
              "text-[9px] font-medium leading-tight text-center max-w-full",
              "xs:text-[10px]"
            )}
          >
            {activeItem
              ? activeItem.name === "Day Tracker"
                ? "Day"
                : activeItem.name === "Knowledge Base"
                ? "KB"
                : activeItem.name === "Documents"
                ? "Docs"
                : activeItem.name === "Dashboard"
                ? "Home"
                : activeItem.name
              : title}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top" className="w-48 mb-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem key={item.path} asChild>
              <ViewTransitionLink
                to={item.path}
                className={cn(
                  "flex items-center space-x-2 w-full",
                  location.pathname === item.path &&
                    "bg-primary/10 text-primary"
                )}
              >
                <Icon size={16} />
                <span>{item.name}</span>
              </ViewTransitionLink>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const Layout: React.FC = React.memo(() => {
  const location = useLocation();
  const { signOut } = useAuth();
  const { viewTransitionsEnabled, setViewTransitionsEnabled } = useSettings();

  // Local UI state for Search (Command Palette) and Quick Add
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = React.useState(false);

  // Quick Add handler (no-op for onAdd until wired to tasks hook/page)
  const handleQuickAdd = async (
    title: string,
    description?: string,
    priority?: "low" | "medium" | "high",
    dueDate?: string
  ) => {
    // TODO: Wire to tasks creation hook when available.
    // For now, just log and close dialog to give immediate feedback.
    console.debug("Quick Add task:", { title, description, priority, dueDate });
    return Promise.resolve();
  };

  // Global keyboard shortcut for opening search: Ctrl/Cmd + K
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      if (cmdOrCtrl && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-subtle safe-top safe-bottom">
      {/* Desktop Navigation */}
      <nav className="hidden md:flex fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-border shadow-card safe-top">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 safe-left safe-right">
          <div className="flex items-center justify-between">
            <div className="flex items-center min-w-0 flex-1">
              <ViewTransitionLink
                to="/"
                className="flex items-center space-x-2 flex-shrink-0 mr-4 lg:mr-8"
              >
                <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">LOS</span>
                </div>
                <span className="text-xl font-semibold text-foreground hidden lg:inline">
                  Life OS
                </span>
                <span className="text-lg font-semibold text-foreground lg:hidden">
                  LOS
                </span>
              </ViewTransitionLink>

              {/* Navigation with dropdowns */}
              <div className="flex items-center space-x-2 min-w-0 flex-1">
                <CategoryDropdown
                  title="Daily"
                  items={moduleCategories.daily}
                  location={location}
                />
                <CategoryDropdown
                  title="Homelab"
                  items={moduleCategories.homelab}
                  location={location}
                />
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 ml-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSearchOpen(true)}
                aria-label="Open Search (Ctrl/Cmd+K)"
                className="h-9 w-9"
              >
                <Search size={18} />
              </Button>
              <Button
                variant="hero"
                size="sm"
                className="hidden lg:inline-flex"
                onClick={() => setIsQuickAddOpen(true)}
              >
                <Plus size={16} />
                <span className="ml-1">Quick Add</span>
              </Button>
              <Button
                variant="hero"
                size="icon"
                className="lg:hidden h-9 w-9"
                onClick={() => setIsQuickAddOpen(true)}
                aria-label="Quick Add"
              >
                <Plus size={18} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setViewTransitionsEnabled(!viewTransitionsEnabled)
                }
                className="text-muted-foreground hover:text-foreground hidden xl:inline-flex"
                title={`${
                  viewTransitionsEnabled ? "Disable" : "Enable"
                } view transitions`}
              >
                {viewTransitionsEnabled ? "🔄" : "⏸️"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
                className="text-muted-foreground hover:text-foreground h-9"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline ml-2">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="sm:pt-4 md:pt-20 pb-24 md:pb-4">
        <div className="min-h-[calc(100vh-6rem)] md:min-h-[calc(100vh-5rem)] safe-left safe-right">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-border safe-bottom safe-left safe-right">
        <div className="flex justify-center py-2">
          <div className="flex items-center space-x-4">
            <MobileCategoryDropdown
              title="Daily"
              items={moduleCategories.daily}
              location={location}
            />
            <MobileCategoryDropdown
              title="Homelab"
              items={moduleCategories.homelab}
              location={location}
            />
          </div>
        </div>
      </nav>

      {/* Mobile Floating Action Button */}
      <div
        className="md:hidden fixed right-4 z-40 transition-transform active:scale-95"
        style={{
          bottom: "calc(4.75rem + env(safe-area-inset-bottom))",
          right: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        <Button
          variant="hero"
          size="icon"
          className="w-14 h-14 rounded-full shadow-glow touch-manipulation hover:scale-105 transition-transform"
          onClick={() => setIsQuickAddOpen(true)}
          aria-label="Quick Add Task"
        >
          <Plus size={24} />
        </Button>
      </div>

      {/* Search Command Palette */}
      <CommandDialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <CommandInput
          placeholder="Type a command or search..."
          className="text-base md:text-sm"
        />
        <CommandList className="max-h-[60vh] md:max-h-[400px]">
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Daily">
            {moduleCategories.daily.map((m) => (
              <CommandItem
                key={m.path}
                onSelect={() => {
                  setIsSearchOpen(false);
                }}
                className="py-3 md:py-2 text-base md:text-sm"
              >
                <m.icon className="mr-3 md:mr-2 h-5 w-5 md:h-4 md:w-4" />
                <span>{m.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Homelab">
            {moduleCategories.homelab.map((m) => (
              <CommandItem
                key={m.path}
                onSelect={() => {
                  setIsSearchOpen(false);
                }}
                className="py-3 md:py-2 text-base md:text-sm"
              >
                <m.icon className="mr-3 md:mr-2 h-5 w-5 md:h-4 md:w-4" />
                <span>{m.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Quick Add Task Dialog */}
      <AddTaskDialog
        open={isQuickAddOpen}
        onOpenChange={setIsQuickAddOpen}
        onAdd={async (...args) => {
          await handleQuickAdd(...args);
          setIsQuickAddOpen(false);
        }}
      />
    </div>
  );
});
