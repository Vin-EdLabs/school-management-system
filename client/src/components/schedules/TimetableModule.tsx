import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import useClasses from '@/hooks/useClasses';
import { useAllSchedules as useSchedulesAll } from '@/hooks/useSchedules';
import useTeachers from '@/hooks/useTeachers';
import React from 'react';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const normalizeDayIndex = (d: any) => {
    const n = Number(d);
    if (Number.isNaN(n)) return -1;
    return ((n % 7) + 7) % 7;
};

const TimetableModule: React.FC = () => {
    const { classes: rawClasses } = useClasses();
    const { teachers: rawTeachers } = useTeachers();
    const { data } = useSchedulesAll();
    const schedules = (data as any)?.data || data || [];

    const classes = rawClasses || [];
    const teachers = rawTeachers || [];

    // Group schedules by class id
    const byClass: Record<string, any[]> = {};
    schedules.forEach((s: any) => {
        const cid = s.class_id ?? s.classId ?? s.class;
        const key = cid != null ? String(cid) : 'unknown';
        byClass[key] = byClass[key] || [];
        byClass[key].push(s);
    });

    const getClassName = (cls: any) =>
        cls
            ? cls.name ?? cls.class_name ?? cls.title ?? (cls.level ? `${cls.level}${cls.stream ? ' ' + cls.stream : ''}` : `Class ${cls.id}`)
            : 'Unknown Class';

    const getTeacherName = (id: any) => {
        const t = teachers.find((x: any) => String(x.id) === String(id) || String(x.ID) === String(id));
        if (!t) return id ?? '';
        return t.fullName ?? t.full_name ?? t.username ?? `${t.firstName ?? ''} ${t.lastName ?? ''}`;
    };

    const sortedClassKeys = Object.keys(byClass).sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b);
    });

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Timetable</h2>
                <p className="text-sm text-gray-500">Per-class timetable: days as rows and times as columns</p>
            </div>

            {sortedClassKeys.length === 0 && (
                <Card>
                    <CardContent className="py-12 text-center text-gray-500">No timetable entries found.</CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-4">
                {sortedClassKeys.map((key) => {
                    const cls = classes.find((c: any) => String(c.id) === String(key) || String(c.ID) === String(key));
                    const entries = (byClass[key] || []).slice();

                    // Build a set of unique time slots for this class
                    const slotSet = new Map<string, { start: string; end: string }>();
                    entries.forEach((e: any) => {
                        const start = (e.start_time || e.start || '').slice(0, 8);
                        const end = (e.end_time || e.end || '').slice(0, 8) || '';
                        const keyStr = `${start}__${end}`;
                        if (!slotSet.has(keyStr)) slotSet.set(keyStr, { start, end });
                    });

                    const slots = Array.from(slotSet.values()).sort((a, b) => {
                        if (a.start !== b.start) return a.start.localeCompare(b.start);
                        return a.end.localeCompare(b.end);
                    });

                    // Build lookup by day and slot
                    const lookup: Record<string, any> = {};
                    const presentDays = new Set<number>();
                    entries.forEach((e: any) => {
                        const dayIdx = normalizeDayIndex(e.day_of_week ?? e.day ?? e.dow);
                        if (dayIdx >= 0) presentDays.add(dayIdx);
                        const start = (e.start_time || e.start || '').slice(0, 8);
                        const end = (e.end_time || e.end || '').slice(0, 8) || '';
                        const slotKey = `${start}__${end}`;
                        const key2 = `${dayIdx}__${slotKey}`;
                        lookup[key2] = e;
                    });

                    // Days: include 0..6 but omit Sunday(0) and Saturday(6) if the class has no entries on those days
                    const allDays = [0, 1, 2, 3, 4, 5, 6];
                    const days = allDays.filter((d) => {
                        if ((d === 0 || d === 6) && !presentDays.has(d)) return false;
                        return true;
                    });

                    return (
                        <Card key={key}>
                            <CardHeader>
                                <CardTitle>{getClassName(cls)}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex justify-end mb-2">
                                    <button
                                        className="px-3 py-1 rounded bg-gray-100 text-sm hover:bg-gray-200"
                                        onClick={() => {
                                            // create a printable HTML string for this class card
                                            const w = window.open('', '_blank');
                                            if (!w) return;
                                            const title = `${getClassName(cls)} - Timetable`;
                                            const styles = `
                        body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; padding: 20px; }
                        table { border-collapse: collapse; width: 100%; }
                        th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
                        th { background: #f3f4f6; }
                        .title { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
                      `;
                                            const rowsHtml = (() => {
                                                const headerCols = slots.length === 0 ? [`<th>No times</th>`] : slots.map((s) => `<th>${(s.start || '').slice(0, 5)}${s.end ? ' - ' + s.end.slice(0, 5) : ''}</th>`).join('');
                                                const bodyRows = days.map((d) => {
                                                    const cells = slots.length === 0
                                                        ? `<td>No scheduled times</td>`
                                                        : slots.map((s) => {
                                                            const slotKey = `${s.start}__${s.end}`;
                                                            const e = lookup[`${d}__${slotKey}`];
                                                            if (!e) return `<td>—</td>`;
                                                            const teacher = (getTeacherName(e.teacher_id ?? e.teacherId ?? e.teacher) || '—');
                                                            const subject = (e.subject ?? e.name ?? e.title ?? '—');
                                                            return `<td><div style="font-weight:600">${teacher}</div><div style="font-size:12px;color:#4b5563">${subject}</div></td>`;
                                                        }).join('');
                                                    return `<tr><td style="font-weight:600">${DAY_NAMES[d]}</td>${cells}</tr>`;
                                                }).join('');
                                                return `<table><thead><tr><th>Day / Time</th>${headerCols}</tr></thead><tbody>${bodyRows}</tbody></table>`;
                                            })();
                                            const html = `<html><head><title>${title}</title><style>${styles}</style></head><body><div class="title">${title}</div>${rowsHtml}</body></html>`;
                                            w.document.open();
                                            w.document.write(html);
                                            w.document.close();
                                            w.focus();
                                            setTimeout(() => { w.print(); }, 250);
                                        }}
                                    >
                                        Print
                                    </button>
                                </div>
                                <div className="overflow-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Day / Time</TableHead>
                                                {slots.length === 0 ? (
                                                    <TableHead className="text-muted">No times</TableHead>
                                                ) : (
                                                    slots.map((s, i) => (
                                                        <TableHead key={i}>{`${(s.start || '').slice(0, 5)}${s.end ? ' - ' + s.end.slice(0, 5) : ''}`}</TableHead>
                                                    ))
                                                )}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {days.map((d) => (
                                                <TableRow key={d}>
                                                    <TableCell className="font-medium">{DAY_NAMES[d]}</TableCell>
                                                    {slots.length === 0 ? (
                                                        <TableCell colSpan={1} className="text-sm text-gray-500">No scheduled times</TableCell>
                                                    ) : (
                                                        slots.map((s, i) => {
                                                            const slotKey = `${s.start}__${s.end}`;
                                                            const e = lookup[`${d}__${slotKey}`];
                                                            if (!e) {
                                                                return (
                                                                    <TableCell key={i} className="text-sm text-gray-400">—</TableCell>
                                                                );
                                                            }
                                                            const teacher = getTeacherName(e.teacher_id ?? e.teacherId ?? e.teacher);
                                                            const subject = e.subject ?? e.name ?? e.title ?? '';
                                                            return (
                                                                <TableCell key={i} className="space-y-0">
                                                                    <div className="text-sm font-semibold">{teacher || '—'}</div>
                                                                    <div className="text-xs text-gray-600">{subject || '—'}</div>
                                                                </TableCell>
                                                            );
                                                        })
                                                    )}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

export default TimetableModule;
