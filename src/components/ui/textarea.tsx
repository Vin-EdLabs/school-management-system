import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[96px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm shadow-slate-950/[0.02] ring-offset-background transition-all placeholder:text-slate-400 focus-visible:border-emerald-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/10 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 dark:min-h-[80px] dark:rounded-md dark:border-input dark:bg-background dark:text-foreground dark:shadow-none dark:placeholder:text-muted-foreground dark:focus-visible:ring-2 dark:focus-visible:ring-ring dark:focus-visible:ring-offset-2",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
