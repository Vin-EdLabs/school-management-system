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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Calendar className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Academic Terms</h1>
            <p className="text-muted-foreground">Manage school terms and academic years</p>
          </div>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-indigo-600 hover:bg-indigo-700 h-11 px-6 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-500/20">
          <Plus className="w-4 h-4 mr-2" />
          Add New Term
        </Button>
      </div>

      <Card className="border-0 shadow-xl bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm rounded-2xl overflow-hidden">
        <CardHeader className="bg-muted/50 dark:bg-slate-800/50 border-b border-border dark:border-slate-800">
          <CardTitle className="text-xl font-semibold text-foreground">School Terms List</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50 dark:bg-slate-800/50">
              <TableRow className="border-border dark:border-slate-800">
                <TableHead className="font-semibold text-muted-foreground h-14">Term Name</TableHead>
                <TableHead className="font-semibold text-muted-foreground h-14">Year</TableHead>
                <TableHead className="font-semibold text-muted-foreground h-14">Start Date</TableHead>
                <TableHead className="font-semibold text-muted-foreground h-14">End Date</TableHead>
                <TableHead className="font-semibold text-muted-foreground h-14">Status</TableHead>
                <TableHead className="text-right font-semibold text-muted-foreground h-14 pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-muted-foreground font-medium">Loading terms...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : terms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-20">
                    <div className="flex flex-col items-center justify-center space-y-3 opacity-60">
                      <Calendar className="w-16 h-16 text-slate-300" />
                      <p className="text-muted-foreground text-lg font-medium">No terms defined yet.</p>
                      <Button variant="ghost" className="text-indigo-600" onClick={() => handleOpenDialog()}>Click here to create your first term</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                terms.map((term: any) => (
                  <TableRow key={term.id} className={`${term.is_active ? 'bg-indigo-50/40 dark:bg-indigo-900/10 hover:bg-indigo-50/60 dark:hover:bg-indigo-900/20' : 'hover:bg-muted/50 dark:hover:bg-slate-800/50'} transition-colors border-border dark:border-slate-800`}>
                    <TableCell className="font-medium text-foreground py-5">{term.name}</TableCell>
                    <TableCell className="text-muted-foreground">{term.year}</TableCell>
                    <TableCell className="text-muted-foreground">{term.start_date ? new Date(term.start_date).toLocaleDateString() : '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{term.end_date ? new Date(term.end_date).toLocaleDateString() : '-'}</TableCell>
                    <TableCell>
                      {term.is_active ? (
                        <div className="flex items-center space-x-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800/50">System Active</Badge>
                        </div>
                      ) : (
                        <Badge variant="secondary" className="bg-muted dark:bg-slate-800 text-muted-foreground border-border dark:border-slate-700">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2 pr-6 py-5">
                      {!term.is_active && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(term.id)}
                          className="border-indigo-200 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 dark:hover:bg-indigo-900 hover:text-white rounded-lg px-4 h-9 font-medium"
                        >
                          Mark Active
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(term)} className="text-muted-foreground hover:bg-muted dark:hover:bg-slate-800 rounded-lg">Edit</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg"
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
        <DialogContent className="sm:max-w-[500px] rounded-2xl border-none shadow-2xl p-0 overflow-hidden font-outfit bg-white dark:bg-slate-900">
          <form onSubmit={handleSubmit}>
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 text-white relative overflow-hidden">
              <div className="relative z-10">
                <DialogTitle className="text-2xl font-bold">{editingTerm ? 'Edit Academic Term' : 'Add Academic Term'}</DialogTitle>
                <DialogDescription className="text-indigo-100 mt-2">
                  Set the name and duration for the school term.
                </DialogDescription>
              </div>
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Calendar className="w-24 h-24 rotate-12" />
              </div>
            </div>

            <div className="px-8 py-6 space-y-5 bg-transparent">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  Term Name <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.name}
                  onValueChange={(v) => setFormData({ ...formData, name: v })}
                >
                  <SelectTrigger className="h-12 rounded-xl border-2 border-border dark:border-slate-800 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-950">
                    <SelectValue placeholder="Select Term" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                    <SelectItem value="Term 1">Term 1</SelectItem>
                    <SelectItem value="Term 2">Term 2</SelectItem>
                    <SelectItem value="Term 3">Term 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="year" className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  Academic Year <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="year"
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                  placeholder="e.g. 2024"
                  className="h-12 rounded-xl border-2 border-border dark:border-slate-800 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-950"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate" className="text-sm font-semibold text-muted-foreground">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="h-12 rounded-xl border-2 border-border dark:border-slate-800 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-950"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate" className="text-sm font-semibold text-muted-foreground">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="h-12 rounded-xl border-2 border-border dark:border-slate-800 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-slate-950"
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="px-8 py-6 bg-muted/30 dark:bg-slate-800/30 border-t border-border dark:border-slate-800 flex-row justify-end space-x-3">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl h-11 px-6 font-medium text-muted-foreground hover:bg-muted dark:hover:bg-slate-800">Cancel</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 rounded-xl h-11 px-6 font-medium shadow-lg shadow-indigo-500/20 text-white">
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
