import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import { ViewTransitionLink } from "@/components/ViewTransitionLink";
import { Calendar, Plus, ChevronDown, Bookmark, Menu, Sparkles, Pause, Sun, Moon, Laptop2, Contrast, Settings, Home, BookOpen, Shield, Search, LogOut } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { AddTaskDialog } from "@/components/AddTaskDialog";
import { FloatingMiniTimer } from "@/components/focus/FloatingMiniTimer";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarSeparator, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { moduleCategories as baseModuleCategories, orderedGroupTitles } from "@/lib/navigation";
import NavigationCustomizeDialog from "@/components/NavigationCustomizeDialog";
import RouteLoadingFallback from "@/components/RouteLoadingFallback";
import { Suspense } from "react";

const moduleCategories = baseModuleCategories;

// Theme menu button (moved from footer to header)
const ThemeMenuButton: React.FC = () => {
  const { themeMode, setThemeMode } = useSettings();
  const [openThemeMenu, setOpenThemeMenu] = React.useState(false);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpenThemeMenu((v) => !v)}
        className="text-muted-foreground hover:text-foreground"
        title="Theme"
        aria-haspopup="menu"
        aria-expanded={openThemeMenu}
      >
        {themeMode === 'amoled' ? (
          <Contrast className="w-4 h-4" />
        ) : themeMode === 'dark' ? (
          <Moon className="w-4 h-4" />
        ) : themeMode === 'light' ? (
          <Sun className="w-4 h-4" />
        ) : (
          <Laptop2 className="w-4 h-4" />
        )}
        <span className="sr-only">Toggle theme</span>
      </Button>
      {openThemeMenu && (
        <div
          role="menu"
          className="absolute right-0 mt-2 z-50 min-w-[10rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {(() => {
            type LocalThemeMode = 'light' | 'dark' | 'amoled' | 'system';
            const opts: { key: LocalThemeMode; label: string; icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
              { key: 'light', label: 'Light', icon: Sun },
              { key: 'dark', label: 'Dark', icon: Moon },
              { key: 'amoled', label: 'AMOLED Black', icon: Contrast },
              { key: 'system', label: 'System', icon: Laptop2 },
            ];
            return opts.map((opt) => (
              <button
                key={opt.key}
                role="menuitemradio"
                aria-checked={themeMode === opt.key}
                onClick={() => {
                  setThemeMode(opt.key);
                  setOpenThemeMenu(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                  themeMode === opt.key ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {React.createElement(opt.icon, { className: 'h-4 w-4' })}
                <span>{opt.label}</span>
              </button>
            ));
          })()}
        </div>
      )}
    </div>
  );
};

