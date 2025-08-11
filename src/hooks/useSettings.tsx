import React, { createContext, useContext, useState, useEffect } from 'react';

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
  const [viewTransitionsEnabled, setViewTransitionsEnabledState] = useState(() => {
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
    localStorage.setItem('viewTransitionsEnabled', JSON.stringify(enabled));
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
    localStorage.setItem('themeMode', mode);
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
    localStorage.setItem('viewTransitionsEnabled', JSON.stringify(viewTransitionsEnabled));
  }, [viewTransitionsEnabled]);

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