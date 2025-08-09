import React from "react";
import { cn } from "@/lib/utils";

type LucideIcon = React.ComponentType<{ className?: string; size?: number }>;

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  breadcrumb?: React.ReactNode;
  /** Right side content: actions, stats, etc. */
  children?: React.ReactNode;
  /** Optional content rendered near the title on the left (e.g., small meta). */
  meta?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  icon: Icon,
  breadcrumb,
  children,
  meta,
  className,
}) => {
  return (
    <div
      className={cn(
        "w-full border-b border-border/60 bg-background/70 supports-[backdrop-filter]:bg-background/50 backdrop-blur",
        className
      )}
    >
      <div className="container py-3 sm:py-4">
        {breadcrumb && <div className="mb-1">{breadcrumb}</div>}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {Icon && (
                <div className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
              )}
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight truncate">{title}</h1>
              {meta && <div className="ml-2 shrink-0">{meta}</div>}
            </div>
            {description && (
              <p className="mt-0.5 text-muted-foreground text-sm line-clamp-1 pr-2">{description}</p>
            )}
          </div>

          {children && (
            <div className="flex items-center gap-2 shrink-0">{children}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PageHeader;


