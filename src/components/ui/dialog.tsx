import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

/** Scrollable viewport with safe padding; centers short panels, scrolls tall ones. */
const ModalViewport = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => (
  <div
    className={cn(
      "fixed inset-0 z-50 overflow-y-auto p-4 pointer-events-none",
      className
    )}
  >
    <div className="flex min-h-full w-full justify-center">
      {children}
    </div>
  </div>
)

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <ModalViewport>
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "modal pointer-events-auto relative z-50 my-auto mx-auto flex w-full max-w-lg max-h-[calc(100dvh-2rem)] flex-col gap-4 overflow-y-auto overscroll-contain rounded-[1.5rem] border border-emerald-200/70 bg-white/95 p-0 shadow-[0_28px_120px_rgba(15,118,110,0.24)] duration-300 ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-[1.75rem] dark:border-emerald-500/20 dark:bg-slate-950/95",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </ModalViewport>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogBody = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    onWheel={e => {
      const target = e.currentTarget;
      if (target.scrollHeight > target.clientHeight) {
        target.scrollTop += e.deltaY;
        e.preventDefault();
      }
    }}
    className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1", className)}
    {...props}
  />
))
DialogBody.displayName = "DialogBody"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
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

/** Shared shell for read-only detail / summary dialogs */
export const detailDialogContentClass =
  "flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl rounded-[1rem] border-t-4 border-emerald-500 shadow-[0_20px_60px_rgba(0,0,0,0.15)]"

export const detailDialogContentWideClass =
  "flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl rounded-[1rem] border-t-4 border-emerald-500 shadow-[0_20px_60px_rgba(0,0,0,0.15)]"

export const detailDialogHeaderClass =
  "shrink-0 space-y-1 border-b border-border/70 px-6 py-4 pr-12 text-left"

export const detailDialogBodyClass =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4"

export const detailDialogFooterClass =
  "form-action-bar shrink-0 gap-2 border-t border-border/70 px-6 py-4"

/** Shared emerald-accent shell for form / action modals */
export const formDialogContentClass =
  "flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg rounded-[1rem] border-t-4 border-emerald-500 shadow-[0_20px_60px_rgba(15,118,110,0.18)]"

export const formDialogContentWideClass =
  "flex max-h-[min(92dvh,900px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl rounded-[1rem] border-t-4 border-emerald-500 shadow-[0_20px_60px_rgba(15,118,110,0.18)]"

export const formDialogContentXWideClass =
  "flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl rounded-[1rem] border-t-4 border-emerald-500 shadow-[0_20px_60px_rgba(15,118,110,0.18)]"

export const dialogTitleClass =
  "font-outfit text-xl font-black text-emerald-900 dark:text-emerald-100 sm:text-2xl"

export const dialogLabelClass =
  "text-[10px] font-bold uppercase tracking-widest text-emerald-800/75 dark:text-emerald-300/80"

export const dialogSectionClass =
  "rounded-2xl border border-emerald-100/80 bg-emerald-50/40 p-5 space-y-4 dark:border-emerald-900/40 dark:bg-emerald-950/20"

export function DetailField({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800/75 dark:text-emerald-300/80">
        {label}
      </p>
      <div className="mt-1 break-words text-sm font-medium leading-relaxed text-foreground">
        {children}
      </div>
    </div>
  )
}

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  ModalViewport,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
