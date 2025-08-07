import React, { createContext, useContext, useState, useEffect } from 'react';

interface SettingsContextType {
  viewTransitionsEnabled: boolean;
  setViewTransitionsEnabled: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [viewTransitionsEnabled, setViewTransitionsEnabledState] = useState(() => {
    const stored = localStorage.getItem('viewTransitionsEnabled');
    return stored !== null ? JSON.parse(stored) : true;
  });

  const setViewTransitionsEnabled = (enabled: boolean) => {
    setViewTransitionsEnabledState(enabled);
    localStorage.setItem('viewTransitionsEnabled', JSON.stringify(enabled));
  };

  useEffect(() => {
    localStorage.setItem('viewTransitionsEnabled', JSON.stringify(viewTransitionsEnabled));
  }, [viewTransitionsEnabled]);

  return (
    <SettingsContext.Provider value={{ viewTransitionsEnabled, setViewTransitionsEnabled }}>
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