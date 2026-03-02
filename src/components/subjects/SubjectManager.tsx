import React, { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BookOpen, Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const SubjectManager = () => {
    const { subjects, addSubject, updateSubject, deleteSubject, loading } = useData();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        level: 'JHS'
    });

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) {
            toast({ title: 'Error', description: 'Subject name is required', variant: 'destructive' });
            return;
        }

        try {
            await addSubject(formData);
            toast({ title: 'Success', description: 'Subject added successfully' });
            setFormData({ name: '', code: '', level: 'JHS' });
            setIsAdding(false);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to add subject', variant: 'destructive' });
        }
    };

    const handleUpdate = async (id: string) => {
        if (!formData.name) {
            toast({ title: 'Error', description: 'Subject name is required', variant: 'destructive' });
            return;
        }

        try {
            await updateSubject(id, formData);
            toast({ title: 'Success', description: 'Subject updated successfully' });
            setEditingId(null);
            setFormData({ name: '', code: '', level: 'JHS' });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to update subject', variant: 'destructive' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this subject?')) return;

        try {
            await deleteSubject(id);
            toast({ title: 'Success', description: 'Subject deleted successfully' });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to delete subject', variant: 'destructive' });
        }
    };

    const startEdit = (subject: any) => {
        setEditingId(subject.id);
        setFormData({
            name: subject.name,
            code: subject.code || '',
            level: subject.level || 'JHS'
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-bold flex items-center gap-2">
                            <BookOpen className="w-6 h-6 text-blue-600" />
                            Subjects
                        </CardTitle>
                        <CardDescription>
                            Manage the subjects offered in your school.
                        </CardDescription>
                    </div>
                    <Button onClick={() => setIsAdding(!isAdding)} variant={isAdding ? "outline" : "default"}>
                        {isAdding ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                        {isAdding ? 'Cancel' : 'Add Subject'}
                    </Button>
                </CardHeader>
                <CardContent>
                    {isAdding && (
                        <Card className="mb-6 bg-blue-50/50 border-blue-100">
                            <CardContent className="pt-6">
                                <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                    <div className="space-y-2">
                                        <Label>Subject Name</Label>
                                        <Input
                                            placeholder="e.g. Mathematics"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Subject Code (Optional)</Label>
                                        <Input
                                            placeholder="e.g. MATH101"
                                            value={formData.code}
                                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Level</Label>
                                        <Select value={formData.level} onValueChange={(v) => setFormData({ ...formData, level: v })}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Primary">Primary</SelectItem>
                                                <SelectItem value="JHS">JHS</SelectItem>
                                                <SelectItem value="SHS">SHS</SelectItem>
                                                <SelectItem value="All">All Levels</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button type="submit" className="w-full">
                                        Save Subject
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Subject Name</TableHead>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Level</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {subjects.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                                            No subjects found. Add your first subject to get started.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    subjects.map((subject) => (
                                        <TableRow key={subject.id}>
                                            <TableCell className="font-medium">
                                                {editingId === subject.id ? (
                                                    <Input
                                                        value={formData.name}
                                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    />
                                                ) : (
                                                    subject.name
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {editingId === subject.id ? (
                                                    <Input
                                                        value={formData.code}
                                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                                    />
                                                ) : (
                                                    subject.code || '--'
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {editingId === subject.id ? (
                                                    <Select value={formData.level} onValueChange={(v) => setFormData({ ...formData, level: v })}>
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Primary">Primary</SelectItem>
                                                            <SelectItem value="JHS">JHS</SelectItem>
                                                            <SelectItem value="SHS">SHS</SelectItem>
                                                            <SelectItem value="All">All Levels</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    subject.level
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    {editingId === subject.id ? (
                                                        <>
                                                            <Button size="sm" variant="ghost" onClick={() => handleUpdate(subject.id)} className="text-green-600">
                                                                <Check className="w-4 h-4" />
                                                            </Button>
                                                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="text-red-600">
                                                                <X className="w-4 h-4" />
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button size="sm" variant="ghost" onClick={() => startEdit(subject)}>
                                                                <Edit2 className="w-4 h-4" />
                                                            </Button>
                                                            <Button size="sm" variant="ghost" onClick={() => handleDelete(subject.id)} className="text-red-600">
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default SubjectManager;
