import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
      <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
        "fixed inset-0 z-50 bg-foreground/80 overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const childrenArray = React.Children.toArray(children) as React.ReactElement[];
  const headerChildren: React.ReactNode[] = [];
  const subheaderChildren: React.ReactNode[] = [];
  const footerChildren: React.ReactNode[] = [];
  const bodyChildren: React.ReactNode[] = [];

  childrenArray.forEach((child) => {
    const type: any = (child as any)?.type;
    const displayName = type?.displayName;
    if (type === DialogHeader || displayName === "DialogHeader") {
      headerChildren.push(child);
    } else if (type === DialogSubheader || displayName === "DialogSubheader") {
      subheaderChildren.push(child);
    } else if (type === DialogFooter || displayName === "DialogFooter") {
      footerChildren.push(child);
    } else {
      bodyChildren.push(child);
    }
  });

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // Base positioning & animation
          "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          // Height behavior; avoid nested scrollbars
          "xs:rounded-lg rounded-none xs:h-auto h-[100dvh] xs:max-h-[85vh] max-h-[100dvh] p-0",
          className
        )}
        {...props}
        aria-describedby={('aria-describedby' in (props as any) ? (props as any)['aria-describedby'] : undefined)}
      >
        <div className="flex max-h-[inherit] flex-col">
          {headerChildren}
          {subheaderChildren}
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
            {bodyChildren}
          </div>
          {footerChildren.length > 0 ? footerChildren : null}
        </div>
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // Fixed header area
      "sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b",
      // Consistent internal padding
      "px-6 py-4",
      // Content layout
      "flex flex-col gap-1 text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      // Fixed footer area
      "sticky bottom-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t",
      // Consistent internal padding
      "px-6 py-4",
      // Right-aligned actions
      "flex items-center justify-end gap-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

// Optional subheader row for extra info between header and content
const DialogSubheader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "mb-4 rounded-md bg-muted/50 px-6 py-2 text-sm text-muted-foreground",
      className
    )}
    {...props}
  />
)
DialogSubheader.displayName = "DialogSubheader"

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogSubheader,
}
