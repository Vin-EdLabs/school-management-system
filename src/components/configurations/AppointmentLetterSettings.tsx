import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { FileText, Plus, Save, Trash2 } from 'lucide-react';

type LetterConfig = {
  signatoryName?: string;
  signatoryTitle?: string;
  workingHours?: string;
  leaveEntitlement?: string;
  noticePeriod?: string;
  probationPeriod?: string;
  bodyOpening?: string;
  bodyClosing?: string;
  customClauses?: string[];
  stampImage?: string | null;
};

const DEFAULT_OPENING = 'We are pleased to offer you employment at [SCHOOL] under the following terms and conditions:';
const DEFAULT_CLOSING = 'Please sign and return a copy of this letter to indicate your acceptance of these terms.';

const AppointmentLetterSettings = () => {
  const [config, setConfig] = useState<LetterConfig>({
    customClauses: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await apiService.get<LetterConfig>('/settings/appointment-letter');
        setConfig({ customClauses: [], ...data });
      } catch {
        toast({ title: 'Could not load settings', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await apiService.put('/settings/appointment-letter', config);
      toast({ title: 'Appointment letter settings saved' });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const onStampFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setConfig((c) => ({ ...c, stampImage: String(reader.result) }));
    };
    reader.readAsDataURL(file);
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Appointment Letter Configuration
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Used for every appointment letter generated for teachers.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Signatory full name</Label>
            <Input
              value={config.signatoryName || ''}
              onChange={(e) => setConfig((c) => ({ ...c, signatoryName: e.target.value }))}
              placeholder="Mr. Kwame Mensah"
            />
          </div>
          <div className="space-y-2">
            <Label>Signatory title</Label>
            <Input
              value={config.signatoryTitle || ''}
              onChange={(e) => setConfig((c) => ({ ...c, signatoryTitle: e.target.value }))}
              placeholder="Headmaster"
            />
          </div>
          <div className="space-y-2">
            <Label>Working hours</Label>
            <Input
              value={config.workingHours || ''}
              onChange={(e) => setConfig((c) => ({ ...c, workingHours: e.target.value }))}
              placeholder="7:00am - 3:00pm Monday to Friday"
            />
          </div>
          <div className="space-y-2">
            <Label>Leave entitlement</Label>
            <Input
              value={config.leaveEntitlement || ''}
              onChange={(e) => setConfig((c) => ({ ...c, leaveEntitlement: e.target.value }))}
              placeholder="14 working days per year"
            />
          </div>
          <div className="space-y-2">
            <Label>Notice period</Label>
            <Input
              value={config.noticePeriod || ''}
              onChange={(e) => setConfig((c) => ({ ...c, noticePeriod: e.target.value }))}
              placeholder="One month written notice"
            />
          </div>
          <div className="space-y-2">
            <Label>Probation period</Label>
            <Input
              value={config.probationPeriod || ''}
              onChange={(e) => setConfig((c) => ({ ...c, probationPeriod: e.target.value }))}
              placeholder="Three months"
            />
          </div>
        </div>

        <div className="space-y-4 border-t pt-4">
          <h3 className="text-sm font-semibold">Letter body text</h3>
          <p className="text-xs text-muted-foreground">
            Use <code className="rounded bg-muted px-1">[SCHOOL]</code> as a placeholder — it is replaced with the school name when the letter is generated.
          </p>
          <div className="space-y-2">
            <Label htmlFor="bodyOpening">Opening paragraph</Label>
            <Textarea
              id="bodyOpening"
              rows={3}
              value={config.bodyOpening ?? DEFAULT_OPENING}
              onChange={(e) => setConfig((c) => ({ ...c, bodyOpening: e.target.value }))}
              placeholder={DEFAULT_OPENING}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bodyClosing">Closing paragraph</Label>
            <Textarea
              id="bodyClosing"
              rows={3}
              value={config.bodyClosing ?? DEFAULT_CLOSING}
              onChange={(e) => setConfig((c) => ({ ...c, bodyClosing: e.target.value }))}
              placeholder={DEFAULT_CLOSING}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Custom clauses (optional paragraphs)</Label>
          {(config.customClauses || []).map((clause, idx) => (
            <div key={idx} className="flex gap-2">
              <Textarea
                value={clause}
                onChange={(e) => {
                  const next = [...(config.customClauses || [])];
                  next[idx] = e.target.value;
                  setConfig((c) => ({ ...c, customClauses: next }));
                }}
                rows={2}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() =>
                  setConfig((c) => ({
                    ...c,
                    customClauses: (c.customClauses || []).filter((_, i) => i !== idx),
                  }))
                }
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setConfig((c) => ({ ...c, customClauses: [...(c.customClauses || []), ''] }))
            }
          >
            <Plus className="h-4 w-4 mr-1" /> Add clause
          </Button>
        </div>

        <div className="space-y-2">
          <Label>School stamp / seal (optional)</Label>
          <Input type="file" accept="image/*" onChange={(e) => onStampFile(e.target.files?.[0])} />
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving…' : 'Save configuration'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AppointmentLetterSettings;
