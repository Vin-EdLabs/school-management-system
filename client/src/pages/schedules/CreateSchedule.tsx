import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import useClasses from '@/hooks/useClasses';
import useSubjects from '@/hooks/useSubjects';
import useTeachers from '@/hooks/useTeachers';
import * as schedulesService from '@/services/schedulesService';
import { useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import React, { useMemo, useState } from 'react';

type Props = {
    onCreated?: () => void;
    initial?: any | null;
    onUpdated?: () => void;
    onCancel?: () => void;
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Normalise a teacher row into a display name */
const teacherName = (t: any) =>
    t.fullName ?? t.full_name ?? t.displayName ?? t.display_name ?? t.staffId ?? `Teacher ${t.id}`;

/** Subjects taught by a teacher — stored in meta.subjectsTaught as string[] */
const getTeacherSubjects = (t: any): string[] => {
    const raw = t.subjectsTaught ?? t.subjects_taught ?? t.meta?.subjectsTaught ?? [];
    return Array.isArray(raw) ? raw : [];
};

const CreateSchedule: React.FC<Props> = ({ onCreated, initial = null, onUpdated, onCancel }) => {
    const { teachers } = useTeachers();
    const { classes } = useClasses();
    const { subjects } = useSubjects();
    const queryClient = useQueryClient();

    const [form, setForm] = useState({
        teacher_id: '', class_id: '', day_of_week: 1,
        start_time: '08:00', end_time: '09:00', room: '', subject: ''
    });
    const [saving, setSaving] = useState(false);

    const handleChange = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

    // ── Bidirectional filtering ──────────────────────────────────────────────

    /** Teacher currently selected (object) */
    const selectedTeacher = useMemo(
        () => (teachers || []).find((t: any) => String(t.id) === form.teacher_id) ?? null,
        [teachers, form.teacher_id]
    );

    /** Subjects the selected teacher teaches */
    const selectedTeacherSubjects = useMemo(
        () => (selectedTeacher ? getTeacherSubjects(selectedTeacher) : []),
        [selectedTeacher]
    );

    /**
     * Filtered subjects:
     *  - if a teacher is selected → only subjects in their subjectsTaught list
     *  - otherwise → all subjects
     */
    const filteredSubjects = useMemo(() => {
        const all = subjects || [];
        if (!form.teacher_id) return all;                 // no teacher selected → show all
        if (selectedTeacherSubjects.length === 0) return []; // teacher has no subjects → show empty state
        return all.filter((s: any) => {
            const name = s.name ?? s.title ?? s.code ?? '';
            return selectedTeacherSubjects.includes(name);
        });
    }, [subjects, form.teacher_id, selectedTeacherSubjects]);

    /**
     * Filtered teachers:
     *  - if a subject is selected → only teachers who have that subject in subjectsTaught
     *  - otherwise → all teachers
     */
    const filteredTeachers = useMemo(() => {
        const all = teachers || [];
        if (!form.subject) return all;
        return all.filter((t: any) => getTeacherSubjects(t).includes(form.subject));
    }, [teachers, form.subject]);

    const isTeacherFiltered = form.subject && filteredTeachers.length < (teachers || []).length;
    const isSubjectFiltered = form.teacher_id && filteredSubjects.length < (subjects || []).length;

    // ── Validation & save ────────────────────────────────────────────────────

    const validate = () => {
        const errors: string[] = [];
        if (!form.teacher_id) errors.push('Teacher is required');
        if (!form.class_id) errors.push('Class is required');
        if (!form.subject) errors.push('Subject is required');
        const toSec = (t: string) => {
            const p = t.split(':').map(Number);
            if (p.length < 2 || p.some(isNaN)) return null;
            return p[0] * 3600 + p[1] * 60 + (p[2] ?? 0);
        };
        const s = toSec(form.start_time);
        const e = toSec(form.end_time);
        if (s === null || e === null) errors.push('Start and end times must be valid');
        else if (s >= e) errors.push('Start time must be before end time');
        return errors;
    };

    const normalizeTime = (t: string) => (t && t.length === 5 ? `${t}:00` : t);

    const save = async () => {
        setSaving(true);
        try {
            const errors = validate();
            if (errors.length > 0) {
                toast({ title: 'Validation error', description: errors.join('; ') });
                return;
            }

            const payload = {
                teacher_id: form.teacher_id ? Number(form.teacher_id) : null,
                class_id: form.class_id ? Number(form.class_id) : null,
                day_of_week: Number(form.day_of_week),
                start_time: normalizeTime(form.start_time),
                end_time: normalizeTime(form.end_time),
                room: form.room,
                subject: form.subject,
            };

            const invalidate = async () => {
                await queryClient.invalidateQueries({ queryKey: ['schedules', 'all'] });
                await queryClient.invalidateQueries({ predicate: q => Array.isArray(q.queryKey) && q.queryKey[0] === 'schedules' });
            };

            if (initial && initial.id) {
                await schedulesService.updateSchedule(initial.id, payload);
                await invalidate();
                toast({ title: 'Schedule updated', description: 'Schedule updated successfully.' });
                if (onUpdated) onUpdated();
            } else {
                await schedulesService.createSchedule(payload);
                await invalidate();
                setForm({ teacher_id: '', class_id: '', day_of_week: 1, start_time: '08:00', end_time: '09:00', room: '', subject: '' });
                toast({ title: 'Schedule created', description: 'Schedule saved successfully.' });
                if (onCreated) onCreated();
            }
        } catch (err: any) {
            const body = err?.body;
            if (body?.message) {
                if (body.details?.conflicts?.length > 0) {
                    const msgs = body.details.conflicts.map((c: any) => {
                        const ex = c.existing || {};
                        const cls = ex.class_name ?? `Class ${ex.class_id ?? ''}`;
                        const teacher = ex.teacher_name || ex.teacher_staff_id || ex.teacher_id || '';
                        const subj = ex.subject || '';
                        const room = ex.room || '';
                        const times = `${ex.start_time ?? ''}-${ex.end_time ?? ''}`;
                        return `${c.type.toUpperCase()} conflict: ${cls} — ${subj} (${times})${teacher ? ' — ' + teacher : ''}${room ? ' — room ' + room : ''}`;
                    });
                    toast({ title: body.message, description: msgs.join('\n') });
                } else {
                    toast({ title: body.message });
                }
            } else {
                toast({ title: 'Error', description: err?.message || 'Failed to save schedule' });
            }
        } finally {
            setSaving(false);
        }
    };

    // ── Populate when editing ────────────────────────────────────────────────

    React.useEffect(() => {
        if (initial) {
            setForm({
                teacher_id: initial.teacher_id ? String(initial.teacher_id) : (initial.teacherId ? String(initial.teacherId) : ''),
                class_id: initial.class_id ? String(initial.class_id) : (initial.classId ? String(initial.classId) : ''),
                day_of_week: initial.day_of_week ?? initial.day ?? 1,
                start_time: initial.start_time ? (initial.start_time.length === 8 ? initial.start_time.slice(0, 5) : initial.start_time) : '08:00',
                end_time: initial.end_time ? (initial.end_time.length === 8 ? initial.end_time.slice(0, 5) : initial.end_time) : '09:00',
                room: initial.room ?? '',
                subject: initial.subject ?? initial.name ?? '',
            });
        } else {
            setForm({ teacher_id: '', class_id: '', day_of_week: 1, start_time: '08:00', end_time: '09:00', room: '', subject: '' });
        }
    }, [initial]);

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="mb-4">
            <div className="grid grid-cols-3 gap-3">

                {/* ── Teacher ── filtered by selected subject */}
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">Teacher</span>
                        {isTeacherFiltered && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-1">
                                filtered
                                <button
                                    type="button"
                                    className="ml-0.5 opacity-60 hover:opacity-100"
                                    onClick={() => handleChange('subject', '')}
                                    title="Clear subject filter"
                                >
                                    <X className="w-2.5 h-2.5" />
                                </button>
                            </Badge>
                        )}
                    </div>
                    <Select value={String(form.teacher_id)} onValueChange={(v) => handleChange('teacher_id', v)}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select teacher..." />
                        </SelectTrigger>
                        <SelectContent>
                            {filteredTeachers.map((t: any) => (
                                <SelectItem key={t.id} value={String(t.id)}>
                                    {teacherName(t)}
                                </SelectItem>
                            ))}
                            {filteredTeachers.length === 0 && (
                                <div className="px-3 py-2 text-xs text-muted-foreground">No teachers teach this subject</div>
                            )}
                        </SelectContent>
                    </Select>
                </div>

                {/* ── Class ── unfiltered */}
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">Class</span>
                    <Select value={String(form.class_id)} onValueChange={(v) => handleChange('class_id', v)}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select class..." />
                        </SelectTrigger>
                        <SelectContent>
                            {(classes || []).map((c: any) => (
                                <SelectItem key={c.id} value={String(c.id)}>
                                    {c.name ?? c.class_name ?? c.title ?? (c.level ? `${c.level}${c.stream ? ' ' + c.stream : ''}` : `Class ${c.id}`)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* ── Day ── */}
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">Day</span>
                    <Select value={String(form.day_of_week)} onValueChange={(v) => handleChange('day_of_week', Number(v))}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Day" />
                        </SelectTrigger>
                        <SelectContent>
                            {DAYS.map((d, i) => (
                                <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* ── Times ── */}
                <Input
                    type="time"
                    value={form.start_time?.length === 8 ? form.start_time.slice(0, 5) : form.start_time}
                    onChange={(e) => handleChange('start_time', e.target.value)}
                />
                <Input
                    type="time"
                    value={form.end_time?.length === 8 ? form.end_time.slice(0, 5) : form.end_time}
                    onChange={(e) => handleChange('end_time', e.target.value)}
                />

                {/* ── Room ── */}
                <Input
                    placeholder="Room (optional)"
                    value={form.room}
                    onChange={(e) => handleChange('room', e.target.value)}
                />

                {/* ── Subject — filtered by selected teacher ── */}
                <div className="flex flex-col gap-1 col-span-2">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-muted-foreground">Subject</span>
                        {isSubjectFiltered && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-1">
                                filtered by teacher
                                <button
                                    type="button"
                                    className="ml-0.5 opacity-60 hover:opacity-100"
                                    onClick={() => handleChange('teacher_id', '')}
                                    title="Clear teacher filter"
                                >
                                    <X className="w-2.5 h-2.5" />
                                </button>
                            </Badge>
                        )}
                    </div>
                    <Select
                        value={form.subject}
                        onValueChange={(v) => handleChange('subject', v)}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select subject..." />
                        </SelectTrigger>
                        <SelectContent>
                            {filteredSubjects.map((s: any) => {
                                const label = s.name ?? s.title ?? s.code ?? `Subject ${s.id}`;
                                return (
                                    <SelectItem key={s.id} value={label}>
                                        {label}{s.code ? ` (${s.code})` : ''}
                                    </SelectItem>
                                );
                            })}
                            {filteredSubjects.length === 0 && (
                                <div className="px-3 py-2 text-xs text-muted-foreground">This teacher has no subjects assigned</div>
                            )}
                        </SelectContent>
                    </Select>
                </div>

                {/* ── Actions ── */}
                <div className="flex items-center gap-2">
                    <Button variant="default" onClick={save} disabled={saving}>
                        {saving ? 'Saving...' : (initial && initial.id ? 'Update' : 'Save')}
                    </Button>
                    <Button variant="ghost" onClick={() => {
                        setForm({ teacher_id: '', class_id: '', day_of_week: 1, start_time: '08:00', end_time: '09:00', room: '', subject: '' });
                        if (onCancel) onCancel();
                    }}>
                        Cancel
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CreateSchedule;
