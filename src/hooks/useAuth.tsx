import { useState, useEffect, createContext, useContext, useRef, useMemo } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase, SUPABASE_AUTH_STORAGE_KEY, SUPABASE_NO_REMEMBER_FLAG_KEY } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const initialLoadRef = useRef(true);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      const nextUser = nextSession?.user ?? null;
      const nextUserId = nextUser?.id ?? null;
      const prevUserId = lastUserIdRef.current;

      // Determine if meaningful auth identity changed
      const identityChanged = prevUserId !== nextUserId;

      // Update refs first
      lastUserIdRef.current = nextUserId;

      // Only update state for identity changes or explicit sign-in/sign-out
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || identityChanged) {
        setSession(nextSession ?? null);
        setUser(nextUser);
      }
      // Ensure loading resolved on first event
      if (loading) {
        setLoading(false);
      }

      // If user chose not to be remembered, ensure tokens never persist in localStorage
      try {
        const noRemember = sessionStorage.getItem(SUPABASE_NO_REMEMBER_FLAG_KEY) === '1';
        if (noRemember && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED")) {
          localStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);
        }
        if (event === "SIGNED_OUT") {
          sessionStorage.removeItem(SUPABASE_NO_REMEMBER_FLAG_KEY);
        }
      } catch {}

      // Navigation logic remains the same
      if (event === "SIGNED_IN") {
        if (location.pathname === "/auth") {
          navigate("/", { replace: true });
        }
      } else if (event === "SIGNED_OUT") {
        navigate("/auth", { replace: true });
      }

      if (initialLoadRef.current) {
        initialLoadRef.current = false;
      }
    });

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const nextUserId = session?.user?.id ?? null;
      lastUserIdRef.current = nextUserId;

      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (initialLoadRef.current) {
        initialLoadRef.current = false;
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
    }
  };

  const ctxValue = useMemo(
    () => ({ user, session, loading, signOut }),
    [user?.id, session?.access_token, loading]
  );

  return (
    <AuthContext.Provider value={ctxValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
