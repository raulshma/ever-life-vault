import { useEffect, useCallback } from "react";

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
  category: string;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

export const useKeyboardShortcuts = ({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;
    
    // Don't trigger shortcuts when user is typing in inputs
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      return;
    }

    // Don't trigger shortcuts when the focused element is inside an xterm terminal
    // or inside an element explicitly marked as a terminal (data-terminal).
    // This allows the embedded terminal to receive raw keystrokes.
    try {
      if (target && typeof target.closest === 'function') {
        const insideXterm = target.closest('.xterm') !== null;
        const insideMarkedTerminal = target.closest('[data-terminal]') !== null;
        if (insideXterm || insideMarkedTerminal) {
          return;
        }
      }
    } catch (err) {
      // defensive: if closest is unavailable or throws, fall back to default behavior
    }

    const matchingShortcut = shortcuts.find(shortcut => {
      const keyMatches = shortcut.key.toLowerCase() === event.key.toLowerCase();
      const ctrlMatches = !!shortcut.ctrlKey === event.ctrlKey;
      const metaMatches = !!shortcut.metaKey === event.metaKey;
      const shiftMatches = !!shortcut.shiftKey === event.shiftKey;
      const altMatches = !!shortcut.altKey === event.altKey;
      
      return keyMatches && ctrlMatches && metaMatches && shiftMatches && altMatches;
    });

    if (matchingShortcut) {
      event.preventDefault();
      event.stopPropagation();
      matchingShortcut.action();
    }
  }, [shortcuts, enabled]);

  useEffect(() => {
    if (!enabled) return;
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);

  return { shortcuts };
};

// Common infrastructure keyboard shortcuts
export const createInfrastructureShortcuts = (actions: {
  onNewConfiguration?: () => void;
  onSaveConfiguration?: () => void;
  onValidateConfiguration?: () => void;
  onDeployStack?: () => void;
  onStopStack?: () => void;
  onRefreshStacks?: () => void;
  onToggleHelp?: () => void;
  onOpenSecrets?: () => void;
  onOpenMonitoring?: () => void;
}): KeyboardShortcut[] => {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');
  const modifierKey = isMac ? 'metaKey' : 'ctrlKey';
  const modifierSymbol = isMac ? '⌘' : 'Ctrl';

  return [
    // Configuration shortcuts
    ...(actions.onNewConfiguration ? [{
      key: 'n',
      [modifierKey]: true,
      action: actions.onNewConfiguration,
      description: `${modifierSymbol}+N - Create new configuration`,
      category: 'Configuration'
    }] : []),
    
    ...(actions.onSaveConfiguration ? [{
      key: 's',
      [modifierKey]: true,
      action: actions.onSaveConfiguration,
      description: `${modifierSymbol}+S - Save configuration`,
      category: 'Configuration'
    }] : []),
    
    ...(actions.onValidateConfiguration ? [{
      key: 't',
      [modifierKey]: true,
      action: actions.onValidateConfiguration,
      description: `${modifierSymbol}+T - Validate configuration`,
      category: 'Configuration'
    }] : []),

    // Stack management shortcuts
    ...(actions.onDeployStack ? [{
      key: 'd',
      [modifierKey]: true,
      shiftKey: true,
      action: actions.onDeployStack,
      description: `${modifierSymbol}+Shift+D - Deploy stack`,
      category: 'Stack Management'
    }] : []),
    
    ...(actions.onStopStack ? [{
      key: 's',
      [modifierKey]: true,
      shiftKey: true,
      action: actions.onStopStack,
      description: `${modifierSymbol}+Shift+S - Stop stack`,
      category: 'Stack Management'
    }] : []),
    
    ...(actions.onRefreshStacks ? [{
      key: 'r',
      [modifierKey]: true,
      action: actions.onRefreshStacks,
      description: `${modifierSymbol}+R - Refresh stacks`,
      category: 'Stack Management'
    }] : []),

    // Navigation shortcuts
    ...(actions.onOpenSecrets ? [{
      key: '1',
      altKey: true,
      action: actions.onOpenSecrets,
      description: 'Alt+1 - Open secrets tab',
      category: 'Navigation'
    }] : []),
    
    ...(actions.onOpenMonitoring ? [{
      key: '2',
      altKey: true,
      action: actions.onOpenMonitoring,
      description: 'Alt+2 - Open monitoring tab',
      category: 'Navigation'
    }] : []),

    // Help shortcuts
    ...(actions.onToggleHelp ? [{
      key: '?',
      shiftKey: true,
      action: actions.onToggleHelp,
      description: 'Shift+? - Toggle help',
      category: 'Help'
    }] : []),
  ];
};

// Hook for displaying keyboard shortcuts help
export const useShortcutsHelp = (shortcuts: KeyboardShortcut[]) => {
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  return { groupedShortcuts };
};