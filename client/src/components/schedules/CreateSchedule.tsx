import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import useClasses from '@/hooks/useClasses';
import useTeachers from '@/hooks/useTeachers';
import * as schedulesService from '@/services/schedulesService';
import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';

type Props = {
    onCreated?: () => void;
    initial?: any | null;
    onUpdated?: () => void;
    onCancel?: () => void;
};

const CreateSchedule: React.FC<Props> = ({ onCreated, initial = null, onUpdated, onCancel }) => {
    const { teachers } = useTeachers();
    const { classes } = useClasses();
    const queryClient = useQueryClient();

    const [form, setForm] = useState({ teacher_id: '', class_id: '', day_of_week: 1, start_time: '08:00', end_time: '09:00', room: '', subject: '' });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<string[] | null>(null);

    const handleChange = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

    const validate = () => {
        const errors: string[] = [];
        if (!form.teacher_id) errors.push('Teacher is required');
        if (!form.class_id) errors.push('Class is required');
        if (!form.subject || form.subject.trim().length === 0) errors.push('Subject is required');
        const toSeconds = (t: string) => {
            if (!t) return null;
            const parts = t.split(':').map(p => Number(p));
            if (parts.length < 2 || parts.some(isNaN)) return null;
            return parts[0] * 3600 + parts[1] * 60 + (parts[2] ? parts[2] : 0);
        };
        const s = toSeconds(form.start_time);
        const e = toSeconds(form.end_time);
        if (s === null || e === null) errors.push('Start and end times must be valid');
        else if (s >= e) errors.push('Start time must be before end time');
        return errors;
    };

    const normalizeTime = (t: string) => (t && t.length === 5 ? `${t}:00` : t);

    const create = async () => {
        setSaveError(null);
        setSaving(true);
        try {
            const errors = validate();
            if (errors.length > 0) {
                setValidationErrors(errors);
                setSaving(false);
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

            if (initial && initial.id) {
                // update flow
                await schedulesService.updateSchedule(initial.id, payload);
                await queryClient.invalidateQueries(['schedules', 'all']);
                await queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'schedules' });
                toast({ title: 'Schedule updated', description: 'Schedule updated successfully.' });
                if (onUpdated) onUpdated();
            } else {
                // create flow
                await schedulesService.createSchedule(payload);
                await queryClient.invalidateQueries(['schedules', 'all']);
                await queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'schedules' });
                setForm({ teacher_id: '', class_id: '', day_of_week: 1, start_time: '08:00', end_time: '09:00', room: '', subject: '' });
                setValidationErrors(null);
                toast({ title: 'Schedule created', description: 'Schedule saved successfully.' });
                if (onCreated) onCreated();
            }
        } catch (err: any) {
            setSaveError(err?.message || 'Failed to create schedule');
        } finally {
            setSaving(false);
        }
    };

    // populate form when initial data provided
    React.useEffect(() => {
        if (initial) {
            setForm({
                teacher_id: initial.teacher_id ? String(initial.teacher_id) : (initial.teacherId ? String(initial.teacherId) : ''),
                class_id: initial.class_id ? String(initial.class_id) : (initial.classId ? String(initial.classId) : ''),
                day_of_week: initial.day_of_week ?? initial.day ?? 1,
                start_time: initial.start_time ? (initial.start_time.length === 8 ? initial.start_time.slice(0, 5) : initial.start_time) : '08:00',
                end_time: initial.end_time ? (initial.end_time.length === 8 ? initial.end_time.slice(0, 5) : initial.end_time) : '09:00',
                room: initial.room ?? '',
                subject: initial.subject ?? initial.name ?? ''
            });
        } else {
            setForm({ teacher_id: '', class_id: '', day_of_week: 1, start_time: '08:00', end_time: '09:00', room: '', subject: '' });
        }
    }, [initial]);

    return (
        <div className="mb-4">
            <div className="grid grid-cols-3 gap-3">
                <Select value={String(form.teacher_id)} onValueChange={(v) => handleChange('teacher_id', v)}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select teacher..." />
                    </SelectTrigger>
                    <SelectContent>
                        {teachers?.map((t: any) => (
                            <SelectItem key={t.id} value={String(t.id)}>{t.fullName ?? t.full_name ?? t.username ?? `${t.firstName ?? ''} ${t.lastName ?? ''}`}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={String(form.class_id)} onValueChange={(v) => handleChange('class_id', v)}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select class..." />
                    </SelectTrigger>
                    <SelectContent>
                        {classes?.map((c: any) => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.name ?? c.class_name ?? c.title ?? (c.level ? `${c.level}${c.stream ? ' ' + c.stream : ''}` : `Class ${c.id}`)}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={String(form.day_of_week)} onValueChange={(v) => handleChange('day_of_week', Number(v))}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Day" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="0">Sunday</SelectItem>
                        <SelectItem value="1">Monday</SelectItem>
                        <SelectItem value="2">Tuesday</SelectItem>
                        <SelectItem value="3">Wednesday</SelectItem>
                        <SelectItem value="4">Thursday</SelectItem>
                        <SelectItem value="5">Friday</SelectItem>
                        <SelectItem value="6">Saturday</SelectItem>
                    </SelectContent>
                </Select>

                <Input type="time" value={form.start_time?.length === 8 ? form.start_time.slice(0, 5) : form.start_time} onChange={(e) => handleChange('start_time', e.target.value)} />
                <Input type="time" value={form.end_time?.length === 8 ? form.end_time.slice(0, 5) : form.end_time} onChange={(e) => handleChange('end_time', e.target.value)} />
                <Input placeholder="Room" value={form.room} onChange={(e) => handleChange('room', e.target.value)} />

                <Input list="schedules-subjects-list" className="col-span-2" placeholder="Subject" value={form.subject} onChange={(e) => handleChange('subject', e.target.value)} />

                <div className="flex items-center gap-2">
                    <Button variant="default" onClick={create} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                    <Button variant="ghost" onClick={() => { setForm({ teacher_id: '', class_id: '', day_of_week: 1, start_time: '08:00', end_time: '09:00', room: '', subject: '' }); setValidationErrors(null); }}>Cancel</Button>
                </div>
            </div>
            {saveError && <div className="text-red-600 mt-2">{saveError}</div>}
            {validationErrors && (
                <div className="mt-2 text-sm text-red-600">
                    <ul className="list-disc pl-5">
                        {validationErrors.map((err, idx) => <li key={idx}>{err}</li>)}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default CreateSchedule;
