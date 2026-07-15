import React, { useState } from 'react';
import { Loader2, Plus, Trash2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { schoolWebsiteAdminService } from '@/services/schoolWebsiteService';

const PANEL =
  'rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900/70';

const EMPTY = {
  full_name: '',
  graduation_year: '',
  photo_url: '',
  achievement: '',
  testimonial: '',
  is_published: true,
};

function PhotoField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-7 w-7 text-slate-400" />}
      </div>
      <label className="cursor-pointer text-sm font-medium text-indigo-600 hover:underline">
        {uploading ? 'Uploading…' : 'Upload photo'}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploading(true);
            void schoolWebsiteAdminService
              .uploadImage(file)
              .then((r) => onChange(r.url))
              .catch((err) =>
                toast({
                  title: 'Upload failed',
                  description: err instanceof Error ? err.message : undefined,
                  variant: 'destructive',
                })
              )
              .finally(() => setUploading(false));
          }}
        />
      </label>
    </div>
  );
}

export default function WebsiteAlumniProfilesPanel({
  profiles,
  onRefresh,
}: {
  profiles: Array<Record<string, unknown>>;
  onRefresh: () => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const startCreate = () => {
    setCreating(true);
    setEditingId(null);
    setDraft({ ...EMPTY });
  };

  const startEdit = (row: Record<string, unknown>) => {
    setCreating(false);
    setEditingId(Number(row.id));
    setDraft({
      full_name: String(row.full_name || ''),
      graduation_year: String(row.graduation_year || ''),
      photo_url: String(row.photo_url || ''),
      achievement: String(row.achievement || ''),
      testimonial: String(row.testimonial || ''),
      is_published: row.is_published !== false,
    });
  };

  const save = async () => {
    if (!draft.full_name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const body = {
        full_name: draft.full_name.trim(),
        graduation_year: draft.graduation_year.trim() || null,
        photo_url: draft.photo_url || null,
        achievement: draft.achievement.trim() || null,
        testimonial: draft.testimonial.trim() || null,
        is_published: draft.is_published,
      };
      if (editingId) {
        await schoolWebsiteAdminService.updateAlumniProfile(editingId, body);
        toast({ title: 'Alumni profile updated' });
      } else {
        await schoolWebsiteAdminService.createAlumniProfile(body);
        toast({ title: 'Alumni profile added' });
      }
      setCreating(false);
      setEditingId(null);
      await onRefresh();
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm('Remove this alumni profile?')) return;
    setSaving(true);
    try {
      await schoolWebsiteAdminService.deleteAlumniProfile(id);
      toast({ title: 'Profile removed' });
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Highlight distinguished alumni on your public Alumni page — photos, graduation years, achievements, and success stories.
        </p>
        <Button type="button" size="sm" className="gap-2 rounded-xl" onClick={startCreate}>
          <Plus className="h-4 w-4" />
          Add alumni profile
        </Button>
      </div>

      {(creating || editingId) && (
        <div className={cn(PANEL, 'space-y-4 border-indigo-200/60 dark:border-indigo-900/40')}>
          <PhotoField value={draft.photo_url} onChange={(url) => setDraft((d) => ({ ...d, photo_url: url }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Full name *</Label>
              <Input value={draft.full_name} onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Graduation year</Label>
              <Input
                value={draft.graduation_year}
                onChange={(e) => setDraft((d) => ({ ...d, graduation_year: e.target.value }))}
                placeholder="e.g. 2018"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Achievement / headline</Label>
            <Input
              value={draft.achievement}
              onChange={(e) => setDraft((d) => ({ ...d, achievement: e.target.value }))}
              placeholder="Award, career milestone, or field of excellence"
            />
          </div>
          <div className="space-y-2">
            <Label>Story or testimonial</Label>
            <Textarea
              rows={4}
              value={draft.testimonial}
              onChange={(e) => setDraft((d) => ({ ...d, testimonial: e.target.value }))}
              placeholder="Share their success story to inspire current students…"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={draft.is_published} onCheckedChange={(v) => setDraft((d) => ({ ...d, is_published: v }))} />
            <Label className="font-normal">Published on public website</Label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreating(false);
                setEditingId(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {profiles.map((row) => (
        <div key={Number(row.id)} className={cn(PANEL, 'flex flex-wrap items-center justify-between gap-3 py-4')}>
          <div>
            <p className="font-semibold">{String(row.full_name)}</p>
            <p className="text-sm text-muted-foreground">
              {row.graduation_year ? `Class of ${String(row.graduation_year)}` : 'Alumni'}
              {row.achievement ? ` · ${String(row.achievement)}` : ''}
              {row.is_published === false ? ' · Hidden' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => startEdit(row)}>
              Edit
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => void remove(Number(row.id))}>
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
      ))}

      {!profiles.length && !creating && (
        <p className="text-sm text-muted-foreground">No alumni profiles yet. Add success stories to inspire current students.</p>
      )}
    </div>
  );
}
