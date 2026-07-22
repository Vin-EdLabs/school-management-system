import type { ClassSlot, ClassTimetableGrid, Period, TimetableDay } from '@/services/timetableApi';
import { formatTimeRangeCompact, TIMETABLE_DAYS } from './timetableUtils';

export function resolveTimetableMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  const base = (import.meta.env.VITE_API_URL as string | undefined) || window.location.origin;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${String(base).replace(/\/$/, '')}${path}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildTimetablePrintDocument(options: {
  grid: ClassTimetableGrid;
  schoolName: string;
  schoolLogoUrl?: string | null;
  className: string;
  termLabel: string;
  yearLabel?: string;
}): string {
  const { grid, schoolName, schoolLogoUrl, className, termLabel, yearLabel } = options;
  const days = TIMETABLE_DAYS.filter((d) => !grid.days.length || grid.days.includes(d));
  const slotMap = new Map<string, ClassSlot>();
  for (const slot of grid.slots) slotMap.set(`${slot.day_of_week}:${slot.period_id}`, slot);

  const logo = schoolLogoUrl ? resolveTimetableMediaUrl(schoolLogoUrl) : null;
  const headerCells = grid.periods
    .map((period) => {
      if (period.is_break) {
        const label = escapeHtml(period.name?.trim() || 'Break');
        const time = escapeHtml(formatTimeRangeCompact(period.start_time, period.end_time));
        return `<th class="break-head"><div class="break-label">${label}</div><div class="break-time">${time}</div></th>`;
      }
      const name = escapeHtml(period.name?.trim() || 'Period');
      const time = escapeHtml(formatTimeRangeCompact(period.start_time, period.end_time));
      return `<th><div class="period-name">${name}</div><div class="period-time">${time}</div></th>`;
    })
    .join('');

  const bodyRows = days
    .map((day) => {
      const cells = grid.periods
        .map((period) => {
          if (period.is_break) {
            return '<td class="break-cell">Break</td>';
          }
          const slot = slotMap.get(`${day}:${period.id}`);
          if (!slot) return '<td class="empty">&nbsp;</td>';
          const subject = escapeHtml(slot.subject_name || '');
          const teacher = slot.teacher_name ? `<div class="teacher">${escapeHtml(slot.teacher_name)}</div>` : '';
          return `<td><div class="subject">${subject}</div>${teacher}</td>`;
        })
        .join('');
      return `<tr><th class="day">${escapeHtml(day)}</th>${cells}</tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(className)} Timetable</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet { max-width: 100%; }
    .header {
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 3px solid #059669;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .logo {
      width: 72px;
      height: 72px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .logo-placeholder {
      width: 72px;
      height: 72px;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: #64748b;
      flex-shrink: 0;
    }
    .school-name { font-size: 22px; font-weight: 800; margin: 0; color: #065f46; }
    .meta { margin: 4px 0 0; font-size: 13px; color: #475569; }
    .title { margin: 0 0 12px; font-size: 16px; font-weight: 700; color: #1e293b; }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 11px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 6px;
      vertical-align: top;
      text-align: center;
    }
    thead th {
      background: #f8fafc;
      font-weight: 700;
    }
    th.day {
      width: 88px;
      background: #f1f5f9;
      text-align: left;
      font-size: 12px;
    }
    .period-name { font-size: 11px; font-weight: 800; color: #0f172a; }
    .period-time { margin-top: 3px; font-size: 10px; color: #64748b; font-weight: 600; }
    .break-head { background: #fef3c7 !important; }
    .break-label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #92400e; }
    .break-time { margin-top: 2px; font-size: 9px; color: #b45309; }
    .break-cell { background: #fffbeb; color: #92400e; font-weight: 700; font-size: 10px; }
    .subject { font-weight: 700; color: #065f46; line-height: 1.3; }
    .teacher { margin-top: 4px; font-size: 10px; color: #475569; }
    .empty { background: #fafafa; }
    .footer { margin-top: 12px; font-size: 10px; color: #94a3b8; text-align: right; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      ${logo ? `<img class="logo" src="${escapeHtml(logo)}" alt="School logo" />` : '<div class="logo-placeholder">Logo</div>'}
      <div>
        <h1 class="school-name">${escapeHtml(schoolName)}</h1>
        <p class="meta">${escapeHtml(className)} · ${escapeHtml(termLabel)}${yearLabel ? ` · ${escapeHtml(yearLabel)}` : ''}</p>
      </div>
    </div>
    <h2 class="title">Class Timetable</h2>
    <table>
      <thead>
        <tr>
          <th class="day">Day</th>
          ${headerCells}
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
    <p class="footer">Generated ${new Date().toLocaleString()}</p>
  </div>
  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;
}