// Sidebar navigation for desktop + mobile drawer
const SidebarNavigation: React.FC<{
  location: ReturnType<typeof useLocation>;
  onOpenSearch: () => void;
  onOpenQuickAdd: () => void;
  onOpenCustomize: () => void;
}> = ({ location, onOpenSearch, onOpenQuickAdd, onOpenCustomize }) => {
  const navigate = useNavigate();
  const { sidebarOrder, autoCategorizeSidebar } = useSettings();
  const groupMap = {
    Productivity: "productivity",
    "Media & Entertainment": "media",
    Infrastructure: "infrastructure",
    Account: "account",
  } as const;

  const deriveGroupItems = (
    title: keyof typeof groupMap
  ) => {
    const key = groupMap[title];
    const order = sidebarOrder?.[key] ?? [];
    const base = moduleCategories[key as keyof typeof moduleCategories];
    if (autoCategorizeSidebar) {
      return [...base].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (!order.length) return base;
    const pathToItem = new Map(base.map((i) => [i.path, i] as const));
    const seen = new Set<string>();
    const orderedExisting = order
      .map((p) => {
        const item = pathToItem.get(p);
        if (item && !seen.has(p)) {
          seen.add(p);
          return item;
        }
        return null;
      })
      .filter(Boolean) as typeof base;
    const remaining = base.filter((i) => !seen.has(i.path));
    return [...orderedExisting, ...remaining];
  };

  const groupTitleList = autoCategorizeSidebar
    ? [...orderedGroupTitles].sort((a, b) => a.title.localeCompare(b.title))
    : orderedGroupTitles;

  const navGroups = groupTitleList.map(({ title }) => ({
    title,
    items: deriveGroupItems(title as keyof typeof groupMap),
  }));

  return (
    <>
      <SidebarHeader className="px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <ViewTransitionLink to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground grid place-items-center shadow-sm">
              <span className="font-bold text-xs">LOS</span>
            </div>
            <span className="font-semibold text-base">Life OS</span>
          </ViewTransitionLink>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenCustomize}
              className="text-muted-foreground hover:text-foreground"
              title="Customize navigation"
            >
              <Settings className="w-4 h-4" />
              <span className="sr-only">Customize navigation</span>
            </Button>
            <ThemeMenuButton />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[11px] tracking-wide uppercase text-sidebar-foreground/60">
            Actions
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <SidebarMenuButton onClick={onOpenSearch}>
                    <Search className="h-4 w-4" />
                    <span>Search</span>
                  </SidebarMenuButton>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <SidebarMenuButton onClick={onOpenQuickAdd}>
                    <Plus className="h-4 w-4" />
                    <span>Quick Add</span>
                  </SidebarMenuButton>
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
                  const Icon = item.icon as React.ComponentType<any>;
                  const isActive = location.pathname === item.path;
                  return (
                    <SidebarMenuItem key={item.path}>
                      {item.path === "/steam" ? (
                        <SidebarMenuButton
                          isActive={isActive}
                          tooltip={item.name}
                          onClick={(e) => {
                            // Force Steam view transition regardless of global toggle
                            if ("startViewTransition" in document) {
                              e.preventDefault();
                              document.documentElement.classList.add("steam-vt");
                              const t = (document as any).startViewTransition?.(() => {
                                navigate("/steam");
                              });
                              Promise.resolve(t?.finished).finally(() => {
                                document.documentElement.classList.remove("steam-vt");
                              });
                            } else {
                              navigate("/steam");
                            }
                          }}
                        >
                          <span className={cn("flex items-center gap-2", isActive && "font-medium") }>
                            <Icon className="h-4 w-4" />
                            <span>{item.name}</span>
                          </span>
                        </SidebarMenuButton>
                      ) : item.path === "/anime" ? (
                        <SidebarMenuButton
                          isActive={isActive}
                          tooltip={item.name}
                          onClick={(e) => {
                            if ("startViewTransition" in document) {
                              e.preventDefault();
                              document.documentElement.classList.add("anime-vt");
                              const t = (document as any).startViewTransition?.(() => {
                                navigate("/anime");
                              });
                              Promise.resolve(t?.finished).finally(() => {
                                document.documentElement.classList.remove("anime-vt");
                              });
                            } else {
                              navigate("/anime");
                            }
                          }}
                        >
                          <span className={cn("flex items-center gap-2", isActive && "font-medium") }>
                            <Icon className="h-4 w-4" />
                            <span>{item.name}</span>
                          </span>
                        </SidebarMenuButton>
                      ) : (
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
                      )}
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

// Footer actions (theme toggle moved to header)
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/90 dark:bg-card/70 backdrop-blur-xl border-t border-border safe-bottom safe-left safe-right">
      <div className="flex items-stretch justify-between px-2 py-1">
        {tabs.map((t) => {
          const Icon = t.icon as React.ComponentType<any>;
          const targetPath = t.path;
          const isActive = location.pathname === t.path;
          return (
            <ViewTransitionLink
              key={t.path}
              to={targetPath}
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
  const navigate = useNavigate();

  // Local UI state for Search (Command Palette) and Quick Add
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = React.useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = React.useState(false);

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
            onOpenCustomize={() => setIsCustomizeOpen(true)}
          />
        </Sidebar>
        <SidebarInset>
          {/* Main Content */}
          <div className="px-2 sm:px-4 pt-3 pb-mobile-tabbar md:pb-6 safe-left safe-right">
            <Suspense fallback={<RouteLoadingFallback variant="inline" />}> 
              <Outlet />
            </Suspense>
            <FloatingMiniTimer />
          </div>

          {/* Mobile Bottom Tab Bar */}
          <MobileTabBar
            location={location}
            onQuickAdd={() => setIsQuickAddOpen(true)}
          />
        </SidebarInset>
      </SidebarProvider>

      <NavigationCustomizeDialog open={isCustomizeOpen} onOpenChange={setIsCustomizeOpen} />

      {/* Search Command Palette */}
      <CommandDialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
        <CommandInput
          placeholder="Type a command or search..."
          className="text-base md:text-sm"
        />
        <CommandList className="max-h-[60vh] md:max-h-[400px]">
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Productivity">
            {moduleCategories.productivity.map((m) => (
              <CommandItem
                key={m.path}
                onSelect={() => {
                  setIsSearchOpen(false);
                  navigate(m.path);
                }}
                className="py-3 md:py-2 text-base md:text-sm"
              >
                {React.createElement(m.icon, { className: 'mr-3 md:mr-2 h-5 w-5 md:h-4 md:w-4' })}
                <span>{m.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Media & Entertainment">
            {moduleCategories.media.map((m) => (
              <CommandItem
                key={m.path}
                onSelect={() => {
                  setIsSearchOpen(false);
                  navigate(m.path);
                }}
                className="py-3 md:py-2 text-base md:text-sm"
              >
                {React.createElement(m.icon, { className: 'mr-3 md:mr-2 h-5 w-5 md:h-4 md:w-4' })}
                <span>{m.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Infrastructure">
            {moduleCategories.infrastructure.map((m) => (
              <CommandItem
                key={m.path}
                onSelect={() => {
                  setIsSearchOpen(false);
                  navigate(m.path);
                }}
                className="py-3 md:py-2 text-base md:text-sm"
              >
                {React.createElement(m.icon, { className: 'mr-3 md:mr-2 h-5 w-5 md:h-4 md:w-4' })}
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
