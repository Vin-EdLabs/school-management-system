import { useToast } from "@/hooks/use-toast"
import { useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()
  const location = useLocation()
  const isParentPortal = /^\/portal(\/|$)/i.test(location.pathname)

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, className, ...props }) {
        return (
          <Toast
            key={id}
            {...props}
            className={cn(
              isParentPortal &&
                "rounded-2xl border-slate-200/90 bg-white/95 p-4 pr-10 shadow-[0_16px_40px_rgba(15,23,42,0.14)] backdrop-blur-md",
              className
            )}
          >
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport
        className={cn(
          isParentPortal
            ? "snp-parent-toast-viewport fixed left-3 right-3 flex max-h-[calc(100dvh-var(--snp-parent-chrome-h)-var(--snp-parent-banner-h)-2rem)] w-auto flex-col gap-2 p-0 sm:flex-col"
            : undefined
        )}
      />
    </ToastProvider>
  )
}
