import React, { useMemo, useState } from 'react';
import { Search, UserCheck, GraduationCap, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface BoardingStudentOption {
  id: string;
  firstName: string;
  lastName: string;
  studentId: string;
  admissionNumber?: string;
  classAssigned?: string;
  gender?: string;
}

interface BoardingStudentSearchPickerProps {
  students: BoardingStudentOption[];
  value: string;
  onChange: (studentId: string) => void;
  label?: string;
  placeholder?: string;
}

export const BoardingStudentSearchPicker: React.FC<BoardingStudentSearchPickerProps> = ({
  students,
  value,
  onChange,
  label = 'Student',
  placeholder = 'Search by name, student ID, or admission number…',
}) => {
  const [query, setQuery] = useState('');

  const selected = useMemo(
    () => students.find((s) => String(s.id) === value) ?? null,
    [students, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students.slice(0, 50);
    return students
      .filter((s) => {
        const name = `${s.firstName} ${s.lastName}`.toLowerCase();
        return (
          name.includes(q) ||
          (s.studentId || '').toLowerCase().includes(q) ||
          (s.admissionNumber || '').toLowerCase().includes(q) ||
          (s.classAssigned || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 50);
  }, [students, query]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-3 py-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {selected.firstName} {selected.lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {selected.studentId}
              {selected.classAssigned ? ` · ${selected.classAssigned}` : ''}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-white/80 hover:text-slate-800 dark:hover:bg-slate-800"
            onClick={() => {
              onChange('');
              setQuery('');
            }}
            aria-label="Clear selected student"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="h-10 pl-9 rounded-xl"
              autoComplete="off"
            />
          </div>
          <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950/40">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">No students match your search</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-emerald-50/80 dark:hover:bg-emerald-950/20',
                        value === String(s.id) && 'bg-emerald-50 dark:bg-emerald-950/30'
                      )}
                      onClick={() => {
                        onChange(String(s.id));
                        setQuery('');
                      }}
                    >
                      <UserCheck className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {s.firstName} {s.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {s.studentId}
                          {s.admissionNumber ? ` · Adm: ${s.admissionNumber}` : ''}
                        </p>
                      </div>
                      {s.classAssigned ? (
                        <Badge variant="secondary" className="shrink-0 text-[10px] border-0 bg-slate-100 text-slate-600">
                          <GraduationCap className="h-3 w-3 mr-1 inline" />
                          {s.classAssigned}
                        </Badge>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {students.length > 50 && !query.trim() ? (
            <p className="text-[11px] text-muted-foreground">Showing first 50 students — type to search all.</p>
          ) : null}
        </>
      )}
    </div>
  );
};

export default BoardingStudentSearchPicker;
