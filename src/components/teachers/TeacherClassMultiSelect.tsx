import React from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';
import type { Class } from '@/contexts/DataContext';
import { FormFieldError } from '@/components/common/FormFieldError';
import { fieldInvalidClass } from '@/utils/formValidation';

type TeacherClassMultiSelectProps = {
  classes: Class[];
  selectedClassIds: string[];
  onChange: (ids: string[]) => void;
  error?: string;
  id?: string;
};

const TeacherClassMultiSelect: React.FC<TeacherClassMultiSelectProps> = ({
  classes,
  selectedClassIds,
  onChange,
  error,
  id = 'teacher-classes-select',
}) => {
  const available = classes.filter((c) => !selectedClassIds.includes(c.id));

  const handleAdd = (classId: string) => {
    if (!classId || selectedClassIds.includes(classId)) return;
    onChange([...selectedClassIds, classId]);
  };

  const handleRemove = (classId: string) => {
    onChange(selectedClassIds.filter((x) => x !== classId));
  };

  const selectedLabels = selectedClassIds
    .map((cid) => classes.find((c) => c.id === cid))
    .filter(Boolean) as Class[];

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Classes assigned</Label>
      <Select onValueChange={handleAdd} value="">
        <SelectTrigger id={id} type="button" className={fieldInvalidClass(!!error)}>
          <SelectValue placeholder="Add class assignment" />
        </SelectTrigger>
        <SelectContent>
          {available.length === 0 ? (
            <SelectItem value="__none__" disabled>
              {classes.length === 0 ? 'No classes available' : 'All classes selected'}
            </SelectItem>
          ) : (
            available.map((cls) => (
              <SelectItem key={cls.id} value={cls.id}>
                {cls.className}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      <FormFieldError message={error} />
      {selectedLabels.length > 0 ? (
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedLabels.map((cls, index) => (
            <Badge key={cls.id} variant="secondary" className="flex items-center gap-1 pr-1">
              <span>{cls.className}</span>
              {index === 0 ? (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground ml-1">Main</span>
              ) : null}
              <button
                type="button"
                className="ml-1 rounded-full p-0.5 hover:bg-muted"
                onClick={() => handleRemove(cls.id)}
                aria-label={`Remove ${cls.className}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Optional — assign one or more classes. The first class is the main assignment.</p>
      )}
    </div>
  );
};

export default TeacherClassMultiSelect;
