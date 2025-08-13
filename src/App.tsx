import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { useSettings } from "./hooks/useSettings";
import { VaultSessionProvider } from "./hooks/useVaultSession";
import { SettingsProvider } from "./hooks/useSettings";
import { Layout } from "@/components/Layout";
import { FocusTimerProvider } from "@/hooks/useFocusTimerController";
import { Skeleton } from "@/components/ui/skeleton";
import PageSkeleton from "@/components/PageSkeleton";

// Route-level code splitting
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Auth = lazy(() => import("./pages/Auth"));
const DayTracker = lazy(() => import("./pages/DayTracker"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const Vault = lazy(() => import("./pages/Vault"));
const Documents = lazy(() => import("./pages/Documents"));
const Inventory = lazy(() => import("./pages/Inventory"));
  const SteamStandalone = lazy(() => import("./pages/steam/SteamStandalone"));
  const MALStandalone = lazy(() => import("./pages/mal/MALStandalone"));
const HomelabMediaRequests = lazy(() => import("./pages/homelab/MediaRequests"));
const HomelabJellyfin = lazy(() => import("./pages/homelab/Jellyfin"));
const HomelabKarakeep = lazy(() => import("./pages/homelab/Karakeep"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Focus = lazy(() => import("./pages/Focus"));
const LiveShareNew = lazy(() => import("./pages/LiveShareNew"));
const LiveShareRoom = lazy(() => import("./pages/LiveShareRoom"));
const Profile = lazy(() => import("./pages/Profile"));
const Feeds = lazy(() => import("./pages/Feeds"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      // Keep data fresh enough to feel instant on navigation
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      // Minimize jitter
      refetchOnMount: false,
      retryOnMount: false,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="text-center">
          <div className="animate-pulse rounded-md h-8 w-8 bg-muted mx-auto mb-3" />
          <p className="text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  // Default index renders Dashboard
  const indexElement = <Dashboard />;
  return (
    <Suspense fallback={<PageSkeleton cards={6} /> }>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        {/* Public share routes - accessible without auth */}
        <Route path="/share/:id" element={<LiveShareRoom />} />
        {/* Steam Hub uses its own layout, not the site layout */}
        <Route
          path="/steam/*"
          element={
            <ProtectedRoute>
              <SteamStandalone />
            </ProtectedRoute>
          }
        />
        {/* MyAnimeList hub with immersive layout */}
        <Route
          path="/anime/*"
          element={
            <ProtectedRoute>
              <MALStandalone />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={indexElement} />
          <Route path="day-tracker" element={<DayTracker />} />
          <Route path="knowledge" element={<KnowledgeBase />} />
          <Route path="focus" element={<Focus />} />
          <Route path="feeds" element={<Feeds />} />
          <Route path="share/new" element={<LiveShareNew />} />
          <Route path="profile" element={<Profile />} />
          <Route path="vault" element={<Vault />} />
          <Route path="documents" element={<Documents />} />
          <Route path="inventory" element={<Inventory />} />
          {/* homelab pages removed */}
          <Route path="homelab/jellyfin" element={<HomelabJellyfin />} />
          <Route path="homelab/karakeep" element={<HomelabKarakeep />} />
          <Route
            path="homelab/media-requests"
            element={<HomelabMediaRequests />}
          />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <SettingsProvider>
          <AuthProvider>
            <VaultSessionProvider>
              <FocusTimerProvider>
                <Suspense fallback={<PageSkeleton withHeader={false} cards={3} cardHeightClassName="h-20" className="w-full" /> }>
                  <AppRoutes />
                </Suspense>
              </FocusTimerProvider>
            </VaultSessionProvider>
          </AuthProvider>
        </SettingsProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
