import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { VaultSessionProvider } from "./hooks/useVaultSession";
import { SettingsProvider } from "./hooks/useSettings";
import { Layout } from "@/components/Layout";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import DayTracker from "./pages/DayTracker";
import KnowledgeBase from "./pages/KnowledgeBase";
import Vault from "./pages/Vault";
import Documents from "./pages/Documents";
import Inventory from "./pages/Inventory";
import HomelabServers from "./pages/homelab/Servers";
import HomelabMonitoring from "./pages/homelab/Monitoring";
import HomelabNetwork from "./pages/homelab/Network";
import HomelabStorage from "./pages/homelab/Storage";
import HomelabMediaRequests from "./pages/homelab/MediaRequests";
import HomelabJellyfin from "./pages/homelab/Jellyfin";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Prevent automatic refetch when window/tab regains focus
      refetchOnWindowFocus: false,
      // Also prevent refetch on reconnect to avoid surprise reloads
      refetchOnReconnect: false,
      // Optional: don't retry immediately on error while user is navigating
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
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
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="day-tracker" element={<DayTracker />} />
        <Route path="knowledge" element={<KnowledgeBase />} />
        <Route path="vault" element={<Vault />} />
        <Route path="documents" element={<Documents />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="homelab/servers" element={<HomelabServers />} />
        <Route path="homelab/monitoring" element={<HomelabMonitoring />} />
        <Route path="homelab/network" element={<HomelabNetwork />} />
        <Route path="homelab/storage" element={<HomelabStorage />} />
        <Route path="homelab/jellyfin" element={<HomelabJellyfin />} />
        <Route
          path="homelab/media-requests"
          element={<HomelabMediaRequests />}
        />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SettingsProvider>
          <AuthProvider>
            <VaultSessionProvider>
              <AppRoutes />
            </VaultSessionProvider>
          </AuthProvider>
        </SettingsProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
