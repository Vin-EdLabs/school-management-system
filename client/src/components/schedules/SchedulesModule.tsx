import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import useClasses from '@/hooks/useClasses';
import { useAllSchedules as useSchedulesAll } from '@/hooks/useSchedules';
import useTeachers from '@/hooks/useTeachers';
import * as schedulesService from '@/services/schedulesService';
import { useQueryClient } from '@tanstack/react-query';
import { Calendar, Eye, Plus } from 'lucide-react';
import React, { useState } from 'react';
import CreateSchedule from './CreateSchedule';
import SchedulesView from './SchedulesView';

const SchedulesModule: React.FC = () => {
    const { hasAccess } = useAuth();
    const { data, isLoading, error } = useSchedulesAll();
    const queryClient = useQueryClient();

    const { teachers } = useTeachers();
    const { classes } = useClasses();

    const [activeTab, setActiveTab] = useState('view-all');
    const [form, setForm] = useState({ teacher_id: '', class_id: '', day_of_week: 1, start_time: '08:00:00', end_time: '09:00:00', room: '', subject: '' });
    const [saving, setSaving] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<any | null>(null);

    if (!hasAccess('schedules')) {
        return (
            <div className="p-6 text-center">
                <h2 className="text-2xl font-bold">Access Denied</h2>
                <p className="text-muted-foreground">You do not have permission to manage schedules.</p>
            </div>
        );
    }

    if (isLoading) return <div className="p-6">Loading schedules...</div>;
    if (error) return <div className="p-6 text-red-600">Failed to load schedules.</div>;

    const schedules = (typeof data === 'object' && data !== null && 'data' in data ? (data as any).data : data) || [];
    const subjectOptionsFromSchedules = Array.from(new Set((schedules || []).map((s: any) => s.subject).filter(Boolean)));
    const defaultSubjects = [
        'Mathematics',
        'English',
        'Physics',
        'Chemistry',
        'Biology',
        'History',
        'Geography',
        'Computer Science',
        'Physical Education',
        'Art',
        'Music',
        'Economics',
        'Civics',
        'Literature'
    ];
    const subjectOptions = Array.from(new Set([...defaultSubjects, ...subjectOptionsFromSchedules]));

    const getClassDisplay = (id: any) => {
        if (id == null) return null;
        const cls = (classes || []).find((c: any) => String(c.id) === String(id) || String(c.ID) === String(id));
        if (!cls) return null;
        return cls.name ?? cls.class_name ?? cls.title ?? (cls.level ? `${cls.level}${cls.stream ? ' ' + cls.stream : ''}` : `Class ${cls.id}`);
    };

    const getTeacherDisplay = (id: any) => {
        if (id == null) return null;
        const t = (teachers || []).find((x: any) => String(x.id) === String(id) || String(x.ID) === String(id));
        if (!t) return null;
        return t.fullName ?? t.full_name ?? t.username ?? `${t.firstName ?? ''} ${t.lastName ?? ''}`;
    };

    const handleChange = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

    const validate = () => {
        const errors: string[] = [];
        if (!form.teacher_id) errors.push('Teacher is required');
        if (!form.class_id) errors.push('Class is required');
        if (!form.subject || form.subject.trim().length === 0) errors.push('Subject is required');
        // ensure times are valid and start < end
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

    const create = async () => {
        setSaving(true);
        try {
            const errors = validate();
            if (errors.length > 0) {
                toast({ title: 'Validation error', description: errors.join('; ') });
                setSaving(false);
                return;
            }

            // normalize time inputs to HH:MM:SS
            const normalizeTime = (t: string) => (t && t.length === 5 ? `${t}:00` : t);

            const payload = {
                teacher_id: form.teacher_id ? Number(form.teacher_id) : null,
                class_id: form.class_id ? Number(form.class_id) : null,
                day_of_week: Number(form.day_of_week),
                start_time: normalizeTime(form.start_time),
                end_time: normalizeTime(form.end_time),
                room: form.room,
                subject: form.subject,
            };
            await schedulesService.createSchedule(payload);
            // refresh schedules (invalidate the exact key and any schedules-related queries)
            await queryClient.invalidateQueries({ queryKey: ['schedules', 'all'] });
            await queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'schedules' });
            setActiveTab('view-all');
            // reset form
            setForm({ teacher_id: '', class_id: '', day_of_week: 1, start_time: '08:00:00', end_time: '09:00:00', room: '', subject: '' });
            toast({ title: 'Schedule created', description: 'Schedule saved successfully.' });
        } catch (err: any) {
            const body = err?.body;
            if (body && body.message) {
                if (body.details && body.details.conflicts && Array.isArray(body.details.conflicts) && body.details.conflicts.length > 0) {
                    const msgs = body.details.conflicts.map((c: any) => {
                        const ex = c.existing || {};
                        const className = ex.class_name || `Class ${ex.class_id ?? ''}`;
                        const teacher = ex.teacher_name || ex.teacher_username || ex.teacher_id || '';
                        const subject = ex.subject || '';
                        const room = ex.room || '';
                        const times = `${ex.start_time ?? ''}-${ex.end_time ?? ''}`;
                        return `${c.type.toUpperCase()} conflict: ${className} — ${subject} (${times})${teacher ? ' — ' + teacher : ''}${room ? ' — room ' + room : ''}`;
                    });
                    toast({ title: body.message, description: msgs.join('\n') });
                } else {
                    toast({ title: body.message });
                }
            } else {
                toast({ title: 'Error', description: err?.message || 'Failed to create schedule' });
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string | number) => {
        if (!confirm('Delete this schedule? This action cannot be undone.')) return;
        try {
            await schedulesService.deleteSchedule(id);
            await queryClient.invalidateQueries({ queryKey: ['schedules', 'all'] });
            await queryClient.invalidateQueries({ predicate: (query) => Array.isArray(query.queryKey) && query.queryKey[0] === 'schedules' });
            toast({ title: 'Deleted', description: 'Schedule deleted successfully.' });
        } catch (err: any) {
            toast({ title: 'Delete failed', description: err?.message || 'Could not delete schedule.' });
        }
    };

    const handleEdit = (s: any) => {
        setEditingSchedule(s);
        setActiveTab('create');
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-lime-600 rounded-lg flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <div className="text-lg font-semibold">Schedules Management</div>
                            <div className="text-sm text-muted-foreground">Create and view class schedules</div>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-sm">Total: {schedules.length}</Badge>
                        {hasAccess('schedules') && (
                            <Button onClick={() => setActiveTab('create')}>
                                <Plus className="w-4 h-4 mr-2" />
                                Create
                            </Button>
                        )}
                    </div>
                </CardTitle>
            </CardHeader>

            <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:grid-cols-2">
                        <TabsTrigger value="view-all" className="flex items-center space-x-2">
                            <Eye className="w-4 h-4" />
                            <span>View All</span>
                        </TabsTrigger>
                        <TabsTrigger value="create" className="flex items-center space-x-2">
                            <Plus className="w-4 h-4" />
                            <span>Create Schedule</span>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="view-all">
                        <SchedulesView schedules={schedules} onDelete={handleDelete} onEdit={handleEdit} />
                    </TabsContent>

                    <TabsContent value="create">
                        <CreateSchedule
                            initial={editingSchedule}
                            onCreated={() => { setEditingSchedule(null); setActiveTab('view-all'); }}
                            onUpdated={() => { setEditingSchedule(null); setActiveTab('view-all'); }}
                            onCancel={() => { setEditingSchedule(null); setActiveTab('view-all'); }}
                        />
                        <datalist id="schedules-subjects-list">
                            {subjectOptions.map((sub: string, idx: number) => (
                                <option key={idx} value={sub} />
                            ))}
                        </datalist>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
};

export default SchedulesModule;
