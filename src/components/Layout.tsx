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
  Play,
  Bookmark,
  Menu,
  Sparkles,
  Pause,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { AddTaskDialog } from "@/components/AddTaskDialog";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar";

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
    { name: "Jellyfin", path: "/homelab/jellyfin", icon: Play },
    { name: "Media Requests", path: "/homelab/media-requests", icon: Film },
    { name: "Karakeep", path: "/homelab/karakeep", icon: Bookmark },
  ],
};

// Sidebar navigation for desktop + mobile drawer
const SidebarNavigation: React.FC<{
  location: ReturnType<typeof useLocation>;
  onOpenSearch: () => void;
  onOpenQuickAdd: () => void;
}> = ({ location, onOpenSearch, onOpenQuickAdd }) => {
  const navGroups = [
    { title: "Daily", items: moduleCategories.daily },
    { title: "Homelab", items: moduleCategories.homelab },
  ];

  return (
    <>
      <SidebarHeader className="px-3 py-3">
        <ViewTransitionLink to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/60 text-white grid place-items-center shadow-sm">
            <span className="font-bold text-xs">LOS</span>
          </div>
          <span className="font-semibold text-base">Life OS</span>
        </ViewTransitionLink>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] tracking-wide uppercase text-sidebar-foreground/60">
            Actions
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={onOpenSearch}>
                  <Search className="h-4 w-4" />
                  <span>Search</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={onOpenQuickAdd}>
                  <Plus className="h-4 w-4" />
                  <span>Quick Add</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {navGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-[11px] tracking-wide uppercase text-sidebar-foreground/60">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.name}
                      >
                        <ViewTransitionLink
                          to={item.path}
                          className={cn(
                            "flex items-center gap-2",
                            isActive && "font-medium"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.name}</span>
                        </ViewTransitionLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2">
          <FooterActions />
        </div>
      </SidebarFooter>
    </>
  );
};

// Footer actions reused in sidebar footer and topbar
const FooterActions: React.FC = () => {
  const { signOut } = useAuth();
  const { viewTransitionsEnabled, setViewTransitionsEnabled } = useSettings();

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setViewTransitionsEnabled(!viewTransitionsEnabled)}
        className="text-muted-foreground hover:text-foreground"
        title={`${viewTransitionsEnabled ? "Disable" : "Enable"} view transitions`}
      >
        {viewTransitionsEnabled ? (
          <Sparkles className="w-4 h-4" />
        ) : (
          <Pause className="w-4 h-4" />
        )}
        <span className="sr-only">Toggle view transitions</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => signOut()}
        className="text-muted-foreground hover:text-foreground"
      >
        <LogOut className="w-4 h-4" />
        <span className="ml-2">Sign Out</span>
      </Button>
    </>
  );
};

// Mobile bottom tab bar with quick access and a More (opens drawer)
const MobileTabBar: React.FC<{ location: ReturnType<typeof useLocation>; onQuickAdd: () => void }> = ({
  location,
  onQuickAdd,
}) => {
  const { setOpenMobile } = useSidebar();

  const tabs = [
    { name: "Home", path: "/", icon: Home },
    { name: "Day", path: "/day-tracker", icon: Calendar },
    { name: "KB", path: "/knowledge", icon: BookOpen },
    { name: "Vault", path: "/vault", icon: Shield },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-border safe-bottom safe-left safe-right">
      <div className="flex items-stretch justify-between px-2 py-1">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = location.pathname === t.path;
          return (
            <ViewTransitionLink
              key={t.path}
              to={t.path}
              className={cn(
                "flex-1 grid place-items-center py-2 rounded-xl mx-1 transition-all",
                isActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className={cn("h-5 w-5 mb-0.5", isActive && "scale-110")} />
              <span className="text-[10px] font-medium">{t.name}</span>
            </ViewTransitionLink>
          );
        })}
        <button
          onClick={() => setOpenMobile(true)}
          className="flex-1 grid place-items-center py-2 rounded-xl mx-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="More"
        >
          <Menu className="h-5 w-5 mb-0.5" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>
      <div className="pointer-events-none absolute -top-7 right-4">
        <Button
          variant="hero"
          size="icon"
          className="w-12 h-12 rounded-full shadow-glow pointer-events-auto"
          onClick={onQuickAdd}
          aria-label="Quick Add Task"
        >
          <Plus size={22} />
        </Button>
      </div>
    </nav>
  );
};

export const Layout: React.FC = React.memo(() => {
  const location = useLocation();

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
      <SidebarProvider>
        <Sidebar variant="inset" collapsible="icon">
          <SidebarNavigation
            location={location}
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenQuickAdd={() => setIsQuickAddOpen(true)}
          />
        </Sidebar>
        <SidebarInset>
          {/* Main Content */}
          <div className="px-2 sm:px-4 pt-3 pb-24 md:pb-6 safe-left safe-right">
            <Outlet />
          </div>

          {/* Mobile Bottom Tab Bar */}
          <MobileTabBar
            location={location}
            onQuickAdd={() => setIsQuickAddOpen(true)}
          />
        </SidebarInset>
      </SidebarProvider>

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
