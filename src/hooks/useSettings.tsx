import React, { createContext, useContext, useState, useEffect } from 'react';
import { getConfigValue, setConfigValue, batchConfigOperations } from '@/integrations/supabase/configStore'
import { useAuth } from '@/hooks/useAuth'
import { createSystemSettingsService, SystemSettingsService } from '@/services/systemSettingsService'
import { supabase } from '@/integrations/supabase/client'
import { ReceiptAIConfig, DEFAULT_RECEIPT_AI_CONFIG, FocusTimerConfig, DEFAULT_FOCUS_TIMER_CONFIG, DashboardConfig, DEFAULT_DASHBOARD_CONFIG, NotificationConfig, DEFAULT_NOTIFICATION_CONFIG, UIConfig, DEFAULT_UI_CONFIG, IntegrationConfig, DEFAULT_INTEGRATION_CONFIG, SecurityConfig, DEFAULT_SECURITY_CONFIG } from '@/types/systemSettings'

type ThemeMode = 'light' | 'dark' | 'amoled' | 'system';

type SidebarOrder = Record<string, string[]>; // group title -> array of path strings

interface SettingsContextType {
  viewTransitionsEnabled: boolean;
  setViewTransitionsEnabled: (enabled: boolean) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  // Navigation customization
  sidebarOrder: SidebarOrder;
  setSidebarOrder: (order: SidebarOrder) => void;
  resetSidebarOrder: () => void;
  // Sidebar behavior
  autoCategorizeSidebar: boolean;
  setAutoCategorizeSidebar: (enabled: boolean) => void;
  // System settings
  systemSettingsService: SystemSettingsService | null;
  // Receipt AI settings
  receiptAIConfig: ReceiptAIConfig;
  setReceiptAIConfig: (config: Partial<ReceiptAIConfig>) => Promise<boolean>;
  refreshReceiptAIConfig: () => Promise<void>;
  // Focus Timer settings
  focusTimerConfig: FocusTimerConfig;
  setFocusTimerConfig: (config: Partial<FocusTimerConfig>) => Promise<boolean>;
  refreshFocusTimerConfig: () => Promise<void>;
  // Dashboard settings
  dashboardConfig: DashboardConfig;
  setDashboardConfig: (config: Partial<DashboardConfig>) => Promise<boolean>;
  refreshDashboardConfig: () => Promise<void>;
  // Notification settings
  notificationConfig: NotificationConfig;
  setNotificationConfig: (config: Partial<NotificationConfig>) => Promise<boolean>;
  refreshNotificationConfig: () => Promise<void>;
  // UI settings
  uiConfig: UIConfig;
  setUIConfig: (config: Partial<UIConfig>) => Promise<boolean>;
  refreshUIConfig: () => Promise<void>;
  // Integration settings
  integrationConfig: IntegrationConfig;
  setIntegrationConfig: (config: Partial<IntegrationConfig>) => Promise<boolean>;
  refreshIntegrationConfig: () => Promise<void>;
  // Security settings
  securityConfig: SecurityConfig;
  setSecurityConfig: (config: Partial<SecurityConfig>) => Promise<boolean>;
  refreshSecurityConfig: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [systemSettingsService, setSystemSettingsService] = useState<SystemSettingsService | null>(null);
  const [receiptAIConfig, setReceiptAIConfigState] = useState<ReceiptAIConfig>(DEFAULT_RECEIPT_AI_CONFIG);
  const [focusTimerConfig, setFocusTimerConfigState] = useState<FocusTimerConfig>(DEFAULT_FOCUS_TIMER_CONFIG);
  const [dashboardConfig, setDashboardConfigState] = useState<DashboardConfig>(DEFAULT_DASHBOARD_CONFIG);
  const [notificationConfig, setNotificationConfigState] = useState<NotificationConfig>(DEFAULT_NOTIFICATION_CONFIG);
  const [uiConfig, setUIConfigState] = useState<UIConfig>(DEFAULT_UI_CONFIG);
  const [integrationConfig, setIntegrationConfigState] = useState<IntegrationConfig>(DEFAULT_INTEGRATION_CONFIG);
  const [securityConfig, setSecurityConfigState] = useState<SecurityConfig>(DEFAULT_SECURITY_CONFIG);

