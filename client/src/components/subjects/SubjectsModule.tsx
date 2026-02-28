import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import useSubjects from '@/hooks/useSubjects';
import { Library, Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

const SubjectsModule = () => {
    const { subjects, isLoading, createSubject, deleteSubject } = useSubjects();
    const [newSubjectName, setNewSubjectName] = useState('');
    const [newSubjectCode, setNewSubjectCode] = useState('');

    const handleAddSubject = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSubjectName) {
            toast({ title: 'Validation Error', description: 'Subject name is required.', variant: 'destructive' });
            return;
        }

        createSubject.mutate({
            name: newSubjectName,
            code: newSubjectCode || undefined
        }, {
            onSuccess: () => {
                setNewSubjectName('');
                setNewSubjectCode('');
            }
        });
    };

    const handleDeleteSubject = (id: number) => {
        if (window.confirm('Are you sure you want to delete this subject?')) {
            deleteSubject.mutate(id);
        }
    };

    return (
        <div className="p-6">
            <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Library className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Subjects Management</h1>
                    <p className="text-muted-foreground">Manage academic subjects</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                    <Card>
                        <CardHeader>
                            <CardTitle>Add New Subject</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleAddSubject} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="subjectName">Subject Name *</Label>
                                    <Input
                                        id="subjectName"
                                        value={newSubjectName}
                                        onChange={(e) => setNewSubjectName(e.target.value)}
                                        placeholder="e.g. Mathematics"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="subjectCode">Subject Code (Optional)</Label>
                                    <Input
                                        id="subjectCode"
                                        value={newSubjectCode}
                                        onChange={(e) => setNewSubjectCode(e.target.value)}
                                        placeholder="e.g. MATH101"
                                    />
                                </div>
                                <Button type="submit" className="w-full" disabled={createSubject.isPending}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    {createSubject.isPending ? 'Adding...' : 'Add Subject'}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                <div className="md:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>All Subjects ({subjects.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="py-8 text-center text-muted-foreground">Loading subjects...</div>
                            ) : (
                                <div className="rounded-md border overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>No.</TableHead>
                                                <TableHead>Subject Name</TableHead>
                                                <TableHead>Code</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {subjects.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                        No subjects found.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                subjects.map((subject: any, index: number) => (
                                                    <TableRow key={subject.id}>
                                                        <TableCell>{index + 1}</TableCell>
                                                        <TableCell className="font-medium">{subject.name || subject.title}</TableCell>
                                                        <TableCell>{subject.code || '-'}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                onClick={() => handleDeleteSubject(subject.id)}
                                                                disabled={deleteSubject.isPending}
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default SubjectsModule;
