import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { FileText, Plus, Save, Trash2 } from 'lucide-react';

type LetterConfig = {
  bodyOpening?: string;
  bodyClosing?: string;
  clauses?: string[];
  signatoryName?: string;
  signatoryTitle?: string;
  signatureImage?: string | null;
  stampImage?: string | null;
};

const DEFAULT_OPENING = 'We are delighted to inform you that after a careful review of your application, you have been granted admission into [SCHOOL] for the academic year. This letter serves as an official notification of your admission and outlines the terms, conditions, and expectations that govern your enrolment.';
const DEFAULT_CLOSING = 'We warmly welcome you to [SCHOOL] and look forward to a productive and rewarding academic journey together. Please retain this letter for your records and present it when required for any official purpose within the school.';
const DEFAULT_CLAUSES = [
  'The student must attend all classes punctually and maintain at least 90% attendance each term to be eligible for end-of-term examinations and continuous assessment.',
  'The school uniform must be worn at all times while on school premises and during school-sanctioned activities. Students must present themselves neatly and in accordance with the school\u2019s dress code.',
  'All academic fees must be paid in full by the end of the first week of each term. Failure to comply may result in the student being barred from attending classes and writing examinations.',
  'The student is expected to uphold the highest standards of discipline, respect, and moral conduct. Bullying, insubordination, vandalism, and any form of academic dishonesty will attract severe disciplinary action, including possible suspension or expulsion.',
  'Parents or guardians must notify the school administration in writing at least two weeks in advance of any planned absence. Medical certificates must be provided for illness-related absences exceeding three consecutive days.',
  'The school reserves the right to review and amend these terms as necessary. Parents and guardians will be notified of any changes at least one term before they take effect.',
];

const AdmissionLetterSettings = () => {
  const [config, setConfig] = useState<LetterConfig>({
    bodyOpening: DEFAULT_OPENING,
    bodyClosing: DEFAULT_CLOSING,
    clauses: [...DEFAULT_CLAUSES],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const data = await apiService.get<LetterConfig>('/settings/admission-letter');
        setConfig({
          bodyOpening: DEFAULT_OPENING,
          bodyClosing: DEFAULT_CLOSING,
          clauses: [...DEFAULT_CLAUSES],
          ...data,
        });
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

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-purple-600" />
            Admission Letter Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Customise the content of student admission letters. Leave fields empty to use defaults.
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Body Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
    </div>
  );
};

export default AdmissionLetterSettings;
