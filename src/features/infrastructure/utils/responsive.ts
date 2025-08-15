import { useEffect, useState, useCallback } from "react";

// Breakpoint definitions matching Tailwind CSS defaults
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

// Hook to get current screen size
export const useScreenSize = () => {
  const [screenSize, setScreenSize] = useState<{
    width: number;
    height: number;
    breakpoint: Breakpoint | 'xs';
  }>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
    breakpoint: 'lg'
  });

  const updateScreenSize = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    let breakpoint: Breakpoint | 'xs' = 'xs';
    if (width >= BREAKPOINTS['2xl']) breakpoint = '2xl';
    else if (width >= BREAKPOINTS.xl) breakpoint = 'xl';
    else if (width >= BREAKPOINTS.lg) breakpoint = 'lg';
    else if (width >= BREAKPOINTS.md) breakpoint = 'md';
    else if (width >= BREAKPOINTS.sm) breakpoint = 'sm';
    
    setScreenSize({ width, height, breakpoint });
  }, []);

  useEffect(() => {
    updateScreenSize();
    window.addEventListener('resize', updateScreenSize);
    return () => window.removeEventListener('resize', updateScreenSize);
  }, [updateScreenSize]);

  return screenSize;
};

// Hook to check if screen is at or above a breakpoint
export const useMediaQuery = (breakpoint: Breakpoint) => {
  const { width } = useScreenSize();
  return width >= BREAKPOINTS[breakpoint];
};

// Responsive grid configurations for different components
export const RESPONSIVE_CONFIGS = {
  // Configuration cards grid
  configurationGrid: {
    xs: 'grid-cols-1',
    sm: 'grid-cols-1',
    md: 'grid-cols-2',
    lg: 'grid-cols-2',
    xl: 'grid-cols-3',
    '2xl': 'grid-cols-4'
  },
  
  // Stack status cards
  stackGrid: {
    xs: 'grid-cols-1',
    sm: 'grid-cols-2',
    md: 'grid-cols-2',
    lg: 'grid-cols-3',
    xl: 'grid-cols-4',
    '2xl': 'grid-cols-5'
  },
  
  // Monitoring dashboard
  monitoringGrid: {
    xs: 'grid-cols-1',
    sm: 'grid-cols-1',
    md: 'grid-cols-2',
    lg: 'grid-cols-3',
    xl: 'grid-cols-4',
    '2xl': 'grid-cols-4'
  },
  
  // Form layouts
  formColumns: {
    xs: 'grid-cols-1',
    sm: 'grid-cols-1',
    md: 'grid-cols-2',
    lg: 'grid-cols-2',
    xl: 'grid-cols-3',
    '2xl': 'grid-cols-3'
  }
} as const;

// Get responsive class for current breakpoint
export const getResponsiveClass = (
  config: Record<Breakpoint | 'xs', string>,
  currentBreakpoint: Breakpoint | 'xs'
): string => {
  return config[currentBreakpoint] || config.xs;
};

// Mobile-first responsive utilities
export const MOBILE_BREAKPOINT = BREAKPOINTS.md;

export const isMobile = (width: number): boolean => width < MOBILE_BREAKPOINT;
export const isTablet = (width: number): boolean => width >= MOBILE_BREAKPOINT && width < BREAKPOINTS.lg;
export const isDesktop = (width: number): boolean => width >= BREAKPOINTS.lg;

// Responsive spacing and sizing utilities
export const RESPONSIVE_SPACING = {
  container: {
    xs: 'px-4 py-4',
    sm: 'px-4 py-4',
    md: 'px-6 py-6',
    lg: 'px-8 py-6',
    xl: 'px-8 py-8',
    '2xl': 'px-12 py-8'
  },
  
  cardPadding: {
    xs: 'p-4',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-6',
    xl: 'p-6',
    '2xl': 'p-8'
  },
  
  gap: {
    xs: 'gap-4',
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-6',
    xl: 'gap-8',
    '2xl': 'gap-8'
  }
} as const;

// Component-specific responsive configurations
export const COMPONENT_RESPONSIVE = {
  // Tab navigation
  tabs: {
    mobile: {
      orientation: 'horizontal' as const,
      variant: 'scrollable' as const,
      showLabels: false
    },
    desktop: {
      orientation: 'horizontal' as const,
      variant: 'default' as const,
      showLabels: true
    }
  },
  
  // Dialog sizes
  dialog: {
    xs: 'max-w-sm',
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl'
  },
  
  // Button sizes for different screens
  button: {
    mobile: 'sm' as const,
    desktop: 'default' as const
  }
} as const;