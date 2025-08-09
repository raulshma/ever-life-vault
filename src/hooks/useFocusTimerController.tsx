import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useFocusTimer } from '@/hooks/useFocusTimer';

interface FocusTimerContextValue {
  taskId: string | null;
  setTaskId: (id: string | null) => void;
  timer: ReturnType<typeof useFocusTimer>;
}

const FocusTimerContext = createContext<FocusTimerContextValue | null>(null);

export const FocusTimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [taskId, setTaskId] = useState<string | null>(null);
  const timer = useFocusTimer(taskId);

  const value = useMemo<FocusTimerContextValue>(() => ({ taskId, setTaskId, timer }), [taskId, timer]);
  return <FocusTimerContext.Provider value={value}>{children}</FocusTimerContext.Provider>;
};

export function useFocusTimerController() {
  const ctx = useContext(FocusTimerContext);
  if (!ctx) throw new Error('useFocusTimerController must be used within FocusTimerProvider');
  return ctx;
}


