import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { deriveKey, generateSalt, uint8ArrayToBase64, base64ToUint8Array, validateMasterPassword } from '@/lib/crypto';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';

interface VaultSession {
  isUnlocked: boolean;
  masterKey: CryptoKey | null;
  salt: Uint8Array | null;
  unlockedAt: number;
  expiresAt: number;
  sessionId: string;
}

// Removed unused interfaces - they can be added back when needed

const DEFAULT_INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds

// Exposed context type
interface UseVaultSessionReturn {
  isUnlocked: boolean;
  hasVault: boolean;
  loading: boolean;
  masterKey: CryptoKey | null;
  initializeVault: (masterPassword: string) => Promise<boolean>;
  unlockVault: (masterPassword: string, timeoutMinutes?: number) => Promise<boolean>;
  lockVault: () => void;
  changeMasterPassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  resetInactivityTimer: () => void;
  deriveMasterKey: (password: string) => Promise<boolean>;
}

const VaultSessionContext = createContext<UseVaultSessionReturn | undefined>(undefined);

function useVaultSessionInternal() {
  const [session, setSession] = useState<VaultSession>({
    isUnlocked: false,
    masterKey: null,
    salt: null,
    unlockedAt: 0,
    expiresAt: 0,
    sessionId: '',
  });
  const [hasVault, setHasVault] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const checkIntervalRef = useRef<NodeJS.Timeout>(undefined);

  // Local storage keys
  const LOCAL_SESSION_KEY = 'vault_session';
  const LOCAL_WRAPPED_KEY = 'vault_wrapped_key';

  // Generate a unique session ID
  const generateSessionId = useCallback(() => {
    const bytes = crypto.getRandomValues(new Uint8Array(16)); // 128-bit random
    let base64 = btoa(String.fromCharCode(...bytes));
    // base64url without padding
    base64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `vs_${base64}`;
  }, []);

  // Generate a random per-session secret (32 bytes, base64)
  const generateServerSecret = useCallback(() => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return uint8ArrayToBase64(bytes);
  }, []);

  // Create AES-KW wrapping key from base64 secret
  const importWrappingKey = useCallback(async (base64Secret: string) => {
    const secretBytes = base64ToUint8Array(base64Secret);
    return crypto.subtle.importKey(
      'raw',
      secretBytes,
      'AES-KW',
      false,
      ['wrapKey', 'unwrapKey']
    );
  }, []);

  // Wrap master key and store locally
  const persistWrappedMasterKey = useCallback(async (masterKey: CryptoKey, serverSecret: string) => {
    try {
      const wrappingKey = await importWrappingKey(serverSecret);
      const wrapped = await crypto.subtle.wrapKey('raw', masterKey, wrappingKey, 'AES-KW');
      const wrappedBytes = new Uint8Array(wrapped);
      const wrappedB64 = uint8ArrayToBase64(wrappedBytes);
      sessionStorage.setItem(LOCAL_WRAPPED_KEY, wrappedB64);
    } catch (error) {
      console.error('Failed to wrap/persist master key:', error);
    }
  }, [importWrappingKey]);

  // Try to restore wrapped master key from local storage
  const tryRestoreMasterKey = useCallback(async (serverSecret: string): Promise<CryptoKey | null> => {
    try {
      const wrappedB64 = sessionStorage.getItem(LOCAL_WRAPPED_KEY);
      if (!wrappedB64) return null;
      const wrappingKey = await importWrappingKey(serverSecret);
      const wrappedBytes = base64ToUint8Array(wrappedB64);
      const unwrapped = await crypto.subtle.unwrapKey(
        'raw',
        wrappedBytes,
        wrappingKey,
        'AES-KW',
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
      return unwrapped;
    } catch (error) {
      console.warn('Failed to restore master key from wrapped form:', error);
      return null;
    }
  }, [importWrappingKey]);

  // Validate that the unwrapped key can decrypt at least one item (if any exist)
  const validateRestoredKey = useCallback(async (key: CryptoKey): Promise<boolean> => {
    if (!user) return false;
    try {
      const { data, error } = await supabase
        .from('encrypted_vault_items')
        .select('id, encrypted_data, iv, auth_tag, item_type, name, created_at, updated_at')
        .eq('user_id', user.id)
        .limit(1);
      if (error) return false;
      if (!data || data.length === 0) return true; // Nothing to validate against
      const item = data[0] as any;
      // Attempt to decrypt minimal
      const { decryptData, base64ToArrayBuffer, base64ToUint8Array } = await import('@/lib/crypto');
      await decryptData(
        base64ToArrayBuffer(item.encrypted_data),
        key,
        base64ToUint8Array(item.iv),
        base64ToUint8Array(item.auth_tag)
      );
      return true;
    } catch (e) {
      return false;
    }
  }, [user]);

  // Store session in localStorage
  const storeSessionLocally = useCallback((sessionData: VaultSession) => {
    try {
      sessionStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({
        sessionId: sessionData.sessionId,
        unlockedAt: sessionData.unlockedAt,
        expiresAt: sessionData.expiresAt,
        isUnlocked: sessionData.isUnlocked,
      }));
    } catch (error) {
      console.error('Failed to store session locally:', error);
    }
  }, []);

  // Clear session from localStorage
  const clearSessionLocally = useCallback(() => {
    try {
      sessionStorage.removeItem(LOCAL_SESSION_KEY);
      sessionStorage.removeItem(LOCAL_WRAPPED_KEY);
    } catch (error) {
      console.error('Failed to clear session locally:', error);
    }
  }, []);

  // Store session in database
  const storeSessionInDB = useCallback(async (sessionId: string, expiresAt: number, serverSecret: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('vault_sessions')
        .insert({
          user_id: user.id,
          session_id: sessionId,
          expires_at: new Date(expiresAt).toISOString(),
          server_secret: serverSecret,
        });
      
      if (error) {
        console.error('Failed to store session in database:', error);
      }
    } catch (error) {
      console.error('Error storing session in database:', error);
    }
  }, [user]);

  // Fetch server_secret for a session
  const getServerSecretFromDB = useCallback(async (sessionId: string): Promise<string | null> => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('vault_sessions')
        .select('server_secret, expires_at')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .single();
      if (error || !data) return null;
      const expiresAt = new Date(data.expires_at).getTime();
      if (Date.now() >= expiresAt) return null;
      return data.server_secret as string;
    } catch (e) {
      console.error('Error fetching server secret:', e);
      return null;
    }
  }, [user]);

  // Check if session is valid in database
  const checkSessionInDB = useCallback(async (sessionId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { data, error } = await supabase
        .from('vault_sessions')
        .select('expires_at')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .single();
      
      if (error || !data) return false;
      
      const expiresAt = new Date(data.expires_at).getTime();
      return Date.now() < expiresAt;
    } catch (error) {
      console.error('Error checking session in database:', error);
      return false;
    }
  }, [user]);

  // Clear session from database
  const clearSessionFromDB = useCallback(async (sessionId?: string) => {
    if (!user) return;
    
    try {
      let query = supabase
        .from('vault_sessions')
        .delete()
        .eq('user_id', user.id);
      
      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }
      
      await query;
    } catch (error) {
      console.error('Error clearing session from database:', error);
    }
  }, [user]);

  // Clean up expired sessions
  const cleanupExpiredSessions = useCallback(async () => {
    if (!user) return;
    
    try {
      await supabase
        .from('vault_sessions')
        .delete()
        .eq('user_id', user.id)
        .lt('expires_at', new Date().toISOString());
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
    }
  }, [user]);

  // Lock vault and clear sensitive data
  const lockVault = useCallback(async () => {
    const currentSessionId = session.sessionId;
    
    setSession(prev => ({
      isUnlocked: false,
      masterKey: null,
      salt: prev.salt, // Keep salt for next unlock
      unlockedAt: 0,
      expiresAt: 0,
      sessionId: '',
    }));
    
    // Clear persistent session data
    clearSessionLocally();
    if (currentSessionId) {
      await clearSessionFromDB(currentSessionId);
    }
    
    // Force garbage collection of sensitive data
    if (typeof window !== 'undefined' && (window as any).gc) {
      (window as any).gc();
    }
  }, [session.sessionId, clearSessionLocally, clearSessionFromDB]);

  // Check if current session is still valid
  const checkSessionValidity = useCallback(async () => {
    if (!session.isUnlocked || !session.sessionId) return;
    
    const now = Date.now();
    
    // Check local expiration first
    if (now >= session.expiresAt) {
      await lockVault();
      toast({
        title: "Vault Locked",
        description: "Your vault session has expired.",
        variant: "default",
      });
      return;
    }
    
    // Check database validity
    const isValidInDB = await checkSessionInDB(session.sessionId);
    if (!isValidInDB) {
      await lockVault();
      toast({
        title: "Vault Locked",
        description: "Your vault session is no longer valid.",
        variant: "default",
      });
    }
  }, [session.isUnlocked, session.sessionId, session.expiresAt, lockVault, toast, checkSessionInDB]);

  // Restore session from localStorage on app start
  const restoreSession = useCallback(async () => {
    if (!user || !session.salt) return;
    
    try {
      const storedSession = sessionStorage.getItem(LOCAL_SESSION_KEY);
      if (!storedSession) return;
      
      const parsed = JSON.parse(storedSession);
      const now = Date.now();
      
      // Check if session is expired locally
      if (now >= parsed.expiresAt) {
        clearSessionLocally();
        return;
      }
      
      // Check if session is valid in database
      const isValidInDB = await checkSessionInDB(parsed.sessionId);
      if (!isValidInDB) {
        clearSessionLocally();
        return;
      }
      
      // Attempt to rehydrate master key using wrapped key and server secret
      const serverSecret = await getServerSecretFromDB(parsed.sessionId);
      if (!serverSecret) {
        clearSessionLocally();
        return;
      }

      const restoredMasterKey = await tryRestoreMasterKey(serverSecret);
      if (!restoredMasterKey) {
        clearSessionLocally();
        return;
      }

      // Ensure the key is valid for current data
      const isKeyValid = await validateRestoredKey(restoredMasterKey);
      if (!isKeyValid) {
        clearSessionLocally();
        return;
      }
      
      setSession(prev => ({
        ...prev,
        isUnlocked: true,
        masterKey: restoredMasterKey,
        sessionId: parsed.sessionId,
        unlockedAt: parsed.unlockedAt,
        expiresAt: parsed.expiresAt,
      }));
      
      const remainingTime = Math.ceil((parsed.expiresAt - now) / (60 * 1000));
      toast({
        title: "Session Restored",
        description: `Your vault session is active for ${remainingTime} more minutes.`,
      });
    } catch (error) {
      console.error('Error restoring session:', error);
      clearSessionLocally();
    }
  }, [user, session.salt, checkSessionInDB, clearSessionLocally, toast, getServerSecretFromDB, tryRestoreMasterKey, validateRestoredKey]);

  // Re-derive master key when needed (for restored sessions)
  const deriveMasterKey = useCallback(async (password: string): Promise<boolean> => {
    if (!session.salt) return false;
    
    try {
      const masterKey = await deriveKey(password, session.salt, true);
      setSession(prev => ({ ...prev, masterKey }));
      return true;
    } catch (error) {
      console.error('Error deriving master key:', error);
      return false;
    }
  }, [session.salt]);

  // Reset inactivity timer (keeping for compatibility but now it's just session validity check)
  const resetInactivityTimer = useCallback(() => {
    // This is now just a compatibility function
    // The actual session management is time-based, not activity-based
  }, []);

  // Check if user has a vault configured
  const checkVaultExists = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('vault_config')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      setHasVault(Boolean(data));
      if (data) {
        setSession(prev => ({ ...prev, salt: base64ToUint8Array((data as any).salt) }));
      }
    } catch (error) {
      console.error('Error checking vault existence:', error);
      toast({
        title: "Error",
        description: "Failed to check vault configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  // Initialize vault with master password
  const initializeVault = useCallback(async (masterPassword: string): Promise<boolean> => {
    if (!user) return false;
    
    // Validate password strength
    const validation = validateMasterPassword(masterPassword);
    if (!validation.isValid) {
      toast({
        title: "Weak Password",
        description: validation.errors.join('. '),
        variant: "destructive",
      });
      return false;
    }
    
    try {
      setLoading(true);
      
      // Generate salt and derive keys
      const salt = generateSalt();
      const wrappingCandidateKey = await deriveKey(masterPassword, salt, true); // extractable for wrapping only
      const masterKey = await deriveKey(masterPassword, salt, false); // non-extractable for use
      
      // Store vault configuration (only salt, never the password or key)
      const { error } = await supabase
        .from('vault_config')
        .insert({
          user_id: user.id,
          salt: uint8ArrayToBase64(salt),
        });
      
      if (error) throw error;
      
      // Update session
      const now = Date.now();
      const expiresAt = now + DEFAULT_INACTIVITY_TIMEOUT;
      const sessionId = generateSessionId();
      const serverSecret = generateServerSecret();
      
      const newSession = {
        isUnlocked: true,
        masterKey,
        salt,
        unlockedAt: now,
        expiresAt,
        sessionId,
      };
      
      setSession(newSession);
      setHasVault(true);
      
      // Store session persistently
      storeSessionLocally(newSession);
      await storeSessionInDB(sessionId, expiresAt, serverSecret);
      await persistWrappedMasterKey(wrappingCandidateKey, serverSecret);
      
      toast({
        title: "Vault Created",
        description: "Your secure vault has been created successfully.",
      });
      
      return true;
    } catch (error) {
      console.error('Error initializing vault:', error);
      toast({
        title: "Error",
        description: "Failed to create vault",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, toast, generateSessionId, storeSessionLocally, storeSessionInDB, generateServerSecret, persistWrappedMasterKey]);

  // Unlock vault with master password
  const unlockVault = useCallback(async (masterPassword: string, timeoutMinutes?: number): Promise<boolean> => {
    if (!user || !session.salt) return false;
    
    try {
      setLoading(true);
      
      // Derive keys from password and stored salt
      const wrappingCandidateKey = await deriveKey(masterPassword, session.salt, true); // extractable for wrapping only
      const masterKey = await deriveKey(masterPassword, session.salt, false); // non-extractable for use

      // Validate password by attempting to decrypt a sample item (if any)
      const isKeyValid = await validateRestoredKey(masterKey);
      if (!isKeyValid) {
        toast({
          title: "Invalid Password",
          description: "The master password you entered is incorrect.",
          variant: "destructive",
        });
        return false;
      }
      
      const timeoutDuration = timeoutMinutes ? timeoutMinutes * 60 * 1000 : DEFAULT_INACTIVITY_TIMEOUT;
      const now = Date.now();
      const expiresAt = now + timeoutDuration;
      const sessionId = generateSessionId();
      const serverSecret = generateServerSecret();
      
      const newSession = {
        isUnlocked: true,
        masterKey,
        salt: session.salt,
        unlockedAt: now,
        expiresAt,
        sessionId,
      };
      
      setSession(newSession);
      
      // Store session persistently
      storeSessionLocally(newSession);
      await storeSessionInDB(sessionId, expiresAt, serverSecret);
      await persistWrappedMasterKey(wrappingCandidateKey, serverSecret);
      
      // Clean up any expired sessions
      await cleanupExpiredSessions();
      
      const timeoutText = timeoutMinutes ? 
        (timeoutMinutes === 1 ? "1 minute" : `${timeoutMinutes} minutes`) : 
        "15 minutes";
      
      toast({
        title: "Vault Unlocked",
        description: `Welcome back to your secure vault. Will auto-lock in ${timeoutText}.`,
      });
      
      return true;
    } catch (error) {
      console.error('Error unlocking vault:', error);
      toast({
        title: "Unlock Failed",
        description: "Unable to unlock your vault. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, session.salt, toast, generateSessionId, storeSessionLocally, storeSessionInDB, cleanupExpiredSessions, generateServerSecret, persistWrappedMasterKey, validateRestoredKey]);

  // Change master password
  const changeMasterPassword = useCallback(async (
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> => {
    toast({
      title: "Not Supported Yet",
      description: "Changing the master password requires re-encrypting your vault and is temporarily disabled to prevent data loss.",
      variant: "destructive",
    });
    return false;
  }, [user, session.salt, session.isUnlocked, toast, getServerSecretFromDB, persistWrappedMasterKey, session.sessionId]);

  // Periodic session validity check
  useEffect(() => {
    if (session.isUnlocked) {
      // Check session validity every 30 seconds
      checkIntervalRef.current = setInterval(checkSessionValidity, 30000);
      
      return () => {
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
        }
      };
    }
  }, [session.isUnlocked, checkSessionValidity]);

  // Restore session on app start
  useEffect(() => {
    if (user && hasVault && session.salt && !session.isUnlocked) {
      restoreSession();
    }
  }, [user, hasVault, session.salt, session.isUnlocked, restoreSession]);

  // Initialize on mount
  useEffect(() => {
    if (user) {
      checkVaultExists();
    }
  }, [user, checkVaultExists]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  return {
    isUnlocked: session.isUnlocked,
    hasVault,
    loading,
    masterKey: session.masterKey,
    initializeVault,
    unlockVault,
    lockVault,
    changeMasterPassword,
    resetInactivityTimer,
    deriveMasterKey,
  } as UseVaultSessionReturn;
}

export function VaultSessionProvider({ children }: { children: React.ReactNode }) {
  const value = useVaultSessionInternal();
  return (
    <VaultSessionContext.Provider value={value}>
      {children}
    </VaultSessionContext.Provider>
  );
}

export function useVaultSession(): UseVaultSessionReturn {
  const ctx = useContext(VaultSessionContext);
  if (!ctx) {
    throw new Error('useVaultSession must be used within a VaultSessionProvider');
  }
  return ctx;
}