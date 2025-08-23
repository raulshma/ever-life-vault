import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { VaultSessionProvider } from "./hooks/useVaultSession";
import { SettingsProvider } from "./hooks/useSettings";
import { Layout } from "@/components/Layout";
import { FocusTimerProvider } from "@/hooks/useFocusTimerController";
import { TerminalProvider } from '@/features/infrastructure/terminal/TerminalProvider'
import { FloatingTerminal } from '@/features/infrastructure/terminal/FloatingTerminal'
// import { Skeleton } from "@/components/ui/skeleton";
// import PageSkeleton from "@/components/PageSkeleton";
import RouteLoadingFallback from "@/components/RouteLoadingFallback";

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
const Infrastructure = lazy(() => import("./pages/Infrastructure"));
const InfrastructureTerminals = lazy(
  () => import("./pages/InfrastructureTerminals")
);
const HomelabMediaRequests = lazy(
  () => import("./pages/homelab/MediaRequests")
);
const HomelabJellyfin = lazy(() => import("./pages/homelab/Jellyfin"));
const HomelabKarakeep = lazy(() => import("./pages/homelab/Karakeep"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Focus = lazy(() => import("./pages/Focus"));
const LiveShareNew = lazy(() => import("./pages/LiveShareNew"));
const LiveShareRoom = lazy(() => import("./pages/LiveShareRoom"));
const ClipNew = lazy(() => import("./pages/ClipNew"));
const ClipPage = lazy(() => import("./pages/ClipPage"));
const Profile = lazy(() => import("./pages/Profile"));
const Feeds = lazy(() => import("./pages/Feeds"));
const RepoFlatten = lazy(() => import("./pages/RepoFlatten"));
const Integrations = lazy(() => import("./pages/Integrations"));
const LLMModels = lazy(() => import("./pages/LLMModels"));
const Receipts = lazy(() => import("./pages/Receipts"));
const Analytics = lazy(() => import("./pages/Analytics"));

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
    return (
      <Suspense fallback={<RouteLoadingFallback variant="fullscreen" />}>
        <Auth />
      </Suspense>
    );
  }

  return <>{children}</>;
}

