import React, { createContext, useContext, useState, useEffect } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsContextType {
  viewTransitionsEnabled: boolean;
  setViewTransitionsEnabled: (enabled: boolean) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
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

  const setViewTransitionsEnabled = (enabled: boolean) => {
    setViewTransitionsEnabledState(enabled);
    localStorage.setItem('viewTransitionsEnabled', JSON.stringify(enabled));
  };

  const applyThemePreference = (mode: ThemeMode) => {
    try {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = mode === 'dark' || (mode === 'system' && prefersDark);
      const root = document.documentElement;
      if (isDark) {
        root.classList.add('dark');
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
    <SettingsContext.Provider value={{ viewTransitionsEnabled, setViewTransitionsEnabled, themeMode, setThemeMode }}>
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