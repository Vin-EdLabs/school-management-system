import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import useClasses from '@/hooks/useClasses';
import useTeachers from '@/hooks/useTeachers';
import React, { useEffect, useState } from 'react';

interface EditClassDialogProps {
    classItem: any | null;
    open: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const EditClassDialog: React.FC<EditClassDialogProps> = ({ classItem, open, onClose, onSuccess }) => {
    const { teachers: rawTeachers } = useTeachers();
    const { updateClass } = useClasses();

    const teachers = (rawTeachers || []).map((t: any) => ({
        id: t.id ?? String(t.id),
        fullName: t.fullName || t.full_name || `${t.firstName || ''} ${t.lastName || ''}`
    }));

    const [formData, setFormData] = useState({
        level: '',
        stream: '',
        teacher_id: '' as any,
        maxClassSize: 30
    });

    useEffect(() => {
        if (classItem) {
            setFormData({
                level: classItem.level || '',
                stream: classItem.stream || '',
                teacher_id: classItem.teacher_id ? String(classItem.teacher_id) : 'no-teacher',
                maxClassSize: classItem.maxClassSize ?? classItem.max_class_size ?? 30
            });
        }
    }, [classItem]);

    const levels = ['KG1', 'KG2', 'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6', 'JHS 1', 'JHS 2', 'JHS 3'];
    const streams = ['Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple', 'A', 'B', 'C', 'D'];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!classItem) return;

        if (!formData.level || formData.level.trim() === '') {
            toast({ title: 'Validation Error', description: 'Level is required', variant: 'destructive' });
            return;
        }

        const payload: any = {
            level: formData.level.trim(),
            stream: formData.stream.trim() || null,
            max_class_size: formData.maxClassSize
        };

        if (formData.teacher_id === 'no-teacher') payload.teacher_id = null;
        else if (formData.teacher_id) payload.teacher_id = formData.teacher_id;

        updateClass.mutate({ id: classItem.id, payload }, {
            onSuccess: () => {
                toast({ title: 'Class Updated', description: `${formData.level} ${formData.stream || ''}` });
                onClose();
                if (onSuccess) onSuccess();
            },
            onError: () => {
                toast({ title: 'Error', description: 'Failed to update class', variant: 'destructive' });
            }
        });
    };

    if (!classItem) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Class</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="level">Level *</Label>
                            <Input
                                id="level"
                                list="levels-list-edit"
                                value={formData.level}
                                onChange={(e) => setFormData(prev => ({ ...prev, level: e.target.value }))}
                                required
                            />
                            <datalist id="levels-list-edit">
                                {levels.map(l => <option key={l} value={l} />)}
                            </datalist>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="stream">Stream/Section</Label>
                            <Input
                                id="stream"
                                list="streams-list-edit"
                                value={formData.stream}
                                onChange={(e) => setFormData(prev => ({ ...prev, stream: e.target.value }))}
                            />
                            <datalist id="streams-list-edit">
                                {streams.map(s => <option key={s} value={s} />)}
                            </datalist>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="teacher">Assigned Teacher</Label>
                            <Select value={String(formData.teacher_id ?? 'no-teacher')} onValueChange={(value) => setFormData(prev => ({ ...prev, teacher_id: value }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select teacher (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="no-teacher">No teacher assigned</SelectItem>
                                    {teachers.map(t => (
                                        <SelectItem key={t.id} value={String(t.id)}>{t.fullName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="maxClassSize">Maximum Class Size</Label>
                            <Input id="maxClassSize" type="number" min={1} max={200} value={formData.maxClassSize} onChange={(e) => setFormData(prev => ({ ...prev, maxClassSize: parseInt(e.target.value) || 30 }))} />
                        </div>
                    </div>

                    <DialogFooter>
                        <div className="flex justify-end space-x-2">
                            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                            <Button type="submit">Save Changes</Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default EditClassDialog;
