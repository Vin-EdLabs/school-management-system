import React, { useState } from 'react';
import { Loader2, Plus, Trash2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { schoolWebsiteAdminService } from '@/services/schoolWebsiteService';

const PANEL =
  'rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.05)] dark:border-slate-800 dark:bg-slate-900/70';

const EMPTY = {
  member_type: 'leadership' as const,
  position: '',
  full_name: '',
  photo_url: '',
  bio: '',
  subjectsText: '',
  is_published: true,
};

type Member = Record<string, unknown>;

function PhotoField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  return (
    <div className="flex items-center gap-4">
      <div className="relative mx-auto h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 shadow-sm dark:bg-slate-800">
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <UserRound className="h-8 w-8 text-slate-400" />
          </div>
        )}
        <div
          className="pointer-events-none absolute -bottom-1.5 -right-1.5 -z-10 h-full w-full rounded-xl border-[3px]"
          style={{ borderColor: 'rgba(201, 168, 76, 0.85)' }}
          aria-hidden
        />
      </div>
      <label className="cursor-pointer text-sm font-medium text-indigo-600 hover:underline">
        {uploading ? 'Uploading…' : 'Upload portrait photo'}
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

function MemberEditor({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
}: {
  draft: typeof EMPTY;
  setDraft: React.Dispatch<React.SetStateAction<typeof EMPTY>>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className={cn(PANEL, 'space-y-4 border-indigo-200/60 dark:border-indigo-900/40')}>
      <PhotoField value={draft.photo_url} onChange={(url) => setDraft((d) => ({ ...d, photo_url: url }))} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Full name *</Label>
          <Input value={draft.full_name} onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Role / title *</Label>
          <Input
            value={draft.position}
            onChange={(e) => setDraft((d) => ({ ...d, position: e.target.value }))}
            placeholder={
              draft.member_type === 'teacher'
                ? 'e.g. Head of Mathematics Department'
                : 'e.g. Proprietor, Headmistress, Finance Officer'
            }
          />
        </div>
      </div>
      {draft.member_type === 'teacher' && (
        <div className="space-y-2">
          <Label>Subjects (comma-separated)</Label>
          <Input
            value={draft.subjectsText}
            onChange={(e) => setDraft((d) => ({ ...d, subjectsText: e.target.value }))}
            placeholder="Mathematics, Integrated Science"
          />
        </div>
      )}
      <div className="space-y-2">
        <Label>Short bio</Label>
        <Textarea
          rows={4}
          value={draft.bio}
          onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
          placeholder="Brief professional introduction — shown as a quote on the public page…"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={draft.is_published}
          onCheckedChange={(v) => setDraft((d) => ({ ...d, is_published: v }))}
        />
        <Label className="font-normal">Published on public website</Label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={saving} onClick={() => void onSave()}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function displayRole(row: Member) {
  const role = String(row.position || '').trim();
  const legacy: Record<string, string> = {
    proprietor: 'Proprietor',
    headmaster: 'Headmaster / Headmistress',
    finance_officer: 'Finance Officer',
    administrator: 'School Administrator',
    other: 'Administrative Staff',
  };
  if (role && legacy[role.toLowerCase()]) return legacy[role.toLowerCase()];
  if (role) return role;
  return row.member_type === 'teacher' ? 'Teacher' : 'Staff';
}

export default function WebsiteManagementTeamPanel({
  members,
  onRefresh,
}: {
  members: Member[];
  onRefresh: () => Promise<void>;
}) {
  const [subTab, setSubTab] = useState<'leadership' | 'teachers'>('leadership');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const leadership = members.filter((m) => m.member_type === 'leadership');
  const teachers = members.filter((m) => m.member_type === 'teacher');
  const list = subTab === 'leadership' ? leadership : teachers;

  const startCreate = () => {
    setCreating(true);
    setEditingId(null);
    setDraft({
      ...EMPTY,
      member_type: subTab === 'leadership' ? 'leadership' : 'teacher',
      position: '',
    });
  };

  const startEdit = (row: Member) => {
    setCreating(false);
    setEditingId(Number(row.id));
    setDraft({
      member_type: row.member_type === 'teacher' ? 'teacher' : 'leadership',
      position: String(row.position || ''),
      full_name: String(row.full_name || ''),
      photo_url: String(row.photo_url || ''),
      bio: String(row.bio || ''),
      subjectsText: Array.isArray(row.subjects) ? (row.subjects as string[]).join(', ') : '',
      is_published: row.is_published !== false,
    });
  };

  const save = async () => {
    if (!draft.full_name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    if (!draft.position.trim()) {
      toast({ title: 'Role / title is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const body = {
        member_type: draft.member_type,
        position: draft.position.trim(),
        full_name: draft.full_name.trim(),
        photo_url: draft.photo_url || null,
        bio: draft.bio.trim() || null,
        subjects: draft.subjectsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        is_published: draft.is_published,
      };
      if (editingId) {
        await schoolWebsiteAdminService.updateTeamMember(editingId, body);
        toast({ title: 'Profile updated' });
      } else {
        await schoolWebsiteAdminService.createTeamMember(body);
        toast({ title: 'Profile added' });
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
    if (!window.confirm('Remove this profile from the website?')) return;
    setSaving(true);
    try {
      await schoolWebsiteAdminService.deleteTeamMember(id);
      toast({ title: 'Profile removed' });
      if (editingId === id) {
        setEditingId(null);
        setCreating(false);
      }
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Tabs value={subTab} onValueChange={(v) => setSubTab(v as 'leadership' | 'teachers')}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <TabsList className="inline-flex h-auto gap-1 rounded-xl border border-slate-200/80 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900/50">
          <TabsTrigger value="leadership" className="rounded-lg px-4 py-2 text-xs font-semibold uppercase">
            Leadership board ({leadership.length})
          </TabsTrigger>
          <TabsTrigger value="teachers" className="rounded-lg px-4 py-2 text-xs font-semibold uppercase">
            Teachers ({teachers.length})
          </TabsTrigger>
        </TabsList>
        <Button type="button" size="sm" className="gap-2 rounded-xl" onClick={startCreate}>
          <Plus className="h-4 w-4" />
          Add {subTab === 'leadership' ? 'leader' : 'teacher'}
        </Button>
      </div>

      {(creating || editingId) && (
        <MemberEditor
          draft={draft}
          setDraft={setDraft}
          onSave={save}
          onCancel={() => {
            setCreating(false);
            setEditingId(null);
          }}
          saving={saving}
        />
      )}

      <TabsContent value="leadership" className="mt-4 space-y-3">
        {list.map((row) => (
          <div key={Number(row.id)} className={cn(PANEL, 'flex flex-wrap items-center justify-between gap-3 py-4')}>
            <div>
              <p className="font-semibold">{String(row.full_name)}</p>
              <p className="text-sm text-muted-foreground">
                {displayRole(row)}
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
        {!list.length && !creating && (
          <p className="text-sm text-muted-foreground">No leadership profiles yet. Add leaders to your board with photos and roles.</p>
        )}
      </TabsContent>

      <TabsContent value="teachers" className="mt-4 space-y-3">
        {teachers.map((row) => (
          <div key={Number(row.id)} className={cn(PANEL, 'flex flex-wrap items-center justify-between gap-3 py-4')}>
            <div>
              <p className="font-semibold">{String(row.full_name)}</p>
              <p className="text-sm text-muted-foreground">
                {displayRole(row)}
                {Array.isArray(row.subjects) && (row.subjects as string[]).length
                  ? ` · ${(row.subjects as string[]).join(', ')}`
                  : ''}
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
        {!teachers.length && !creating && (
          <p className="text-sm text-muted-foreground">No teacher profiles yet. Showcase selected staff with photos and subjects.</p>
        )}
      </TabsContent>
    </Tabs>
  );
}
