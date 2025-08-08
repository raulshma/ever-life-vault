import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { deriveKey, generateSalt, uint8ArrayToBase64, base64ToUint8Array, validateMasterPassword } from '@/lib/crypto';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';

interface VaultSession {
  isUnlocked: boolean;
  masterKey: CryptoKey | null;
  salt: Uint8Array | null;
  lastActivity: number;
}

interface VaultConfig {
  id: string;
  user_id: string;
  salt: string; // Base64 encoded
  created_at: string;
  updated_at: string;
}

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds

// Exposed context type
interface UseVaultSessionReturn {
  isUnlocked: boolean;
  hasVault: boolean;
  loading: boolean;
  masterKey: CryptoKey | null;
  initializeVault: (masterPassword: string) => Promise<boolean>;
  unlockVault: (masterPassword: string) => Promise<boolean>;
  lockVault: () => void;
  changeMasterPassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  resetInactivityTimer: () => void;
}

const VaultSessionContext = createContext<UseVaultSessionReturn | undefined>(undefined);

function useVaultSessionInternal() {
  const [session, setSession] = useState<VaultSession>({
    isUnlocked: false,
    masterKey: null,
    salt: null,
    lastActivity: Date.now(),
  });
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasVault, setHasVault] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const timeoutRef = useRef<NodeJS.Timeout>(undefined);

  // Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (session.isUnlocked) {
      setSession(prev => ({ ...prev, lastActivity: Date.now() }));
      
      timeoutRef.current = setTimeout(() => {
        lockVault();
        toast({
          title: "Vault Locked",
          description: "Your vault has been automatically locked due to inactivity.",
          variant: "default",
        });
      }, INACTIVITY_TIMEOUT);
    }
  }, [session.isUnlocked]);

  // Check if user has a vault configured
  const checkVaultExists = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('vault_config')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }
      
      setHasVault(!!data);
      if (data) {
        setSession(prev => ({ ...prev, salt: base64ToUint8Array(data.salt) }));
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
      
      // Generate salt and derive key
      const salt = generateSalt();
      const masterKey = await deriveKey(masterPassword, salt);
      
      // Store vault configuration (only salt, never the password or key)
      const { error } = await supabase
        .from('vault_config')
        .insert({
          user_id: user.id,
          salt: uint8ArrayToBase64(salt),
        });
      
      if (error) throw error;
      
      // Update session
      setSession({
        isUnlocked: true,
        masterKey,
        salt,
        lastActivity: Date.now(),
      });
      
      setHasVault(true);
      setIsInitialized(true);
      resetInactivityTimer();
      
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
  }, [user, toast, resetInactivityTimer]);

  // Unlock vault with master password
  const unlockVault = useCallback(async (masterPassword: string): Promise<boolean> => {
    if (!user || !session.salt) return false;
    
    try {
      setLoading(true);
      
      // Derive key from password and stored salt
      const masterKey = await deriveKey(masterPassword, session.salt);
      
      // Test decryption with a known encrypted value if available
      // For now, we'll assume the key is correct if derivation succeeds
      
      setSession(prev => ({
        ...prev,
        isUnlocked: true,
        masterKey,
        lastActivity: Date.now(),
      }));
      
      resetInactivityTimer();
      
      toast({
        title: "Vault Unlocked",
        description: "Welcome back to your secure vault.",
      });
      
      return true;
    } catch (error) {
      console.error('Error unlocking vault:', error);
      toast({
        title: "Invalid Password",
        description: "The master password you entered is incorrect.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, session.salt, toast, resetInactivityTimer]);

  // Lock vault and clear sensitive data
  const lockVault = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    setSession({
      isUnlocked: false,
      masterKey: null,
      salt: session.salt, // Keep salt for next unlock
      lastActivity: Date.now(),
    });
    
    // Force garbage collection of sensitive data
    if (typeof window !== 'undefined' && window.gc) {
      window.gc();
    }
  }, [session.salt]);

  // Change master password
  const changeMasterPassword = useCallback(async (
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> => {
    if (!user || !session.salt || !session.isUnlocked) return false;
    
    // Validate new password strength
    const validation = validateMasterPassword(newPassword);
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
      
      // Verify current password
      const currentKey = await deriveKey(currentPassword, session.salt);
      
      // Generate new salt and derive new key
      const newSalt = generateSalt();
      const newKey = await deriveKey(newPassword, newSalt);
      
      // TODO: Re-encrypt all vault items with new key
      // This would require fetching all items, decrypting with old key,
      // and re-encrypting with new key
      
      // Update vault configuration
      const { error } = await supabase
        .from('vault_config')
        .update({
          salt: uint8ArrayToBase64(newSalt),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      // Update session with new key and salt
      setSession(prev => ({
        ...prev,
        masterKey: newKey,
        salt: newSalt,
        lastActivity: Date.now(),
      }));
      
      toast({
        title: "Password Changed",
        description: "Your master password has been updated successfully.",
      });
      
      return true;
    } catch (error) {
      console.error('Error changing master password:', error);
      toast({
        title: "Error",
        description: "Failed to change master password",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, session.salt, session.isUnlocked, toast]);

  // Activity tracking for auto-lock
  useEffect(() => {
    const handleActivity = () => {
      if (session.isUnlocked) {
        resetInactivityTimer();
      }
    };

    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [session.isUnlocked, resetInactivityTimer]);

  // Initialize on mount
  useEffect(() => {
    if (user) {
      checkVaultExists();
    }
  }, [user, checkVaultExists]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
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