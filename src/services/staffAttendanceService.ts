import { apiService } from './api';

export type AttendanceSettings = {
  id: number;
  tenant_id: number;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number;
  school_start_time: string;
  school_end_time: string;
  late_threshold_minutes: number;
};

export type StaffAttendanceRecord = {
  id: number;
  staff_id: number;
  date: string;
  check_in_time: string;
  check_out_time: string | null;
  is_late: boolean;
  late_reason: string | null;
  check_in_method: string;
  checkout_method: string | null;
  staff_name?: string;
  staff_role?: string;
};

export type TodayStaffRow = {
  staff_id: number;
  name: string;
  role: string;
  check_in_time: string | null;
  check_out_time: string | null;
  is_late: boolean;
  late_reason: string | null;
  check_in_method: string | null;
  status: 'present' | 'absent' | 'checked_out' | 'weekend';
};

export type TodayOverview = {
  summary: {
    total: number;
    present: number;
    absent: number;
    checked_out: number;
    late: number;
    weekend?: number;
    is_weekend?: boolean;
  };
  staff: TodayStaffRow[];
  is_weekend?: boolean;
};

export type PaginatedAttendance = {
  items: StaffAttendanceRecord[];
  total: number;
  page: number;
  limit: number;
};

export type MyTodayResponse = {
  record: StaffAttendanceRecord | null;
  is_weekend?: boolean;
  settings: {
    school_start_time?: string;
    school_end_time?: string;
    late_threshold_minutes?: number;
    radius_meters?: number;
    configured: boolean;
  };
};

export class StaffAttendanceApiError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(message: string, status: number, body: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function postWithBody<T>(path: string, body: unknown): Promise<T> {
  try {
    return await apiService.post<T>(path, body);
  } catch (err: unknown) {
    const anyErr = err as { message?: string; status?: number; data?: Record<string, unknown>; response?: { status?: number; data?: Record<string, unknown> } };
    const status = anyErr?.status || anyErr?.response?.status || 400;
    const data = anyErr?.data || anyErr?.response?.data || {};
    const message =
      (typeof data === 'object' && data && 'error' in data && String((data as { error?: string }).error)) ||
      anyErr?.message ||
      'Request failed';
    throw new StaffAttendanceApiError(message, status, (data as Record<string, unknown>) || { error: message });
  }
}

export const staffAttendanceService = {
  getSettings(): Promise<AttendanceSettings | null> {
    return apiService.get('/staff-attendance/settings');
  },

  saveSettings(payload: {
    latitude: number;
    longitude: number;
    radius_meters: number;
    school_start_time: string;
    school_end_time: string;
    late_threshold_minutes: number;
  }): Promise<AttendanceSettings> {
    return apiService.post('/staff-attendance/settings', payload);
  },

  getMyToday(): Promise<MyTodayResponse> {
    return apiService.get('/staff-attendance/my-today');
  },

  checkIn(latitude: number, longitude: number, late_reason?: string) {
    return postWithBody<StaffAttendanceRecord>('/staff-attendance/check-in', {
      latitude,
      longitude,
      late_reason,
    });
  },

  checkOut() {
    return postWithBody<StaffAttendanceRecord>('/staff-attendance/check-out', {});
  },

  adminCheckIn(staff_id: number, check_in_time: string, late_reason?: string) {
    return postWithBody<StaffAttendanceRecord>('/staff-attendance/admin-check-in', {
      staff_id,
      check_in_time,
      late_reason,
    });
  },

  getToday(role?: string): Promise<TodayOverview> {
    const q = role && role !== 'all' ? `?role=${encodeURIComponent(role)}` : '';
    return apiService.get(`/staff-attendance/today${q}`);
  },

  getHistory(params: {
    staff_id?: number;
    date_from?: string;
    date_to?: string;
    is_late?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedAttendance> {
    const sp = new URLSearchParams();
    if (params.staff_id != null) sp.set('staff_id', String(params.staff_id));
    if (params.date_from) sp.set('date_from', params.date_from);
    if (params.date_to) sp.set('date_to', params.date_to);
    if (params.is_late) sp.set('is_late', params.is_late);
    if (params.page) sp.set('page', String(params.page));
    if (params.limit) sp.set('limit', String(params.limit));
    const q = sp.toString();
    return apiService.get(`/staff-attendance/history${q ? `?${q}` : ''}`);
  },

  getMyHistory(params: {
    date_from?: string;
    date_to?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedAttendance> {
    const sp = new URLSearchParams();
    if (params.date_from) sp.set('date_from', params.date_from);
    if (params.date_to) sp.set('date_to', params.date_to);
    if (params.page) sp.set('page', String(params.page));
    if (params.limit) sp.set('limit', String(params.limit));
    const q = sp.toString();
    return apiService.get(`/staff-attendance/my-history${q ? `?${q}` : ''}`);
  },
};

export function formatAttendanceTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatAttendanceDate(isoOrDate: string | null | undefined): string {
  if (!isoOrDate) return '—';
  const raw = String(isoOrDate).slice(0, 10);
  const d = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDuration(checkIn: string | null, checkOut: string | null, live = false): string {
  if (!checkIn) return '—';
  const start = new Date(checkIn).getTime();
  const end = checkOut ? new Date(checkOut).getTime() : live ? Date.now() : start;
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '—';
  const totalSec = Math.floor((end - start) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (live) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported on this device.'));
      return;
    }

    const fail = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        reject(new Error('Location permission is required to clock in. Enable location access and try again.'));
      } else {
        reject(new Error('Could not get your location. Please try again.'));
      }
    };

    // Fast path: recent / network location first (usually <1–2s)
    navigator.geolocation.getCurrentPosition(resolve, () => {
      // Fallback: higher accuracy if the quick read fails
      navigator.geolocation.getCurrentPosition(resolve, fail, {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      });
    }, { enableHighAccuracy: false, timeout: 6000, maximumAge: 15000 });
  });
}
