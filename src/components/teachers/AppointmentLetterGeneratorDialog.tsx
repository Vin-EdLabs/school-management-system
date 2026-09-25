import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Save, X } from 'lucide-react';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import AppointmentLetterDocument, { type AppointmentLetterData } from './AppointmentLetterDocument';
import { appointmentLetterFilename, downloadAppointmentLetterPdf } from './appointmentLetterDownload';

type Props = {
  open: boolean;
  onClose: () => void;
  teacherId: number;
  teacherStaffId: string;
  initialLetter: AppointmentLetterData;
  checklist: Array<{ label: string; ok: boolean }>;
  onSaved?: () => void;
};

const AppointmentLetterGeneratorDialog: React.FC<Props> = ({
  open,
  onClose,
  teacherId,
  teacherStaffId,
  initialLetter,
  checklist,
  onSaved,
}) => {
  const [letter, setLetter] = useState<AppointmentLetterData>(initialLetter);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (open) {
      setLetter(initialLetter);
      setSaved(false);
    }
  }, [open, initialLetter]);

  const handleLetterChange = (updates: Partial<AppointmentLetterData>) => {
    setLetter((prev) => ({ ...prev, ...updates }));
  };

  const handleDownload = async () => {
    if (!letter) return;
    setDownloading(true);
    try {
      await downloadAppointmentLetterPdf(letter, appointmentLetterFilename(letter));
    } catch (e: unknown) {
      toast({
        title: 'Download failed',
        description: e instanceof Error ? e.message : 'Could not create the PDF. Try again.',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const savedRow = await apiService.post<{
        reference_number?: string;
        letter_content?: AppointmentLetterData;
      }>(`/teachers/${teacherId}/appointment-letters`, {
        letter_content: letter,
        pdf_data: null,
      });
      const ref = savedRow.reference_number || savedRow.letter_content?.referenceNumber || null;
      const updated: AppointmentLetterData = {
        ...(savedRow.letter_content || letter),
        referenceNumber: ref,
      };
      setLetter(updated);
      setSaved(true);
      toast({
        title: 'Appointment letter saved',
        description: ref
          ? `Reference: ${ref}. Portal login credentials are now on the letter — use Download PDF to save a copy.`
          : 'Portal login credentials are now on the letter.',
      });
      onSaved?.();
    } catch (e: unknown) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Try again',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const pendingItems = checklist.filter((c) => !c.ok);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[95dvh] overflow-y-auto p-0 gap-0">
        <div className="sticky top-0 z-10 border-b bg-white px-6 py-4">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-4">
              <span>Appointment Letter</span>
              <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          {pendingItems.length > 0 ? (
            <ul className="mt-2 text-sm text-amber-700 list-disc pl-5">
              {pendingItems.map((c) => (
                <li key={c.label}>{c.label}</li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving || saved}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save letter'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleDownload()}
              disabled={!letter || !saved || downloading}
            >
              {downloading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              {downloading ? 'Preparing…' : 'Download PDF'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Save the letter first to issue portal login credentials (Staff ID + temporary password). Then download it
            as a PDF.
          </p>
        </div>

        <div className="p-4 sm:p-6 bg-slate-100">
          <AppointmentLetterDocument data={letter} onChange={handleLetterChange} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentLetterGeneratorDialog;
