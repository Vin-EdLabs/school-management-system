import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiService } from '@/services/api';
import { Loader2 } from 'lucide-react';

export type AssignableParentTeacher = {
  id: number;
  full_name: string;
  staff_id: string;
  position?: string | null;
};

type ParentTeacherSelectProps = {
  excludeTeacherId?: string;
  value: string;
  onChange: (parentTeacherId: string) => void;
  disabled?: boolean;
};

const ParentTeacherSelect: React.FC<ParentTeacherSelectProps> = ({
  excludeTeacherId,
  value,
  onChange,
  disabled,
}) => {
  const [options, setOptions] = useState<AssignableParentTeacher[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const q = excludeTeacherId ? `?exclude_id=${encodeURIComponent(excludeTeacherId)}` : '';
    void apiService
      .get<AssignableParentTeacher[]>(`/teachers/assignable-parents${q}`)
      .then((rows) => {
        if (!cancelled) setOptions(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [excludeTeacherId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (t) =>
        t.full_name.toLowerCase().includes(q) ||
        t.staff_id.toLowerCase().includes(q) ||
        (t.position || '').toLowerCase().includes(q)
    );
  }, [options, search]);

  return (
    <div className="space-y-2 rounded-2xl border border-border/80 bg-muted/20 p-4">
      <Label className="text-sm font-medium">Assign as assistant under another teacher</Label>
      <p className="text-xs text-muted-foreground">
        Optional. Only active main teachers appear here. Leave empty for a main teacher.
      </p>
      <Input
        placeholder="Search by name or staff ID…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        disabled={disabled || loading}
      />
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading teachers…
        </div>
      ) : (
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">— Main teacher (no parent) —</option>
          {filtered.map((t) => (
            <option key={t.id} value={String(t.id)}>
              {t.full_name} ({t.staff_id})
              {t.position ? ` — ${t.position}` : ''}
            </option>
          ))}
        </select>
      )}
      {!loading && filtered.length === 0 && search.trim() ? (
        <p className="text-xs text-muted-foreground">No matching main teachers.</p>
      ) : null}
    </div>
  );
};

export default ParentTeacherSelect;