  const [viewTransitionsEnabled, setViewTransitionsEnabledState] = useState<boolean>(() => {
    const stored = localStorage.getItem('viewTransitionsEnabled');
    return stored !== null ? JSON.parse(stored) : true;
  });

  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem('themeMode') as ThemeMode | null;
    return stored ?? 'system';
  });

  const [sidebarOrder, setSidebarOrderState] = useState<SidebarOrder>(() => {
    try {
      const raw = localStorage.getItem('sidebarOrder');
      if (!raw) return {};
      
      const parsed = JSON.parse(raw) as SidebarOrder;
      
      // Migration: convert old category names to new ones
      const migrated: SidebarOrder = {};
      if (parsed.daily) migrated.productivity = parsed.daily;
      if (parsed.share) migrated.media = parsed.share;
      if (parsed.homelab) migrated.infrastructure = parsed.homelab;
      if (parsed.account) migrated.account = parsed.account;
      
      // Save migrated data back to localStorage
      if (Object.keys(migrated).length > 0) {
        localStorage.setItem('sidebarOrder', JSON.stringify(migrated));
      }
      
      return migrated;
    } catch {
      return {};
    }
  });

  const [autoCategorizeSidebar, setAutoCategorizeSidebarState] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('autoCategorizeSidebar');
      return raw ? JSON.parse(raw) === true : false;
    } catch {
      return false;
    }
  });

  // Cleanup: remove previously stored default page preference if present
  useEffect(() => {
    try {
      localStorage.removeItem('defaultPagePath');
    } catch {}
  }, []);


  const setViewTransitionsEnabled = (enabled: boolean) => {
    setViewTransitionsEnabledState(enabled);
    // Mirror locally for quick client-side reads
    try { localStorage.setItem('viewTransitionsEnabled', JSON.stringify(enabled)); } catch {}
    void setConfigValue('settings', 'viewTransitionsEnabled', enabled);
  };

  const applyThemePreference = (mode: ThemeMode) => {
    try {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const root = document.documentElement;

      // Always clear AMOLED flag first
      root.classList.remove('amoled');

      const isDarkMode = mode === 'amoled' || mode === 'dark' || (mode === 'system' && prefersDark);

      if (isDarkMode) {
        root.classList.add('dark');
        if (mode === 'amoled') {
          root.classList.add('amoled');
        }
      } else {
        root.classList.remove('dark');
      }
    } catch {
      // no-op (window/document not available)
    }
  };

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    try { localStorage.setItem('themeMode', mode); } catch {}
    void setConfigValue('settings', 'themeMode', mode);
  };

  const setSidebarOrder = (order: SidebarOrder) => {
    setSidebarOrderState(order);
    try {
      localStorage.setItem('sidebarOrder', JSON.stringify(order));
    } catch {}
  };

  const resetSidebarOrder = () => {
    setSidebarOrderState({});
    try {
      localStorage.removeItem('sidebarOrder');
    } catch {}
  };

  const setAutoCategorizeSidebar = (enabled: boolean) => {
    setAutoCategorizeSidebarState(enabled);
    try { localStorage.setItem('autoCategorizeSidebar', JSON.stringify(enabled)); } catch {}
    void setConfigValue('settings', 'autoCategorizeSidebar', enabled);
  };


  // Persist view transition preference
  useEffect(() => {
    try { localStorage.setItem('viewTransitionsEnabled', JSON.stringify(viewTransitionsEnabled)); } catch {}
  }, [viewTransitionsEnabled]);

  // Initialize system settings service when user is available
  useEffect(() => {
    if (user && supabase) {
      const service = createSystemSettingsService(supabase);
      setSystemSettingsService(service);
    } else {
      setSystemSettingsService(null);
    }
  }, [user]);

  // Load receipt AI config from system settings
  const refreshReceiptAIConfig = async () => {
    if (!systemSettingsService) return;
    
    try {
      const config = await systemSettingsService.getReceiptAIConfig();
      setReceiptAIConfigState(config);
    } catch (error) {
      console.error('Failed to load receipt AI config:', error);
    }
  };

  // Set receipt AI config
  const setReceiptAIConfig = async (config: Partial<ReceiptAIConfig>): Promise<boolean> => {
    if (!systemSettingsService) return false;
    
    try {
      const result = await systemSettingsService.setReceiptAIConfig(config);
      if (result.success) {
        await refreshReceiptAIConfig();
        return true;
      } else {
        console.error('Failed to update receipt AI config:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error updating receipt AI config:', error);
      return false;
    }
  };

  // Load receipt AI config when service is available
  useEffect(() => {
    if (systemSettingsService) {
      refreshReceiptAIConfig();
      refreshFocusTimerConfig();
      refreshDashboardConfig();
      refreshNotificationConfig();
      refreshUIConfig();
      refreshIntegrationConfig();
      refreshSecurityConfig();
    }
  }, [systemSettingsService]);

  // Helper functions for all configuration types
  const refreshFocusTimerConfig = async () => {
    if (!systemSettingsService) return;
    try {
      const config = await systemSettingsService.getFocusTimerConfig();
      setFocusTimerConfigState(config);
    } catch (error) {
      console.error('Failed to load focus timer config:', error);
    }
  };

  const setFocusTimerConfig = async (config: Partial<FocusTimerConfig>): Promise<boolean> => {
    if (!systemSettingsService) return false;
    try {
      const result = await systemSettingsService.setFocusTimerConfig(config);
      if (result.success) {
        await refreshFocusTimerConfig();
        return true;
      } else {
        console.error('Failed to update focus timer config:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error updating focus timer config:', error);
      return false;
    }
  };

  const refreshDashboardConfig = async () => {
    if (!systemSettingsService) return;
    try {
      const config = await systemSettingsService.getDashboardConfig();
      setDashboardConfigState(config);
    } catch (error) {
      console.error('Failed to load dashboard config:', error);
    }
  };

  const setDashboardConfig = async (config: Partial<DashboardConfig>): Promise<boolean> => {
    if (!systemSettingsService) return false;
    try {
      const result = await systemSettingsService.setDashboardConfig(config);
      if (result.success) {
        await refreshDashboardConfig();
        return true;
      } else {
        console.error('Failed to update dashboard config:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error updating dashboard config:', error);
      return false;
    }
  };

  const refreshNotificationConfig = async () => {
    if (!systemSettingsService) return;
    try {
      const config = await systemSettingsService.getNotificationConfig();
      setNotificationConfigState(config);
    } catch (error) {
      console.error('Failed to load notification config:', error);
    }
  };

  const setNotificationConfig = async (config: Partial<NotificationConfig>): Promise<boolean> => {
    if (!systemSettingsService) return false;
    try {
      const result = await systemSettingsService.setNotificationConfig(config);
      if (result.success) {
        await refreshNotificationConfig();
        return true;
      } else {
        console.error('Failed to update notification config:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error updating notification config:', error);
      return false;
    }
  };

  const refreshUIConfig = async () => {
    if (!systemSettingsService) return;
    try {
      const config = await systemSettingsService.getUIConfig();
      setUIConfigState(config);
    } catch (error) {
      console.error('Failed to load UI config:', error);
    }
  };

  const setUIConfig = async (config: Partial<UIConfig>): Promise<boolean> => {
    if (!systemSettingsService) return false;
    try {
      const result = await systemSettingsService.setUIConfig(config);
      if (result.success) {
        await refreshUIConfig();
        return true;
      } else {
        console.error('Failed to update UI config:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error updating UI config:', error);
      return false;
    }
  };

  const refreshIntegrationConfig = async () => {
    if (!systemSettingsService) return;
    try {
      const config = await systemSettingsService.getIntegrationConfig();
      setIntegrationConfigState(config);
    } catch (error) {
      console.error('Failed to load integration config:', error);
    }
  };

  const setIntegrationConfig = async (config: Partial<IntegrationConfig>): Promise<boolean> => {
    if (!systemSettingsService) return false;
    try {
      const result = await systemSettingsService.setIntegrationConfig(config);
      if (result.success) {
        await refreshIntegrationConfig();
        return true;
      } else {
        console.error('Failed to update integration config:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error updating integration config:', error);
      return false;
    }
  };

  const refreshSecurityConfig = async () => {
    if (!systemSettingsService) return;
    try {
      const config = await systemSettingsService.getSecurityConfig();
      setSecurityConfigState(config);
    } catch (error) {
      console.error('Failed to load security config:', error);
    }
  };

  const setSecurityConfig = async (config: Partial<SecurityConfig>): Promise<boolean> => {
    if (!systemSettingsService) return false;
    try {
      const result = await systemSettingsService.setSecurityConfig(config);
      if (result.success) {
        await refreshSecurityConfig();
        return true;
      } else {
        console.error('Failed to update security config:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error updating security config:', error);
      return false;
    }
  };

  // Load settings from DB on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const results = await batchConfigOperations([
          { namespace: 'settings', key: 'themeMode' },
          { namespace: 'settings', key: 'viewTransitionsEnabled' },
          { namespace: 'settings', key: 'autoCategorizeSidebar' }
        ]);
        
        const dbTheme = results.gets.find(r => r.key === 'themeMode')?.value
        const dbTransitions = results.gets.find(r => r.key === 'viewTransitionsEnabled')?.value
        const dbAutoCategorize = results.gets.find(r => r.key === 'autoCategorizeSidebar')?.value
        if (!mounted) return;
        const allowedModes: ThemeMode[] = ['light', 'dark', 'amoled', 'system']
        if (dbTheme && typeof dbTheme === 'string' && (allowedModes as string[]).includes(dbTheme)) {
          setThemeModeState(dbTheme as ThemeMode);
          // Mirror for theme-init on next loads
          try { localStorage.setItem('themeMode', dbTheme as string); } catch {}
        }
        if (typeof dbTransitions === 'boolean') {
          setViewTransitionsEnabledState(dbTransitions);
          try { localStorage.setItem('viewTransitionsEnabled', JSON.stringify(dbTransitions)); } catch {}
        }
        if (typeof dbAutoCategorize === 'boolean') {
          setAutoCategorizeSidebarState(dbAutoCategorize);
          try { localStorage.setItem('autoCategorizeSidebar', JSON.stringify(dbAutoCategorize)); } catch {}
        }
      } catch {}
    })();
    return () => { mounted = false };
  }, []);

  // Apply theme immediately on mount and when theme changes
  useEffect(() => {
    applyThemePreference(themeMode);

    // If following system, react to OS changes
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (themeMode === 'system') {
        applyThemePreference('system');
      }
    };

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    } else {
      // Safari
      media.addListener(onChange);
      return () => media.removeListener(onChange);
    }
  }, [themeMode]);

  return (
    <SettingsContext.Provider value={{
      viewTransitionsEnabled,
      setViewTransitionsEnabled,
      themeMode,
      setThemeMode,
      sidebarOrder,
      setSidebarOrder,
      resetSidebarOrder,
      autoCategorizeSidebar,
      setAutoCategorizeSidebar,
      systemSettingsService,
      receiptAIConfig,
      setReceiptAIConfig,
      refreshReceiptAIConfig,
      focusTimerConfig,
      setFocusTimerConfig,
      refreshFocusTimerConfig,
      dashboardConfig,
      setDashboardConfig,
      refreshDashboardConfig,
      notificationConfig,
      setNotificationConfig,
      refreshNotificationConfig,
      uiConfig,
      setUIConfig,
      refreshUIConfig,
      integrationConfig,
      setIntegrationConfig,
      refreshIntegrationConfig,
      securityConfig,
      setSecurityConfig,
      refreshSecurityConfig,
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};