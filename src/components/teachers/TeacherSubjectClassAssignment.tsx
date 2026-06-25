import React from 'react';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus } from 'lucide-react';
import type { Class } from '@/contexts/DataContext';
import type { Subject } from '@/contexts/DataContext';
import type { SubjectClassMap } from '@/types/teacherSubjectClass';

type Props = {
  subjects: Subject[];
  classes: Class[];
  selectedSubjectIds: string[];
  subjectClassMap: SubjectClassMap;
  onSelectedSubjectIdsChange: (ids: string[]) => void;
  onSubjectClassMapChange: (map: SubjectClassMap) => void;
  disabled?: boolean;
};

const TeacherSubjectClassAssignment: React.FC<Props> = ({
  subjects,
  classes,
  selectedSubjectIds,
  subjectClassMap,
  onSelectedSubjectIdsChange,
  onSubjectClassMapChange,
  disabled,
}) => {
  const availableSubjects = subjects.filter((s) => !selectedSubjectIds.includes(s.id));

  const handleAddSubject = (subjectId: string) => {
    if (!subjectId || selectedSubjectIds.includes(subjectId)) return;
    onSelectedSubjectIdsChange([...selectedSubjectIds, subjectId]);
    onSubjectClassMapChange({
      ...subjectClassMap,
      [subjectId]: subjectClassMap[subjectId]?.length ? subjectClassMap[subjectId] : [''],
    });
  };

  const handleRemoveSubject = (subjectId: string) => {
    onSelectedSubjectIdsChange(selectedSubjectIds.filter((id) => id !== subjectId));
    const next = { ...subjectClassMap };
    delete next[subjectId];
    onSubjectClassMapChange(next);
  };

  const setClassAt = (subjectId: string, index: number, classId: string) => {
    const rows = [...(subjectClassMap[subjectId] || [''])];
    rows[index] = classId;
    onSubjectClassMapChange({ ...subjectClassMap, [subjectId]: rows });
  };

  const addClassRow = (subjectId: string) => {
    const rows = [...(subjectClassMap[subjectId] || [])];
    rows.push('');
    onSubjectClassMapChange({ ...subjectClassMap, [subjectId]: rows });
  };

  const removeClassRow = (subjectId: string, index: number) => {
    const rows = [...(subjectClassMap[subjectId] || [])];
    rows.splice(index, 1);
    onSubjectClassMapChange({
      ...subjectClassMap,
      [subjectId]: rows.length ? rows : [''],
    });
  };

  const subjectLabel = (subjectId: string) =>
    subjects.find((s) => s.id === subjectId)?.name || 'Subject';

  return (
    <div className="space-y-4" id="teacher-subject-class-assignment">
      <div className="space-y-2">
        <Label>Subjects taught</Label>
        <Select onValueChange={handleAddSubject} value="" disabled={disabled || availableSubjects.length === 0}>
          <SelectTrigger type="button">
            <SelectValue
              placeholder={
                availableSubjects.length === 0
                  ? selectedSubjectIds.length
                    ? 'All subjects added'
                    : 'No subjects in catalog'
                  : 'Add subject'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {availableSubjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedSubjectIds.length > 0 ? (
          <div className="flex flex-wrap gap-2 mt-2">
            {selectedSubjectIds.map((subjectId) => (
              <Badge key={subjectId} variant="secondary" className="flex items-center gap-1 pr-1">
                <span>{subjectLabel(subjectId)}</span>
                <button
                  type="button"
                  className="ml-1 rounded-full p-0.5 hover:bg-muted"
                  onClick={() => handleRemoveSubject(subjectId)}
                  disabled={disabled}
                  aria-label={`Remove ${subjectLabel(subjectId)}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Add subjects first, then assign each subject to its class(es).</p>
        )}
      </div>

      {selectedSubjectIds.length > 0 ? (
        <div className="space-y-4 rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <p className="text-sm font-medium text-foreground">Class assignment per subject</p>
          <p className="text-xs text-muted-foreground -mt-2">
            For each subject, choose which class it is taught in. Add another row to teach the same subject in multiple classes.
          </p>

          {selectedSubjectIds.map((subjectId) => {
            const rows = subjectClassMap[subjectId]?.length
              ? subjectClassMap[subjectId]
              : [''];
            const usedElsewhere = new Set(
              rows.filter(Boolean).map(String)
            );

            return (
              <div
                key={subjectId}
                className="rounded-lg border border-border/70 bg-background/80 p-3 space-y-2"
              >
                <p className="text-sm font-semibold">{subjectLabel(subjectId)}</p>
                {rows.map((classId, index) => {
                  const takenInSubject = new Set(
                    rows.map((c, i) => (i !== index && c ? String(c) : '')).filter(Boolean)
                  );
                  const options = classes.filter(
                    (c) => !takenInSubject.has(c.id) || c.id === classId
                  );

                  return (
                    <div key={`${subjectId}-${index}`} className="flex flex-wrap items-center gap-2">
                      <Select
                        value={classId || undefined}
                        onValueChange={(v) => setClassAt(subjectId, index, v)}
                        disabled={disabled}
                      >
                        <SelectTrigger className="min-w-[200px] flex-1" type="button">
                          <SelectValue placeholder="Select class" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id}>
                              {cls.className}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {rows.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-muted-foreground"
                          onClick={() => removeClassRow(subjectId, index)}
                          disabled={disabled}
                          aria-label="Remove class row"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => addClassRow(subjectId)}
                  disabled={disabled}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add another class
                </Button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default TeacherSubjectClassAssignment;
