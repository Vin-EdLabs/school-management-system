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
            <Card className="border-border bg-card shadow-sm">
                <CardHeader className="flex flex-col gap-4 border-b border-border/70 bg-muted/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div className="space-y-1">
                        <CardTitle className="text-xl font-bold flex items-center gap-2 text-card-foreground sm:text-2xl">
                            <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            Subjects
                        </CardTitle>
                        <CardDescription>
                            Manage the subjects offered in your school.
                        </CardDescription>
                    </div>
                    <Button onClick={() => setIsAdding(!isAdding)} variant={isAdding ? "outline" : "primaryAction"} className="min-h-10 w-full sm:w-auto">
                        {isAdding ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                        {isAdding ? 'Cancel' : 'Add Subject'}
                    </Button>
                </CardHeader>
                <CardContent className="px-4 py-5 sm:px-6">
                    {isAdding && (
                        <Card className="mb-6 border-blue-100 bg-blue-50/70 shadow-none dark:border-blue-900/50 dark:bg-blue-950/20">
                            <CardContent className="p-4 sm:p-5">
                                <form onSubmit={handleAdd} className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-[1fr_1fr_12rem_auto] lg:items-end">
                                    <div className="space-y-2">
                                        <Label>Subject Name</Label>
                                        <Input
                                            placeholder="e.g. Mathematics"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            required
                                            className="bg-white dark:bg-slate-950"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Subject Code (Optional)</Label>
                                        <Input
                                            placeholder="e.g. MATH101"
                                            value={formData.code}
                                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                            className="bg-white dark:bg-slate-950"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Level</Label>
                                        <Select value={formData.level} onValueChange={(v) => setFormData({ ...formData, level: v })}>
                                            <SelectTrigger className="bg-white dark:bg-slate-950">
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
                                    <Button type="submit" variant="primaryAction" className="min-h-10 w-full whitespace-nowrap md:col-span-3 lg:col-span-1">
                                        Save Subject
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    <div className="overflow-x-auto rounded-md border border-border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-foreground">Subject Name</TableHead>
                                    <TableHead className="text-foreground">Code</TableHead>
                                    <TableHead className="text-foreground">Level</TableHead>
                                    <TableHead className="text-right text-foreground">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {subjects.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                            No subjects found. Add your first subject to get started.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    subjects.map((subject) => (
                                        <TableRow key={subject.id} className="hover:bg-muted/40">
                                            <TableCell className="min-w-[12rem] font-medium text-foreground">
                                                {editingId === subject.id ? (
                                                    <Input
                                                        value={formData.name}
                                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                        className="min-w-[11rem] bg-white dark:bg-slate-950"
                                                    />
                                                ) : (
                                                    subject.name
                                                )}
                                            </TableCell>
                                            <TableCell className="min-w-[10rem] text-foreground">
                                                {editingId === subject.id ? (
                                                    <Input
                                                        value={formData.code}
                                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                                        className="min-w-[9rem] bg-white dark:bg-slate-950"
                                                    />
                                                ) : (
                                                    subject.code || '--'
                                                )}
                                            </TableCell>
                                            <TableCell className="min-w-[10rem] text-foreground">
                                                {editingId === subject.id ? (
                                                    <Select value={formData.level} onValueChange={(v) => setFormData({ ...formData, level: v })}>
                                                        <SelectTrigger className="min-w-[9rem] bg-white dark:bg-slate-950">
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
                                            <TableCell className="sticky right-0 min-w-[8rem] bg-card/95 text-right backdrop-blur supports-[backdrop-filter]:bg-card/80">
                                                <div className="flex justify-end gap-2">
                                                    {editingId === subject.id ? (
                                                        <>
                                                            <Button size="sm" variant="primaryAction" onClick={() => handleUpdate(subject.id)} className="min-h-9 min-w-9">
                                                                <Check className="w-4 h-4" />
                                                                <span className="sr-only">Update subject</span>
                                                            </Button>
                                                            <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="min-h-9 min-w-9 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40">
                                                                <X className="w-4 h-4" />
                                                                <span className="sr-only">Cancel edit</span>
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Button size="sm" variant="outline" onClick={() => startEdit(subject)} className="min-h-9 min-w-9">
                                                                <Edit2 className="w-4 h-4" />
                                                                <span className="sr-only">Edit subject</span>
                                                            </Button>
                                                            <Button size="sm" variant="outline" onClick={() => handleDelete(subject.id)} className="min-h-9 min-w-9 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40">
                                                                <Trash2 className="w-4 h-4" />
                                                                <span className="sr-only">Delete subject</span>
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
