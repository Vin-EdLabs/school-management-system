import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { useSchool } from '@/contexts/SchoolContext';
import { FileText, Plus, Save, Trash2, Eye } from 'lucide-react';
import AdmissionLetterDocument, { type AdmissionLetterData } from '@/components/students/AdmissionLetterDocument';

type LetterConfig = {
  bodyOpening?: string;
  bodyClosing?: string;
  clauses?: string[];
};

type AppointmentConfig = {
  signatoryName?: string;
  signatoryTitle?: string;
  signatureImage?: string | null;
  stampImage?: string | null;
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

const DEFAULT_OPENING =
  'We are delighted to inform you that after a careful review of your application, you have been granted admission into [SCHOOL] for the academic year. This letter serves as an official notification of your admission and outlines the terms, conditions, and expectations that govern your enrolment.';
const DEFAULT_CLOSING =
  'We warmly welcome you to [SCHOOL] and look forward to a productive and rewarding academic journey together. Please retain this letter for your records and present it when required for any official purpose within the school.';
const DEFAULT_CLAUSES = [
  'The student must attend all classes punctually and maintain at least 90% attendance each term to be eligible for end-of-term examinations and continuous assessment.',
  'The school uniform must be worn at all times while on school premises and during school-sanctioned activities. Students must present themselves neatly and in accordance with the school\u2019s dress code.',
  'All academic fees must be paid in full by the end of the first week of each term. Failure to comply may result in the student being barred from attending classes and writing examinations.',
  'The student is expected to uphold the highest standards of discipline, respect, and moral conduct. Bullying, insubordination, vandalism, and any form of academic dishonesty will attract severe disciplinary action, including possible suspension or expulsion.',
  'Parents or guardians must notify the school administration in writing at least two weeks in advance of any planned absence. Medical certificates must be provided for illness-related absences exceeding three consecutive days.',
  'The school reserves the right to review and amend these terms as necessary. Parents and guardians will be notified of any changes at least one term before they take effect.',
];

const PREVIEW_STUDENT_PHOTO = '/placeholder.svg';

function replaceSchoolPlaceholder(text: string, schoolName: string): string {
  return text.replace(/\[SCHOOL\]/g, schoolName);
}

function resolveSchoolAddress(settings: SchoolSettings | null): string {
  if (!settings) return '';
  return (
    settings.physical_address ||
    settings.address ||
    settings.postal_address ||
    ''
  );
}

function resolveSchoolPhone(settings: SchoolSettings | null): string {
  if (!settings) return '';
  return settings.contact_phone || settings.phone_number || settings.contact || '';
}

const AdmissionLetterSettings = () => {
  const { school } = useSchool();
  const [config, setConfig] = useState<LetterConfig>({
    bodyOpening: DEFAULT_OPENING,
    bodyClosing: DEFAULT_CLOSING,
    clauses: [...DEFAULT_CLAUSES],
  });
  const [appointmentConfig, setAppointmentConfig] = useState<AppointmentConfig>({});
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const [data, appt, settings] = await Promise.all([
          apiService.get<LetterConfig>('/settings/admission-letter'),
          apiService.get<AppointmentConfig>('/settings/appointment-letter').catch(() => ({})),
          apiService.get<SchoolSettings>('/settings').catch(() => null),
        ]);
        setConfig({
          bodyOpening: DEFAULT_OPENING,
          bodyClosing: DEFAULT_CLOSING,
          clauses: [...DEFAULT_CLAUSES],
          ...data,
        });
        setAppointmentConfig(appt || {});
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
      await apiService.put('/settings/admission-letter', config);
      toast({ title: 'Admission letter settings saved' });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const schoolName = schoolSettings?.school_name || school?.name || 'Your School';
  const previewData = useMemo<AdmissionLetterData>(() => {
    const opening = replaceSchoolPlaceholder(config.bodyOpening || DEFAULT_OPENING, schoolName);
    const closing = replaceSchoolPlaceholder(config.bodyClosing || DEFAULT_CLOSING, schoolName);
    const clauses = (config.clauses && config.clauses.length > 0 ? config.clauses : DEFAULT_CLAUSES).filter(
      (c) => c.trim()
    );
    const today = new Date();
    const admissionDate = today.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return {
      referenceNumber: `ADM/${today.getFullYear()}/PREVIEW`,
      versionNumber: 1,
      student: {
        id: 0,
        fullName: 'John A. Mensah',
        studentId: 'STU-2026-001',
        admissionNumber: 'ADM-2026-001',
        className: 'Primary 4',
        admissionDate,
        photoUrl: PREVIEW_STUDENT_PHOTO,
      },
      school: {
        name: schoolName,
        address: resolveSchoolAddress(schoolSettings),
        phone: resolveSchoolPhone(schoolSettings),
        email: schoolSettings?.email || '',
        logoUrl: schoolSettings?.logo_url || school?.logo_url || null,
      },
      bodyOpening: opening,
      bodyClosing: closing,
      clauses,
      config: {
        signatoryName: appointmentConfig.signatoryName || 'Headmaster Name',
        signatoryTitle: appointmentConfig.signatoryTitle || 'Headmaster',
        signatureImage: appointmentConfig.signatureImage || null,
        stampImage: appointmentConfig.stampImage || null,
      },
    };
  }, [config, appointmentConfig, school, schoolSettings, schoolName]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-purple-600" />
            Admission Letter Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Customise admission letter content. Signature and stamp come from Appointment Letter settings.
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
              <CardTitle className="text-base">Body Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Use <code className="rounded bg-muted px-1">[SCHOOL]</code> — replaced with your school name in letters.
              </p>
              <div className="space-y-2">
                <Label>Opening Paragraph</Label>
                <Textarea
                  value={config.bodyOpening || ''}
                  onChange={(e) => setConfig((c) => ({ ...c, bodyOpening: e.target.value }))}
                  placeholder="We are delighted to inform you…"
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>Closing Paragraph</Label>
                <Textarea
                  value={config.bodyClosing || ''}
                  onChange={(e) => setConfig((c) => ({ ...c, bodyClosing: e.target.value }))}
                  placeholder="We warmly welcome you…"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Terms &amp; Conditions Clauses</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfig((c) => ({ ...c, clauses: [...(c.clauses || []), ''] }))}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Clause
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {(config.clauses || []).length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No clauses defined. Default clauses will be used.</p>
              ) : (
                (config.clauses || []).map((clause, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <span className="text-sm font-bold mt-2 min-w-[1.5rem]">{idx + 1}.</span>
                    <Textarea
                      value={clause}
                      onChange={(e) => {
                        const next = [...(config.clauses || [])];
                        next[idx] = e.target.value;
                        setConfig((c) => ({ ...c, clauses: next }));
                      }}
                      rows={2}
                      placeholder="Enter clause text…"
                      className="flex-1"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="shrink-0 mt-1"
                      onClick={() => {
                        const next = (config.clauses || []).filter((_, i) => i !== idx);
                        setConfig((c) => ({ ...c, clauses: next }));
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Signature &amp; stamp</p>
              <p>
                The headmaster signature, school stamp, and signatory name are taken from{' '}
                <span className="font-medium text-foreground">Appointment Letter Configuration</span> in Settings.
                Update them there to change what appears on admission letters.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3 xl:sticky xl:top-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Eye className="h-4 w-4" />
            Live preview (sample student)
          </div>
          <div className="rounded-xl border bg-slate-100/80 dark:bg-slate-900/40 p-3 sm:p-4 overflow-auto max-h-[calc(100vh-8rem)]">
            <AdmissionLetterDocument data={previewData} id="admission-letter-settings-preview" className="shadow-xl" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdmissionLetterSettings;
