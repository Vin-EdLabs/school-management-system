import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import useClasses from '@/hooks/useClasses';
import { useTeachers } from '@/hooks/useTeachers';
import React from 'react';

type Props = {
    schedules: any[];
    onDelete?: (id: string | number) => void;
    onEdit?: (s: any) => void;
};

const SchedulesView: React.FC<Props> = ({ schedules, onDelete, onEdit }) => {
    const { teachers } = useTeachers();
    const { classes } = useClasses();

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

    return (
        <div className="rounded-md border overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Day</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead>Teacher</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {schedules.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-gray-500">No schedules found.</TableCell>
                        </TableRow>
                    ) : (
                        schedules.map((s: any) => (
                            <TableRow key={s.id}>
                                <TableCell>{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][s.day_of_week] ?? s.day_of_week}</TableCell>
                                <TableCell>{s.start_time?.slice(0, 5) ?? s.start_time}</TableCell>
                                <TableCell>{s.end_time?.slice(0, 5) ?? s.end_time}</TableCell>
                                <TableCell>{getTeacherDisplay(s.teacher_id ?? s.teacherId) ?? s.teacher_name ?? s.teacher_username ?? s.teacher_id}</TableCell>
                                <TableCell>{getClassDisplay(s.class_id ?? s.classId) ?? s.class_name ?? s.class_id}</TableCell>
                                <TableCell>{s.room}</TableCell>
                                <TableCell>{s.subject}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Button size="sm" variant="ghost" onClick={() => onEdit && onEdit(s)}>Edit</Button>
                                        <Button size="sm" variant="destructive" onClick={() => onDelete && onDelete(s.id)}>Delete</Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
};

export default SchedulesView;
