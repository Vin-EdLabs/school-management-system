import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAcademicTerms } from '@/hooks/useAcademicTerms';
import { Calendar, Plus, Save, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

const AcademicTermManager = () => {
  const { toast } = useToast();
  const { terms, isLoading, createTerm, updateTerm, deleteTerm, setActiveTerm } = useAcademicTerms();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    year: new Date().getFullYear().toString(),
    startDate: '',
    endDate: '',
    isActive: false
  });

  const handleOpenDialog = (term?: any) => {
    if (term) {
      setEditingTerm(term);
      setFormData({
        name: term.name,
        year: term.year,
        startDate: term.start_date ? term.start_date.split('T')[0] : '',
        endDate: term.end_date ? term.end_date.split('T')[0] : '',
        isActive: term.is_active || false
      });
    } else {
      setEditingTerm(null);
      setFormData({
        name: '',
        year: new Date().getFullYear().toString(),
        startDate: '',
        endDate: '',
        isActive: false
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.year) {
      toast({
        title: "Validation Error",
        description: "Term name and year are required",
        variant: "destructive"
      });
      return;
    }

    if (editingTerm) {
      updateTerm.mutate({ id: editingTerm.id, payload: formData }, {
        onSuccess: () => {
          toast({ title: "Updated", description: "Academic term updated successfully" });
          setIsDialogOpen(false);
        }
      });
    } else {
      createTerm.mutate(formData, {
        onSuccess: () => {
          toast({ title: "Created", description: "New academic term created" });
          setIsDialogOpen(false);
        }
      });
    }
  };

  const handleToggleActive = (id: number | string) => {
    setActiveTerm.mutate(id, {
      onSuccess: () => {
        toast({ title: "Active Term Changed", description: "The system active term has been updated" });
      }
    });
  };

  const handleDeleteTerm = (id: number | string) => {
    if (confirm('Are you sure you want to delete this term?')) {
      deleteTerm.mutate(id, {
        onSuccess: () => {
          toast({ title: "Deleted", description: "Academic term removed" });
        }
      });
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between font-outfit">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Academic Terms</h1>
            <p className="text-slate-500">Manage school terms and academic years</p>
          </div>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-indigo-600 hover:bg-indigo-700 h-11 px-6 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-100">
          <Plus className="w-4 h-4 mr-2" />
          Add New Term
        </Button>
      </div>

      <Card className="border-none shadow-xl shadow-slate-200/50 bg-white/70 backdrop-blur-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-xl font-semibold text-slate-800">School Terms List</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/30">
              <TableRow>
                <TableHead className="font-semibold text-slate-600 h-14">Term Name</TableHead>
                <TableHead className="font-semibold text-slate-600 h-14">Year</TableHead>
                <TableHead className="font-semibold text-slate-600 h-14">Start Date</TableHead>
                <TableHead className="font-semibold text-slate-600 h-14">End Date</TableHead>
                <TableHead className="font-semibold text-slate-600 h-14">Status</TableHead>
                <TableHead className="text-right font-semibold text-slate-600 h-14 pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-slate-500 font-medium">Loading terms...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : terms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20">
                    <div className="flex flex-col items-center justify-center space-y-3 opacity-60">
                      <Calendar className="w-16 h-16 text-slate-300" />
                      <p className="text-slate-500 text-lg font-medium">No terms defined yet.</p>
                      <Button variant="ghost" className="text-indigo-600" onClick={() => handleOpenDialog()}>Click here to create your first term</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                terms.map((term: any) => (
                  <TableRow key={term.id} className={`${term.is_active ? 'bg-indigo-50/40 hover:bg-indigo-50/60' : 'hover:bg-slate-50/50'} transition-colors border-slate-100`}>
                    <TableCell className="font-medium text-slate-900 py-5">{term.name}</TableCell>
                    <TableCell className="text-slate-600">{term.year}</TableCell>
                    <TableCell className="text-slate-600">{term.start_date ? new Date(term.start_date).toLocaleDateString() : '-'}</TableCell>
                    <TableCell className="text-slate-600">{term.end_date ? new Date(term.end_date).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>
                      {term.is_active ? (
                        <div className="flex items-center space-x-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">System Active</Badge>
                        </div>
                      ) : (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-slate-200">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2 pr-6 py-5">
                      {!term.is_active && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(term.id)}
                          className="border-indigo-200 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg px-4 h-9 font-medium"
                        >
                          Mark Active
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(term)} className="text-slate-600 hover:bg-slate-100 rounded-lg">Edit</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        onClick={() => handleDeleteTerm(term.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl border-none shadow-2xl p-0 overflow-hidden font-outfit">
          <form onSubmit={handleSubmit}>
            <div className="bg-indigo-600 p-8 text-white">
              <DialogTitle className="text-2xl font-bold">{editingTerm ? 'Edit Academic Term' : 'Add Academic Term'}</DialogTitle>
              <DialogDescription className="text-indigo-100 mt-2">
                Set the name and duration for the school term.
              </DialogDescription>
            </div>

            <div className="px-8 py-6 space-y-5 bg-white">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-600 font-medium">Term Name</Label>
                <Select
                  value={formData.name}
                  onValueChange={(v) => setFormData({ ...formData, name: v })}
                >
                  <SelectTrigger className="h-11 rounded-xl border-slate-200 focus:ring-indigo-500 focus:border-indigo-500">
                    <SelectValue placeholder="Select Term" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Term 1">Term 1</SelectItem>
                    <SelectItem value="Term 2">Term 2</SelectItem>
                    <SelectItem value="Term 3">Term 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="year" className="text-slate-600 font-medium">Academic Year</Label>
                <Input
                  id="year"
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  placeholder="e.g. 2024"
                  className="h-11 rounded-xl border-slate-200 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="text-slate-600 font-medium">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="h-11 rounded-xl border-slate-200 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate" className="text-slate-600 font-medium">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="h-11 rounded-xl border-slate-200 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="px-8 py-6 bg-slate-50/80 border-t border-slate-100 flex-row justify-end space-x-3">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl h-11 px-6 font-medium text-slate-600">Cancel</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 rounded-xl h-11 px-6 font-medium shadow-lg shadow-indigo-100">
                <Save className="w-4 h-4 mr-2" />
                {editingTerm ? 'Update Term' : 'Create Term'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AcademicTermManager;
