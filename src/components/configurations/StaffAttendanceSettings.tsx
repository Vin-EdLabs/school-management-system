import React, { useCallback, useEffect, useState } from 'react';
import { MapPin, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import {
  getCurrentPosition,
  staffAttendanceService,
  type AttendanceSettings,
} from '@/services/staffAttendanceService';

const StaffAttendanceSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [form, setForm] = useState({
    latitude: '',
    longitude: '',
    radius_meters: '100',
    school_start_time: '07:30',
    school_end_time: '15:30',
    late_threshold_minutes: '15',
  });

  const applySettings = useCallback((s: AttendanceSettings | null) => {
    if (!s) return;
    setForm({
      latitude: s.latitude != null ? String(s.latitude) : '',
      longitude: s.longitude != null ? String(s.longitude) : '',
      radius_meters: String(s.radius_meters ?? 100),
      school_start_time: (s.school_start_time || '07:30').slice(0, 5),
      school_end_time: (s.school_end_time || '15:30').slice(0, 5),
      late_threshold_minutes: String(s.late_threshold_minutes ?? 15),
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const s = await staffAttendanceService.getSettings();
        if (!cancelled) applySettings(s);
      } catch {
        if (!cancelled) {
          toast({
            title: 'Could not load attendance settings',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySettings]);

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      setForm((f) => ({
        ...f,
        latitude: pos.coords.latitude.toFixed(8),
        longitude: pos.coords.longitude.toFixed(8),
      }));
      toast({ title: 'Location captured', description: 'Coordinates filled from your device.' });
    } catch (err: unknown) {
      toast({
        title: 'Location unavailable',
        description: err instanceof Error ? err.message : 'Could not get location',
        variant: 'destructive',
      });
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    const lat = parseFloat(form.latitude);
    const lon = parseFloat(form.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      toast({
        title: 'Coordinates required',
        description: 'Enter school latitude and longitude, or use your current location.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const saved = await staffAttendanceService.saveSettings({
        latitude: lat,
        longitude: lon,
        radius_meters: parseInt(form.radius_meters, 10) || 100,
        school_start_time: form.school_start_time,
        school_end_time: form.school_end_time,
        late_threshold_minutes: parseInt(form.late_threshold_minutes, 10) || 15,
      });
      applySettings(saved);
      toast({ title: 'Attendance settings saved' });
    } catch (err: unknown) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Could not save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-slate-500 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading attendance settings…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Attendance Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure school zone, start/end times, and late threshold for staff clock-in.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">School hours</CardTitle>
          <CardDescription>Used for late detection. Auto check-out runs daily at 6:00 PM. A push reminder is sent 1 hour after start time if someone has not clocked in.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="school_start_time">School start time</Label>
            <Input
              id="school_start_time"
              type="time"
              value={form.school_start_time}
              onChange={(e) => setForm((f) => ({ ...f, school_start_time: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="school_end_time">School end time</Label>
            <Input
              id="school_end_time"
              type="time"
              value={form.school_end_time}
              onChange={(e) => setForm((f) => ({ ...f, school_end_time: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="late_threshold_minutes">Late threshold (minutes)</Label>
            <Input
              id="late_threshold_minutes"
              type="number"
              min={0}
              max={240}
              value={form.late_threshold_minutes}
              onChange={(e) => setForm((f) => ({ ...f, late_threshold_minutes: e.target.value }))}
            />
            <p className="text-xs text-slate-500">Minutes after start time before a check-in is marked late.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">School zone (GPS)</CardTitle>
          <CardDescription>Staff must be inside this radius to clock in.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                inputMode="decimal"
                value={form.latitude}
                onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                placeholder="e.g. 5.60370000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                inputMode="decimal"
                value={form.longitude}
                onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                placeholder="e.g. -0.18700000"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2 w-40">
              <Label htmlFor="radius_meters">Radius (meters)</Label>
              <Input
                id="radius_meters"
                type="number"
                min={10}
                max={5000}
                value={form.radius_meters}
                onChange={(e) => setForm((f) => ({ ...f, radius_meters: e.target.value }))}
              />
            </div>
            <Button type="button" variant="outline" onClick={useMyLocation} disabled={locating}>
              {locating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MapPin className="h-4 w-4 mr-2" />}
              Use my current location
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save settings
        </Button>
      </div>
    </div>
  );
};

export default StaffAttendanceSettings;
