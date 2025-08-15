import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useScreenSize, getResponsiveClass, RESPONSIVE_SPACING, RESPONSIVE_CONFIGS } from "../utils/responsive";

interface ResponsiveLayoutProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'container' | 'grid' | 'flex';
  gridConfig?: keyof typeof RESPONSIVE_CONFIGS;
  spacing?: keyof typeof RESPONSIVE_SPACING;
}

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  className,
  variant = 'container',
  gridConfig,
  spacing = 'container'
}) => {
  const { breakpoint } = useScreenSize();
  
  const baseClasses = variant === 'grid' ? 'grid' : 
                     variant === 'flex' ? 'flex flex-col' : 
                     'w-full';
  
  const spacingClass = getResponsiveClass(RESPONSIVE_SPACING[spacing], breakpoint);
  const gridClass = gridConfig ? getResponsiveClass(RESPONSIVE_CONFIGS[gridConfig], breakpoint) : '';
  
  return (
    <div className={cn(baseClasses, spacingClass, gridClass, className)}>
      {children}
    </div>
  );
};

interface ResponsiveCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: keyof typeof RESPONSIVE_SPACING;
}

export const ResponsiveCard: React.FC<ResponsiveCardProps> = ({
  children,
  className,
  padding = 'cardPadding'
}) => {
  const { breakpoint } = useScreenSize();
  const paddingClass = getResponsiveClass(RESPONSIVE_SPACING[padding], breakpoint);
  
  return (
    <div className={cn(
      "bg-card text-card-foreground rounded-lg border shadow-sm",
      paddingClass,
      className
    )}>
      {children}
    </div>
  );
};

interface ResponsiveGridProps {
  children: React.ReactNode;
  config: keyof typeof RESPONSIVE_CONFIGS;
  gap?: keyof typeof RESPONSIVE_SPACING;
  className?: string;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  config,
  gap = 'gap',
  className
}) => {
  const { breakpoint } = useScreenSize();
  const gridClass = getResponsiveClass(RESPONSIVE_CONFIGS[config], breakpoint);
  const gapClass = getResponsiveClass(RESPONSIVE_SPACING[gap], breakpoint);
  
  return (
    <div className={cn('grid', gridClass, gapClass, className)}>
      {children}
    </div>
  );
};

interface ResponsiveDialogProps {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

export const ResponsiveDialogContent: React.FC<ResponsiveDialogProps> = ({
  children,
  size = 'lg',
  className
}) => {
  const { breakpoint, width } = useScreenSize();
  
  // On mobile, dialogs should be full width with some margin
  const isMobile = useMemo(() => width < 768, [width]);
  const sizeClass = isMobile ? 'mx-4 w-[calc(100vw-2rem)]' : 
                   size === 'sm' ? 'max-w-sm' :
                   size === 'md' ? 'max-w-md' :
                   size === 'lg' ? 'max-w-lg' :
                   size === 'xl' ? 'max-w-4xl' :
                   'max-w-[95vw]';
  
  return (
    <div className={cn(sizeClass, className)}>
      {children}
    </div>
  );
};

// Mobile-optimized button group
interface ResponsiveButtonGroupProps {
  children: React.ReactNode;
  orientation?: 'horizontal' | 'vertical' | 'auto';
  className?: string;
}

export const ResponsiveButtonGroup: React.FC<ResponsiveButtonGroupProps> = ({
  children,
  orientation = 'auto',
  className
}) => {
  const { width } = useScreenSize();
  const isMobile = useMemo(() => width < 640, [width]);
  
  const actualOrientation = orientation === 'auto' ? 
    (isMobile ? 'vertical' : 'horizontal') : 
    orientation;
  
  const flexClass = actualOrientation === 'vertical' ? 'flex-col' : 'flex-row';
  const gapClass = actualOrientation === 'vertical' ? 'gap-2' : 'gap-2 sm:gap-4';
  
  return (
    <div className={cn('flex', flexClass, gapClass, className)}>
      {children}
    </div>
  );
};

// Responsive text sizing
interface ResponsiveTextProps {
  children: React.ReactNode;
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'caption';
  className?: string;
}

export const ResponsiveText: React.FC<ResponsiveTextProps> = ({
  children,
  variant = 'body',
  className
}) => {
  const textClasses = {
    h1: 'text-2xl sm:text-3xl lg:text-4xl font-bold',
    h2: 'text-xl sm:text-2xl lg:text-3xl font-semibold',
    h3: 'text-lg sm:text-xl lg:text-2xl font-medium',
    body: 'text-sm sm:text-base',
    caption: 'text-xs sm:text-sm text-muted-foreground'
  };
  
  const Component = variant.startsWith('h') ? variant as 'h1' | 'h2' | 'h3' : 'p';
  
  return (
    <Component className={cn(textClasses[variant], className)}>
      {children}
    </Component>
  );
};