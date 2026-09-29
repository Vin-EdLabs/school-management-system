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
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
  hideTriggers?: boolean;
};

export function ModuleUserGuideDialog({
  activeModule,
  setActiveModule,
  externalOpen,
  onExternalOpenChange,
  hideTriggers = false,
}: ModuleUserGuideDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = onExternalOpenChange ?? setInternalOpen;
  const { hasAccess } = useAuth();
  const guide = useMemo(() => getModuleUserGuide(activeModule), [activeModule]);
  const canSupport = hasAccess('support-chat');
  const onSupport = () => {
    setOpen(false);
    setActiveModule('support-chat');
  };

  return (
    <>
      {!hideTriggers && (
      <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="hidden h-9 shrink-0 gap-1.5 rounded-xl border-indigo-200/80 bg-white px-2.5 text-xs font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-indigo-950/50 sm:flex xl:px-3"
        title="User guide"
      >
        <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden xl:inline">User guide</span>
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
      </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[min(90dvh,720px)] w-[calc(100vw-1.5rem)] max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg [&>button]:hidden">
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-slate-950 px-5 pb-8 pt-6 text-white">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-20 left-0 h-40 w-40 rounded-full bg-emerald-200/20 blur-2xl" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-10 w-10 rounded-2xl border border-white/20 bg-white/10 text-white/95 shadow-lg transition hover:bg-white/20 hover:text-white"
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
                <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">What this page does</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-900 dark:text-slate-200">{guide.purpose}</p>
              </section>

              <Separator />

              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">How to use it</h3>
                <ol className="mt-3 space-y-3 pl-5 text-sm leading-relaxed text-slate-900 dark:text-slate-200 marker:font-semibold marker:text-emerald-700 dark:marker:text-emerald-300">
                  {guide.steps.map((s, i) => (
                    <li key={i} className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-3 text-slate-900 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-950/20 dark:text-slate-100">
                      {s}
                    </li>
                  ))}
                </ol>
              </section>

              {guide.tips && guide.tips.length > 0 && (
                <>
                  <Separator />
                  <section className="rounded-3xl border border-emerald-200/70 bg-emerald-50/90 px-5 py-4 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-950/20">
                    <div className="mb-3 flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 shadow-inner dark:bg-emerald-500/20 dark:text-emerald-100">
                        <Sparkles className="h-4 w-4" aria-hidden />
                      </span>
                      <h3 className="text-sm font-bold uppercase tracking-wide">Tips</h3>
                    </div>
                    <ul className="space-y-3 text-sm leading-relaxed text-slate-900 dark:text-slate-100">
                      {guide.tips.map((t, i) => (
                        <li key={i} className="rounded-2xl border border-emerald-200/70 bg-white/90 p-3 shadow-sm dark:border-emerald-500/20 dark:bg-emerald-950/40">
                          {t}
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              )}
            </div>
          </ScrollArea>

          <div className="border-t border-emerald-100/80 bg-emerald-50/80 px-5 py-4 dark:border-emerald-500/20 dark:bg-emerald-950/10">
            <p className="text-center text-xs font-medium text-slate-700 dark:text-slate-300">
              Need more help?{' '}
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">ScholarNerve</span> can assist through Support Chat.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
              {canSupport && activeModule !== 'support-chat' && (
                <Button
                  type="button"
                  className="gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-700 hover:to-emerald-800"
                  onClick={onSupport}
                >
                  <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                  Open Support Chat
                </Button>
              )}
              {activeModule === 'support-chat' && (
                <p className="text-center text-xs text-muted-foreground">
                  You are already in Support Chat—describe your issue below and the ScholarNerve team will respond.
                </p>
              )}
              {!canSupport && activeModule !== 'support-chat' && (
                <p className="text-center text-xs text-slate-600 dark:text-slate-400">
                  Support Chat is not enabled for your account. Ask a school administrator to grant access if you need ScholarNerve
                  assistance.
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                className="sm:min-w-[120px] border-emerald-200/80 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-500/30 dark:text-emerald-200 dark:hover:bg-emerald-700/20"
                onClick={() => setOpen(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
