import React, { createContext, useContext, useState, useEffect } from 'react';
import { getConfigValue, setConfigValue } from '@/integrations/supabase/configStore';

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
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
      return raw ? (JSON.parse(raw) as SidebarOrder) : {};
    } catch {
      return {};
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


  // Persist view transition preference
  useEffect(() => {
    try { localStorage.setItem('viewTransitionsEnabled', JSON.stringify(viewTransitionsEnabled)); } catch {}
  }, [viewTransitionsEnabled]);

  // Load settings from DB on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [dbTheme, dbTransitions] = await Promise.all([
          getConfigValue<ThemeMode>('settings', 'themeMode'),
          getConfigValue<boolean>('settings', 'viewTransitionsEnabled'),
        ]);
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