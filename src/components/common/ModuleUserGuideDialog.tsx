import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { getModuleUserGuide } from '@/content/moduleUserGuides';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, MessageCircle, Sparkles, X } from 'lucide-react';

type ModuleUserGuideDialogProps = {
  activeModule: string;
  setActiveModule: (id: string) => void;
};

export function ModuleUserGuideDialog({ activeModule, setActiveModule }: ModuleUserGuideDialogProps) {
  const [open, setOpen] = useState(false);
  const { hasAccess } = useAuth();
  const guide = useMemo(() => getModuleUserGuide(activeModule), [activeModule]);
  const canSupport = hasAccess('support-chat');
  const onSupport = () => {
    setOpen(false);
    setActiveModule('support-chat');
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden h-9 shrink-0 gap-1.5 border-indigo-200/80 bg-white px-2.5 text-xs font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-indigo-950/50 sm:flex sm:px-3"
        title="How to use this page"
      >
        <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="hidden md:inline">User guide</span>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        className="h-10 w-10 shrink-0 rounded-xl border-indigo-200/80 bg-white text-indigo-700 shadow-sm hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-indigo-950/50 sm:hidden"
        title="User guide"
      >
        <BookOpen className="h-5 w-5" aria-hidden />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(90dvh,720px)] w-[calc(100vw-1.5rem)] max-w-lg gap-0 overflow-hidden border-border/80 p-0 sm:max-w-lg [&>button]:hidden">
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-indigo-800 px-5 pb-8 pt-6 text-white">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-20 left-0 h-40 w-40 rounded-full bg-indigo-300/20 blur-2xl" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-9 w-9 text-white/90 hover:bg-white/10 hover:text-white"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Button>
            <div className="flex items-start gap-3 pr-10">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm">
                <Sparkles className="h-6 w-6 text-amber-200" aria-hidden />
              </div>
              <DialogHeader className="space-y-1.5 text-left">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-100/90">User guide</p>
                <DialogTitle className="text-xl font-semibold tracking-tight text-white sm:text-2xl">{guide.title}</DialogTitle>
                <p className="text-sm font-medium leading-snug text-indigo-100">{guide.tagline}</p>
              </DialogHeader>
            </div>
          </div>

          <ScrollArea className="max-h-[min(58dvh,420px)] sm:max-h-[min(50dvh,380px)]">
            <div className="space-y-5 px-5 py-5">
              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">What this page does</h3>
                <p className="mt-2 text-sm leading-relaxed text-foreground/95">{guide.purpose}</p>
              </section>

              <Separator />

              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">How to use it</h3>
                <ol className="mt-3 list-decimal space-y-2.5 pl-4 text-sm leading-relaxed marker:font-semibold marker:text-indigo-600 dark:marker:text-indigo-400">
                  {guide.steps.map((s, i) => (
                    <li key={i} className="pl-1">
                      {s}
                    </li>
                  ))}
                </ol>
              </section>

              {guide.tips && guide.tips.length > 0 && (
                <>
                  <Separator />
                  <section className="rounded-xl border border-amber-200/60 bg-amber-50/80 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/25">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-amber-900/80 dark:text-amber-200/90">Tips</h3>
                    <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-amber-950/90 dark:text-amber-50/90">
                      {guide.tips.map((t, i) => (
                        <li key={i}>{t}</li>
                      ))}
                    </ul>
                  </section>
                </>
              )}
            </div>
          </ScrollArea>

          <div className="border-t border-border/80 bg-muted/30 px-5 py-4">
            <p className="text-center text-xs font-medium text-muted-foreground">
              Need more help?{' '}
              <span className="text-foreground">Scholarve</span> can assist through Support Chat.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
              {canSupport && activeModule !== 'support-chat' && (
                <Button
                  type="button"
                  className="gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md hover:from-indigo-700 hover:to-violet-700"
                  onClick={onSupport}
                >
                  <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                  Open Support Chat
                </Button>
              )}
              {activeModule === 'support-chat' && (
                <p className="text-center text-xs text-muted-foreground">
                  You are already in Support Chat—describe your issue below and the Scholarve team will respond.
                </p>
              )}
              {!canSupport && activeModule !== 'support-chat' && (
                <p className="text-center text-xs text-muted-foreground">
                  Support Chat is not enabled for your account. Ask a school administrator to grant access if you need Scholarve
                  assistance.
                </p>
              )}
              <Button type="button" variant="outline" className="sm:min-w-[120px]" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
