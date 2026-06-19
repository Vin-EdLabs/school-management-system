import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { useSchool } from '@/contexts/SchoolContext';
import { FileText, Plus, Save, Trash2, Eye } from 'lucide-react';
import AppointmentLetterDocument, {
  type AppointmentLetterData,
} from '@/components/teachers/AppointmentLetterDocument';

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
  signatureImage?: string | null;
};

type SchoolSettings = {
  school_name?: string;
  physical_address?: string;
  address?: string;
  postal_address?: string;
  contact_phone?: string;
  phone_number?: string;
  contact?: string;
  email?: string;
  logo_url?: string;
};

const DEFAULT_OPENING = 'We are pleased to offer you employment at [SCHOOL] under the following terms and conditions:';
const DEFAULT_CLOSING = 'Please sign and return a copy of this letter to indicate your acceptance of these terms.';
const PREVIEW_TEACHER_PHOTO = '/placeholder.svg';

function replaceSchoolPlaceholder(text: string, schoolName: string): string {
  return text.replace(/\[SCHOOL\]/g, schoolName);
}

function resolveSchoolAddress(settings: SchoolSettings | null): string {
  if (!settings) return '';
  return settings.physical_address || settings.address || settings.postal_address || '';
}

function resolveSchoolPhone(settings: SchoolSettings | null): string {
  if (!settings) return '';
  return settings.contact_phone || settings.phone_number || settings.contact || '';
}

function todayString(): string {
  const d = new Date();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

const AppointmentLetterSettings = () => {
  const { school } = useSchool();
  const [config, setConfig] = useState<LetterConfig>({ customClauses: [] });
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [data, settings] = await Promise.all([
          apiService.get<LetterConfig>('/settings/appointment-letter'),
          apiService.get<SchoolSettings>('/settings').catch(() => null),
        ]);
        setConfig({ customClauses: [], ...data });
        setSchoolSettings(settings);
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

  const schoolName = schoolSettings?.school_name || school?.name || 'Your School';

  const previewData = useMemo<AppointmentLetterData>(() => {
    const opening = replaceSchoolPlaceholder(config.bodyOpening ?? DEFAULT_OPENING, schoolName);
    const closing = replaceSchoolPlaceholder(config.bodyClosing ?? DEFAULT_CLOSING, schoolName);
    const employmentDate = todayString();

    return {
      referenceNumber: `APT/${new Date().getFullYear()}/PREVIEW`,
      versionNumber: 1,
      generatedDate: employmentDate,
      letterDate: employmentDate,
      school: {
        name: schoolName,
        address: resolveSchoolAddress(schoolSettings),
        phone: resolveSchoolPhone(schoolSettings),
        email: schoolSettings?.email || '',
        logoUrl: schoolSettings?.logo_url || school?.logo_url || null,
      },
      teacher: {
        fullName: 'Grace A. Osei',
        staffId: 'TCH-2026-042',
        photoUrl: PREVIEW_TEACHER_PHOTO,
        signature: null,
        employmentDate,
        monthlySalary: 2500,
        className: 'Primary 5',
        subjects: ['Mathematics', 'Integrated Science'],
      },
      positionTitle: 'Class Teacher',
      department: 'Primary Department',
      employmentType: 'Full-time',
      terms: {
        position: 'Class Teacher',
        department: 'Primary Department',
        startDate: employmentDate,
        employmentType: 'Full-time',
        probationPeriod: config.probationPeriod || 'Three months',
        monthlySalary: 2500,
        workingHours: config.workingHours || '7:00am – 3:00pm, Monday to Friday',
        leaveEntitlement: config.leaveEntitlement || '14 working days per year',
        noticePeriod: config.noticePeriod || 'One month written notice',
      },
      bodyOpening: opening,
      bodyClosing: closing,
      config: {
        signatoryName: config.signatoryName || 'Headmaster Name',
        signatoryTitle: config.signatoryTitle || 'Headmaster',
        workingHours: config.workingHours,
        leaveEntitlement: config.leaveEntitlement,
        noticePeriod: config.noticePeriod,
        probationPeriod: config.probationPeriod,
        customClauses: (config.customClauses || []).filter((c) => c.trim()),
        signatureImage: config.signatureImage || null,
        stampImage: config.stampImage || null,
      },
    };
  }, [config, school, schoolSettings, schoolName]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-emerald-600" />
            Appointment Letter Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure terms, body text, signature and stamp used for every teacher appointment letter.
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2 items-start">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Signatory &amp; employment terms</CardTitle>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Letter body text</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Use <code className="rounded bg-muted px-1">[SCHOOL]</code> — replaced with your school name when generated.
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Custom clauses</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfig((c) => ({ ...c, customClauses: [...(c.customClauses || []), ''] }))}
              >
                <Plus className="h-4 w-4 mr-1" /> Add clause
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Signature &amp; stamp</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>School stamp / seal</Label>
                <Input type="file" accept="image/*" onChange={(e) => onStampFile(e.target.files?.[0])} />
                {config.stampImage ? (
                  <div className="relative inline-block mt-1">
                    <img src={config.stampImage} alt="Stamp preview" className="h-16 object-contain border rounded" />
                    <button
                      type="button"
                      onClick={() => setConfig((c) => ({ ...c, stampImage: null }))}
                      className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-0.5 text-[8px] hover:bg-red-200"
                    >
                      ✕
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Headmaster / admin signature</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => setConfig((c) => ({ ...c, signatureImage: String(reader.result) }));
                    reader.readAsDataURL(file);
                  }}
                />
                {config.signatureImage ? (
                  <div className="relative inline-block mt-1">
                    <img src={config.signatureImage} alt="Signature preview" className="h-12 object-contain border rounded" />
                    <button
                      type="button"
                      onClick={() => setConfig((c) => ({ ...c, signatureImage: null }))}
                      className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-0.5 text-[8px] hover:bg-red-200"
                    >
                      ✕
                    </button>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3 xl:sticky xl:top-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Eye className="h-4 w-4" />
            Live preview (sample teacher)
          </div>
          <div className="rounded-xl border bg-slate-100/80 dark:bg-slate-900/40 p-3 sm:p-4 overflow-auto max-h-[calc(100vh-8rem)]">
            <AppointmentLetterDocument
              data={previewData}
              id="appointment-letter-settings-preview"
              className="shadow-xl"
              readOnly
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentLetterSettings;
