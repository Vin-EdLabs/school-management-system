import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { isAssignableTeacher, sortTeachersByName } from '@/utils/teacherFilters';
import { Lock, Pencil, Save } from 'lucide-react';

type ClassRow = {
  id: string;
  className?: string;
  name?: string;
  level?: string;
  stream?: string;
  maxClassSize?: number;
  assignedTeacherId?: number;
  isFinalClass?: boolean;
};

interface EditClassDialogProps {
  classItem: ClassRow | null;
  open: boolean;
  onClose: () => void;
}

const streamPresets = ['Red', 'Blue', 'Green', 'Yellow', 'Orange', 'Purple', 'A', 'B', 'C', 'D'];

const EditClassDialog: React.FC<EditClassDialogProps> = ({ classItem, open, onClose }) => {
  const { updateClass, teachers } = useData();
  const [formData, setFormData] = useState({
    className: '',
    stream: '',
    maxClassSize: 30,
    assignedTeacher: 'no-teacher',
    isFinalClass: false,
  });
  const [saving, setSaving] = useState(false);
  const [confirmRenameOpen, setConfirmRenameOpen] = useState(false);

  const resolvedName = (classItem?.className || classItem?.name || '').toString();
  const nameChanged = formData.className.trim() !== resolvedName.trim();

  useEffect(() => {
    if (!classItem || !open) return;
    setFormData({
      className: resolvedName,
      stream: classItem.stream || '',
      maxClassSize: classItem.maxClassSize || 30,
      assignedTeacher: classItem.assignedTeacherId
        ? String(classItem.assignedTeacherId)
        : 'no-teacher',
      isFinalClass: !!classItem.isFinalClass,
    });
  }, [classItem, open, resolvedName]);

  const activeTeachers = teachers.filter(isAssignableTeacher).sort(sortTeachersByName);

  const doSave = async () => {
    if (!classItem) return;

    const className = formData.className.trim();
    if (!className) {
      toast({ title: 'Class name is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const assignedTeacherId =
        formData.assignedTeacher && formData.assignedTeacher !== 'no-teacher'
          ? parseInt(formData.assignedTeacher, 10)
          : null;

      await updateClass(String(classItem.id), {
        className,
        stream: formData.stream.trim(),
        maxClassSize: formData.maxClassSize,
        assignedTeacherId,
        isFinalClass: formData.isFinalClass,
      });

      toast({
        title: 'Class updated',
        description: nameChanged
          ? `"${className}" saved. Fee structures use class ID — the new name appears everywhere automatically.`
          : `"${className}" saved successfully.`,
      });
      setConfirmRenameOpen(false);
      onClose();
    } catch {
      toast({
        title: 'Update failed',
        description: 'Could not save class changes. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameChanged) {
      setConfirmRenameOpen(true);
      return;
    }
    void doSave();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Edit Class
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <DialogBody className="space-y-5 overflow-y-auto px-6 py-4">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  Editable fields
                </p>

                <div className="space-y-2">
                  <Label htmlFor="editClassName">Class Name *</Label>
                  <Input
                    id="editClassName"
                    value={formData.className}
                    onChange={(e) => setFormData((prev) => ({ ...prev, className: e.target.value }))}
                    placeholder="e.g., Primary 4 Yellow"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="editStream">Stream / Section</Label>
                    <Input
                      id="editStream"
                      value={formData.stream}
                      onChange={(e) => setFormData((prev) => ({ ...prev, stream: e.target.value }))}
                      placeholder="e.g., Yellow, A, Science"
                      list="stream-presets"
                    />
                    <datalist id="stream-presets">
                      {streamPresets.map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editCapacity">Maximum Class Size</Label>
                    <Input
                      id="editCapacity"
                      type="number"
                      min={1}
                      max={200}
                      value={formData.maxClassSize}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          maxClassSize: parseInt(e.target.value, 10) || 30,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Locked fields</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex cursor-not-allowed items-center gap-3 rounded-md border border-slate-200 bg-slate-100 px-3 py-3 text-slate-500 dark:border-border dark:bg-muted/50">
                        <Lock className="h-4 w-4 shrink-0" />
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Level</p>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {classItem?.level || '—'}
                          </p>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      Level cannot be changed because it is linked to the fee structure
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="space-y-3 border-t pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Additional settings
                </p>

                <div className="space-y-2">
                  <Label htmlFor="editTeacher">Assigned Class Teacher</Label>
                  <Select
                    value={formData.assignedTeacher}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, assignedTeacher: value }))}
                  >
                    <SelectTrigger id="editTeacher">
                      <SelectValue placeholder="Select teacher" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[min(320px,60dvh)]">
                      <SelectItem value="no-teacher">No teacher assigned</SelectItem>
                      {activeTeachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-border dark:bg-muted/30">
                  <input
                    id="editIsFinalClass"
                    type="checkbox"
                    checked={formData.isFinalClass}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, isFinalClass: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <Label htmlFor="editIsFinalClass" className="cursor-pointer text-sm font-normal">
                    Final graduating class (e.g. JHS 3, SHS 3)
                  </Label>
                </div>
              </div>
            </DialogBody>
            <DialogFooter className="form-action-bar shrink-0 gap-2 border-t px-6 py-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" variant="primaryAction" disabled={saving}>
                {saving ? 'Saving…' : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRenameOpen} onOpenChange={setConfirmRenameOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update class name everywhere?</AlertDialogTitle>
            <AlertDialogDescription>
              Changing the class name from <strong>{resolvedName}</strong> to{' '}
              <strong>{formData.className.trim()}</strong> will update it across all fee structures and records.
              Fee structures are linked by class ID, so amounts and assignments stay the same — only the displayed
              name changes. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={saving} onClick={() => void doSave()}>
              {saving ? 'Saving…' : 'Yes, update name'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default EditClassDialog;
