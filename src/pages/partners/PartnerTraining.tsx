import React, { useMemo, useState } from 'react';
import { CheckCircle2, GraduationCap, Loader2, Lock, Play } from 'lucide-react';
import { PartnerVideo, partnerApi, youtubeId, youtubeThumb } from '@/services/partnerApi';
import { usePartnerSession } from './partnerSession';
import { PartnerEmptyState, PartnerPage, PortalCard } from './partnerShared';
import { PartnerTrainingSkeleton } from './PartnerLoading';
import { usePartnerTrainingVideos } from './usePartnerQueries';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  detailDialogBodyClass,
  detailDialogHeaderClass,
} from '@/components/ui/dialog';

function VideoPlayerDialog({ video, onClose }: { video: PartnerVideo; onClose: () => void }) {
  const id = youtubeId(video.youtube_url);
  const [loading, setLoading] = useState(true);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[96dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(96vw,960px)] rounded-[1rem] border-t-4 border-emerald-500 shadow-[0_24px_80px_rgba(0,0,0,0.25)]">
        <DialogHeader className={detailDialogHeaderClass}>
          <DialogTitle className="text-left text-lg sm:text-xl">{video.title}</DialogTitle>
        </DialogHeader>
        <DialogBody className={`${detailDialogBodyClass} space-y-4 pt-0`}>
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-lg">
            {loading ? (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950">
                <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
                <p className="text-sm font-semibold text-white/70">Loading video…</p>
              </div>
            ) : null}
            {id ? (
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                onLoad={() => setLoading(false)}
              />
            ) : (
              <div className="flex h-full min-h-[240px] items-center justify-center text-sm text-white/70">
                This video link is invalid.
              </div>
            )}
          </div>
          {video.description ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{video.description}</p>
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export default function PartnerTraining() {
  const { partner } = usePartnerSession();
  const { data: videos = [], isLoading } = usePartnerTrainingVideos();
  const [active, setActive] = useState<PartnerVideo | null>(null);
  const locked = partner.status !== 'approved';

  const watchedCount = useMemo(() => videos.filter((v) => v.watched).length, [videos]);
  const progressPct = videos.length ? Math.round((watchedCount / videos.length) * 100) : 0;
  const featured = videos[0] ?? null;
  const rest = videos.slice(1);

  const openVideo = (video: PartnerVideo) => {
    if (locked) return;
    setActive(video);
    if (!video.watched) {
      void partnerApi.post(`/partners/training-videos/${video.id}/watched`).catch(() => undefined);
    }
  };

  if (isLoading) {
    return <PartnerTrainingSkeleton />;
  }

  return (
    <PartnerPage>
      <div className="snp-training-hero relative overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-amber-50/80 p-5 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 sm:p-6">
        <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-emerald-400/15 blur-2xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
              <GraduationCap className="h-3.5 w-3.5" /> Partner Academy
            </p>
            <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">Training</h1>
            <p className="mt-1 max-w-md text-sm text-slate-600 dark:text-slate-400">
              Short, practical lessons to help you talk to schools with confidence.
            </p>
          </div>
          {videos.length > 0 && !locked && (
            <div className="rounded-2xl border border-emerald-100 bg-white/90 px-4 py-3 text-center dark:border-emerald-900/50 dark:bg-slate-900/80">
              <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{progressPct}%</p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {watchedCount}/{videos.length} complete
              </p>
            </div>
          )}
        </div>
        {videos.length > 0 && !locked && (
          <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-700"
              style={{ width: `${Math.max(progressPct, 4)}%` }}
            />
          </div>
        )}
      </div>

      {locked && (
        <PortalCard className="flex items-center gap-3 border-amber-200/80 !bg-amber-50/90 p-4 dark:!bg-amber-950/30 dark:border-amber-800/60">
          <Lock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Videos unlock after your application is approved — usually within 48 hours.
          </p>
        </PortalCard>
      )}

      {videos.length === 0 ? (
        <PartnerEmptyState
          icon={Play}
          title="Training videos coming soon"
          body="We're preparing practical guides to help you win schools in your region."
        />
      ) : (
        <div className="space-y-5">
          {featured && (
            <button
              type="button"
              onClick={() => openVideo(featured)}
              className="group relative w-full overflow-hidden rounded-2xl border border-emerald-200/80 bg-white text-left shadow-md transition hover:-translate-y-0.5 hover:shadow-xl dark:border-emerald-900/50 dark:bg-slate-900"
            >
              <div className="relative aspect-[16/9] w-full bg-emerald-950 sm:aspect-[21/9]">
                {youtubeThumb(featured.youtube_url) && (
                  <img
                    src={youtubeThumb(featured.youtube_url)!}
                    alt=""
                    className="h-full w-full object-cover opacity-90 transition group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                )}
                <div className={`absolute inset-0 ${locked ? 'bg-slate-950/60' : 'bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent'}`} />
                <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-6">
                  <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-emerald-500/90 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">
                    {featured.watched ? (
                      <><CheckCircle2 className="h-3 w-3" /> Completed</>
                    ) : (
                      'Start here'
                    )}
                  </span>
                  <p className="text-lg font-bold text-white sm:text-xl">{featured.title}</p>
                  {featured.description && (
                    <p className="mt-1 line-clamp-2 max-w-xl text-sm text-white/80">{featured.description}</p>
                  )}
                </div>
                {!locked && (
                  <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-xl transition group-hover:scale-110">
                    <Play className="ml-0.5 h-6 w-6 text-emerald-600" fill="currentColor" />
                  </span>
                )}
              </div>
            </button>
          )}

          {rest.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">More lessons</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((video, i) => {
                  const thumb = youtubeThumb(video.youtube_url);
                  return (
                    <button
                      key={video.id}
                      type="button"
                      onClick={() => openVideo(video)}
                      className="snp-fade-up overflow-hidden rounded-2xl border border-slate-200/80 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                      style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                    >
                      <div className="relative aspect-video w-full bg-emerald-50 dark:bg-slate-800">
                        {thumb && (
                          <img src={thumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                        )}
                        <div className={`absolute inset-0 flex items-center justify-center ${locked ? 'bg-slate-950/55' : 'bg-slate-950/15'}`}>
                          {locked ? (
                            <Lock className="h-5 w-5 text-white" />
                          ) : (
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-lg">
                              <Play className="ml-0.5 h-4 w-4 text-emerald-600" fill="currentColor" />
                            </span>
                          )}
                        </div>
                        <span
                          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                            video.watched ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                          }`}
                        >
                          {video.watched ? 'Done' : 'New'}
                        </span>
                      </div>
                      <div className="p-3.5">
                        <p className="line-clamp-2 text-[13.5px] font-bold leading-snug text-slate-900 dark:text-white">
                          {video.title}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {active && <VideoPlayerDialog video={active} onClose={() => setActive(null)} />}
    </PartnerPage>
  );
}
