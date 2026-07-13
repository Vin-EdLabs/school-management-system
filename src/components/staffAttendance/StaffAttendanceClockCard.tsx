import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, LogIn, LogOut, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  formDialogContentClass,
  detailDialogContentClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
  detailDialogFooterClass,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import {
  formatAttendanceTime,
  formatDuration,
  getCurrentPosition,
  staffAttendanceService,
  type StaffAttendanceRecord,
} from '@/services/staffAttendanceService';
import OutsideZoneMapModal, { type OutsideZoneMapData } from './OutsideZoneMapModal';

type Props = {
  onOpenHistory?: () => void;
  /** Compact card for admin/finance side columns (matches Attendance / Birthdays cards). */
  variant?: 'default' | 'sidebar';
};

type SuccessKind = 'in' | 'out';

function isOutsideZoneError(body: Record<string, unknown>): boolean {
  return body.error === 'outside_zone' || body.outsideZone === true;
}

const StaffAttendanceClockCard: React.FC<Props> = ({ onOpenHistory, variant = 'default' }) => {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [record, setRecord] = useState<StaffAttendanceRecord | null>(null);
  const [configured, setConfigured] = useState(true);
  const [tick, setTick] = useState(0);
  const [lateOpen, setLateOpen] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [zoneMap, setZoneMap] = useState<OutsideZoneMapData | null>(null);
  const [lateReason, setLateReason] = useState('');
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successKind, setSuccessKind] = useState<SuccessKind>('in');
  const [successRecord, setSuccessRecord] = useState<StaffAttendanceRecord | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await staffAttendanceService.getMyToday();
      setRecord(data.record);
      setConfigured(!!data.settings?.configured);
    } catch {
      /* keep previous */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!record?.check_in_time || record.check_out_time) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [record?.check_in_time, record?.check_out_time]);

  const showSuccess = (kind: SuccessKind, saved: StaffAttendanceRecord) => {
    setSuccessKind(kind);
    setSuccessRecord(saved);
    setSuccessOpen(true);
    if (kind === 'in') {
      toast({
        title: 'Clock-in successful',
        description: saved.is_late
          ? `Late check-in recorded at ${formatAttendanceTime(saved.check_in_time)}`
          : `You're checked in at ${formatAttendanceTime(saved.check_in_time)}`,
      });
    } else {
      toast({
        title: 'Clock-out successful',
        description: `You're checked out at ${formatAttendanceTime(saved.check_out_time)}. Total ${formatDuration(saved.check_in_time, saved.check_out_time)}.`,
      });
    }
  };

  const submitCheckIn = async (lat: number, lon: number, reason?: string) => {
    setBusy(true);
    try {
      const saved = await staffAttendanceService.checkIn(lat, lon, reason);
      setRecord(saved);
      setLateOpen(false);
      setZoneOpen(false);
      setZoneMap(null);
      setLateReason('');
      setPendingCoords(null);
      showSuccess('in', saved);
    } catch (err: unknown) {
      const body =
        (err as { body?: Record<string, unknown>; data?: Record<string, unknown> })?.body ||
        (err as { data?: Record<string, unknown> })?.data ||
        {};
      if (body.requiresReason) {
        setPendingCoords({ lat, lon });
        setLateOpen(true);
        return;
      }
      if (isOutsideZoneError(body)) {
        const school = (body.school || {}) as {
          latitude?: number;
          longitude?: number;
          radius_meters?: number;
        };
        if (
          Number.isFinite(school.latitude) &&
          Number.isFinite(school.longitude) &&
          Number.isFinite(school.radius_meters)
        ) {
          setZoneMap({
            teacherLat: lat,
            teacherLng: lon,
            schoolLat: Number(school.latitude),
            schoolLng: Number(school.longitude),
            radiusMeters: Number(school.radius_meters),
            distanceMeters:
              typeof body.distance_meters === 'number' ? body.distance_meters : undefined,
          });
          setZoneOpen(true);
          return;
        }
        toast({
          title: 'Outside school zone',
          description:
            typeof body.message === 'string'
              ? body.message
              : 'You are not within the school zone. Move closer and try again.',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Check-in failed',
        description: err instanceof Error ? err.message : 'Could not check in',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleClockIn = async () => {
    if (!configured) {
      toast({
        title: 'Not configured',
        description: 'Ask an administrator to set Attendance Settings first.',
        variant: 'destructive',
      });
      return;
    }
    setBusy(true);
    try {
      const pos = await getCurrentPosition();
      await submitCheckIn(pos.coords.latitude, pos.coords.longitude);
    } catch (err: unknown) {
      toast({
        title: 'Location required',
        description: err instanceof Error ? err.message : 'Could not get location',
        variant: 'destructive',
      });
      setBusy(false);
    }
  };

  const confirmLate = async () => {
    if (!pendingCoords) return;
    const reason = lateReason.trim();
    if (!reason) {
      toast({ title: 'Late reason required', variant: 'destructive' });
      return;
    }
    await submitCheckIn(pendingCoords.lat, pendingCoords.lon, reason);
  };

  const handleClockOut = async () => {
    setBusy(true);
    const prev = record;
    if (prev) {
      setRecord({
        ...prev,
        check_out_time: new Date().toISOString(),
        checkout_method: 'self',
      });
    }
    try {
      const saved = await staffAttendanceService.checkOut();
      setRecord(saved);
      showSuccess('out', saved);
    } catch (err: unknown) {
      if (prev) setRecord(prev);
      toast({
        title: 'Check-out failed',
        description: err instanceof Error ? err.message : 'Could not check out',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  void tick;

  const checkedOut = !!(record?.check_in_time && record?.check_out_time);
  const checkedIn = !!(record?.check_in_time && !record?.check_out_time);

  const dialogs = (
    <>
      <OutsideZoneMapModal
        open={zoneOpen}
        onOpenChange={(open) => {
          setZoneOpen(open);
          if (!open) setZoneMap(null);
        }}
        data={zoneMap}
        busy={busy}
        onTryAgain={() => {
          void handleClockIn();
        }}
      />

      <Dialog open={lateOpen} onOpenChange={setLateOpen}>
        <DialogContent className={formDialogContentClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />
              </span>
              Late check-in
            </DialogTitle>
            <DialogDescription>
              You are past the late threshold. Please provide a reason to continue.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className={`${detailDialogBodyClass} space-y-2`}>
            <Label htmlFor={`late_reason_${variant}`}>Late reason</Label>
            <Textarea
              id={`late_reason_${variant}`}
              value={lateReason}
              onChange={(e) => setLateReason(e.target.value)}
              placeholder="Why are you late?"
              rows={3}
              className="rounded-xl"
            />
          </DialogBody>
          <DialogFooter className={`${detailDialogFooterClass} gap-2`}>
            <Button variant="outline" className="rounded-xl" onClick={() => setLateOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button className="rounded-xl" onClick={confirmLate} disabled={busy || !lateReason.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit check-in
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className={detailDialogContentClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  successKind === 'in'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                <CheckCircle2 className="h-5 w-5" />
              </span>
              {successKind === 'in' ? 'Clock-in successful' : 'Clock-out successful'}
            </DialogTitle>
            <DialogDescription>
              {successKind === 'in'
                ? successRecord?.is_late
                  ? 'Your late check-in has been recorded.'
                  : 'You are checked in for today. Have a great day!'
                : 'You are checked out for today. See you next time!'}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className={`${detailDialogBodyClass} space-y-3`}>
            {successRecord && successKind === 'in' && (
              <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm space-y-1">
                <p>
                  Time:{' '}
                  <strong className="tabular-nums">{formatAttendanceTime(successRecord.check_in_time)}</strong>
                </p>
                <p>
                  Status:{' '}
                  {successRecord.is_late ? (
                    <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">
                      Late
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-emerald-400 text-emerald-700 bg-emerald-50">
                      On time
                    </Badge>
                  )}
                </p>
              </div>
            )}

            {successRecord && successKind === 'out' && (
              <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm space-y-1">
                <p>
                  Out at:{' '}
                  <strong className="tabular-nums">{formatAttendanceTime(successRecord.check_out_time)}</strong>
                </p>
                <p>
                  Total:{' '}
                  <strong>
                    {formatDuration(successRecord.check_in_time, successRecord.check_out_time)}
                  </strong>
                </p>
              </div>
            )}
          </DialogBody>

          <DialogFooter className={`${detailDialogFooterClass} sm:justify-end`}>
            <Button className="rounded-xl min-w-[120px]" onClick={() => setSuccessOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (loading) {
    if (variant === 'sidebar') {
      return (
        <Card className="rounded-2xl shadow-sm border-border">
          <CardContent className="p-5 text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading clock…
          </CardContent>
        </Card>
      );
    }
    return (
      <Card className="overflow-hidden border-emerald-200/60 dark:border-emerald-900/40">
        <CardContent className="p-5 text-slate-500 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading clock…
        </CardContent>
      </Card>
    );
  }

  if (variant === 'sidebar') {
    return (
      <>
        <Card className="rounded-2xl shadow-sm border-border border-l-4 border-l-emerald-600 dark:border-l-emerald-500">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-emerald-600" />
                Staff Clock
              </p>
              {onOpenHistory && (
                <button
                  type="button"
                  onClick={onOpenHistory}
                  className="text-[11px] font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                >
                  History
                </button>
              )}
            </div>

            {!record && (
              <>
                <p className="text-sm text-muted-foreground">Not clocked in today</p>
                <Button
                  size="sm"
                  onClick={handleClockIn}
                  disabled={busy}
                  className="w-full h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
                  Clock In
                </Button>
              </>
            )}

            {checkedIn && record && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-bold tabular-nums text-foreground">
                    {formatAttendanceTime(record.check_in_time)}
                  </p>
                  {record.is_late && (
                    <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50 text-[10px]">
                      Late
                    </Badge>
                  )}
                </div>
                <p className="font-mono text-sm text-emerald-700 dark:text-emerald-300">
                  {formatDuration(record.check_in_time, null, true)}
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleClockOut}
                  disabled={busy}
                  className="w-full h-9 rounded-lg"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
                  Clock Out
                </Button>
              </>
            )}

            {checkedOut && record && (
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  In <strong className="text-foreground">{formatAttendanceTime(record.check_in_time)}</strong>
                  {' · '}
                  Out <strong className="text-foreground">{formatAttendanceTime(record.check_out_time)}</strong>
                </p>
                <p className="text-xs">Total {formatDuration(record.check_in_time, record.check_out_time)}</p>
              </div>
            )}
          </CardContent>
        </Card>
        {dialogs}
      </>
    );
  }

  return (
    <>
      <Card className="overflow-hidden border-emerald-200/70 dark:border-emerald-900/50 shadow-sm bg-gradient-to-br from-white via-emerald-50/40 to-teal-50/30 dark:from-slate-950 dark:via-emerald-950/20 dark:to-slate-950">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/25">
                  <Clock className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">Staff Clock</h3>
                  <p className="text-xs text-slate-500">Clock in within the school zone</p>
                </div>
              </div>

              {!record && (
                <p className="text-sm text-slate-600 dark:text-slate-300 pt-1">You have not clocked in today.</p>
              )}

              {checkedIn && record && (
                <div className="pt-2 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-slate-600 dark:text-slate-300">
                      In at <strong>{formatAttendanceTime(record.check_in_time)}</strong>
                    </span>
                    {record.is_late && (
                      <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">
                        Late
                      </Badge>
                    )}
                  </div>
                  {record.is_late && record.late_reason && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 flex gap-1.5 items-start">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      {record.late_reason}
                    </p>
                  )}
                  <div className="font-mono text-2xl tracking-wider text-emerald-800 dark:text-emerald-200">
                    {formatDuration(record.check_in_time, null, true)}
                  </div>
                </div>
              )}

              {checkedOut && record && (
                <div className="pt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>In: <strong>{formatAttendanceTime(record.check_in_time)}</strong></span>
                    <span>Out: <strong>{formatAttendanceTime(record.check_out_time)}</strong></span>
                    <span>Total: <strong>{formatDuration(record.check_in_time, record.check_out_time)}</strong></span>
                  </div>
                  {record.is_late && (
                    <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">
                      Late{record.late_reason ? ` — ${record.late_reason}` : ''}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {onOpenHistory && (
                <Button variant="ghost" size="sm" onClick={onOpenHistory}>
                  History
                </Button>
              )}
              {!record && (
                <Button
                  onClick={handleClockIn}
                  disabled={busy}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
                  Clock In
                </Button>
              )}
              {checkedIn && (
                <Button onClick={handleClockOut} disabled={busy} variant="secondary" className="min-w-[120px]">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
                  Clock Out
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      {dialogs}
    </>
  );
};

export default StaffAttendanceClockCard;