function AppRoutes() {
  // Default index renders Dashboard
  const indexElement = (
    <Suspense fallback={<RouteLoadingFallback variant="inline" />}>
      <Dashboard />
    </Suspense>
  );
  return (
    <Routes>
      <Route
        path="/auth"
        element={
          <Suspense fallback={<RouteLoadingFallback variant="fullscreen" />}>
            <Auth />
          </Suspense>
        }
      />
      {/* Public share routes - accessible without auth */}
      <Route
        path="/share/:id"
        element={
          <Suspense fallback={<RouteLoadingFallback variant="fullscreen" />}>
            <LiveShareRoom />
          </Suspense>
        }
      />
      {/* Public clip routes */}
      <Route
        path="/clip/:id"
        element={
          <Suspense fallback={<RouteLoadingFallback variant="fullscreen" />}>
            <ClipPage />
          </Suspense>
        }
      />
      {/* Steam Hub uses its own layout, not the site layout */}
      <Route
        path="/steam/*"
        element={
          <ProtectedRoute>
            <Suspense fallback={<RouteLoadingFallback variant="fullscreen" />}>
              <SteamStandalone />
            </Suspense>
          </ProtectedRoute>
        }
      />
      {/* MyAnimeList hub with immersive layout */}
      <Route
        path="/anime/*"
        element={
          <ProtectedRoute>
            <Suspense fallback={<RouteLoadingFallback variant="fullscreen" />}>
              <MALStandalone />
            </Suspense>
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
        <Route
          path="day-tracker"
          element={
            <Suspense fallback={<RouteLoadingFallback variant="inline" />}>
              {" "}
              <DayTracker />{" "}
            </Suspense>
          }
        />
        <Route
          path="knowledge"
          element={
            <Suspense fallback={<RouteLoadingFallback variant="inline" />}>
              {" "}
              <KnowledgeBase />{" "}
            </Suspense>
          }
        />
        <Route
          path="focus"
          element={
            <Suspense fallback={<RouteLoadingFallback variant="inline" />}>
              {" "}
              <Focus />{" "}
            </Suspense>
          }
        />
        <Route
          path="feeds"
          element={
            <Suspense fallback={<RouteLoadingFallback variant="inline" />}>
              {" "}
              <Feeds />{" "}
            </Suspense>
          }
        />
        <Route
          path="repo-flatten"
          element={
            <Suspense fallback={<RouteLoadingFallback variant="inline" />}>
              {" "}
              <RepoFlatten />{" "}
            </Suspense>
          }
        />
        <Route
          path="integrations"
          element={
            <Suspense fallback={<RouteLoadingFallback variant="inline" />}>
              <Integrations />
            </Suspense>
          }
        />
        <Route
          path="llm-models"
          element={
            <Suspense fallback={<RouteLoadingFallback variant="inline" />}>
              <LLMModels />
            </Suspense>
          }
        />
        <Route
          path="share/new"
          element={
            <Suspense fallback={<RouteLoadingFallback variant="inline" />}>
              {" "}
              <LiveShareNew />{" "}
            </Suspense>
          }
        />
        <Route
          path="clip/new"
          element={
            <Suspense fallback={<RouteLoadingFallback variant="inline" />}>
              {" "}
              <ClipNew />{" "}
            </Suspense>
          }
        />
        <Route
          path="profile"
          element={
            <Suspense fallback={<RouteLoadingFallback variant="inline" />}>
              {" "}
              <Profile />{" "}
            </Suspense>
          }
        />
        <Route
          path="vault"
          element={
            <Suspense fallback={<RouteLoadingFallback variant="inline" />}>
              {" "}
              <Vault />{" "}
            </Suspense>
          }
        />
        <Route
          path="documents"
          element={
            <Suspense fallback={<RouteLoadingFallback variant="inline" />}>
              {" "}
              <Documents />{" "}
            </Suspense>
          }
        />
        <Route
          path="inventory"
          element={
            <Suspense fallback={<RouteLoadingFallback variant="inline" />}>
              {" "}
              <Inventory />{" "}
            </Suspense>
          }
        />
        <Route
          path="receipts"
          element={
            <Suspense fallback={<RouteLoadingFallback variant="inline" />}>
              {" "}
              <Receipts />{" "}
            </Suspense>
          }
        />
        <Route
          path="analytics"
          element={
            <Suspense fallback={<RouteLoadingFallback variant="inline" />}>
              {" "}
              <Analytics />{" "}
            </Suspense>
          }
        />
        <Route
          path="infrastructure"
          element={
            <Suspense fallback={<RouteLoadingFallback variant="inline" />}>
              {" "}
              <Infrastructure />{" "}
            </Suspense>
          }
        />
        <Route
          path="infrastructure/terminals"
          element={
            <Suspense fallback={<RouteLoadingFallback variant="inline" />}>
              {" "}
              <InfrastructureTerminals />{" "}
            </Suspense>
          }
        />
        {/* homelab pages removed */}
        <Route
          path="homelab/jellyfin"
          element={
            <Suspense fallback={<RouteLoadingFallback variant="inline" />}>
              {" "}
              <HomelabJellyfin />{" "}
            </Suspense>
          }
        />
        <Route
          path="homelab/karakeep"
          element={
            <Suspense fallback={<RouteLoadingFallback variant="inline" />}>
              {" "}
              <HomelabKarakeep />{" "}
            </Suspense>
          }
        />
        <Route
          path="homelab/media-requests"
          element={
            <Suspense fallback={<RouteLoadingFallback variant="inline" />}>
              {" "}
              <HomelabMediaRequests />{" "}
            </Suspense>
          }
        />
      </Route>
      <Route
        path="*"
        element={
          <Suspense fallback={<RouteLoadingFallback variant="fullscreen" />}>
            <NotFound />
          </Suspense>
        }
      />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <SettingsProvider>
          <Sonner />
          <AuthProvider>
            <VaultSessionProvider>
              <FocusTimerProvider>
                <TerminalProvider>
                {/* Keep outer Suspense for initial app boot; use same fallback style for consistency */}
                <Suspense
                  fallback={<RouteLoadingFallback variant="fullscreen" />}
                >
                  <AppRoutes />
                </Suspense>
                  {/* Global floating terminal (PiP) */}
                  <FloatingTerminal />
                </TerminalProvider>
              </FocusTimerProvider>
            </VaultSessionProvider>
          </AuthProvider>
        </SettingsProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
