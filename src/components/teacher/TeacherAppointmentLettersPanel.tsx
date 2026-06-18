import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Printer, Eye, FileText } from 'lucide-react';
import { apiService } from '@/services/api';
import { useSchool } from '@/contexts/SchoolContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatDisplayDate } from '@/utils/dateFormat';
import { toast } from '@/hooks/use-toast';
import LazyTeacherAvatar from '../teachers/LazyTeacherAvatar';
import AppointmentLetterDocument, { type AppointmentLetterData, printAppointmentLetter } from '../teachers/AppointmentLetterDocument';

export type AppointmentLetterRow = {
  id: number;
  version_number: number;
  reference_number?: string;
  position_title?: string;
  generated_at: string;
  has_pdf?: boolean;
};

type TeacherInfo = {
  id: number;
  full_name: string;
  staff_id: string;
  has_passport_photo?: boolean;
  passport_photo_url?: string | null;
};

type Props = {
  compact?: boolean;
  teacher?: TeacherInfo | null;
};

const TeacherAppointmentLettersPanel: React.FC<Props> = ({ compact = false, teacher: teacherProp }) => {
  const { schoolId } = useSchool();
  const { user } = useAuth();
  const [teacher, setTeacher] = useState<TeacherInfo | null>(teacherProp ?? null);
  const [letters, setLetters] = useState<AppointmentLetterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [previewLetter, setPreviewLetter] = useState<AppointmentLetterData | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoadingId, setPreviewLoadingId] = useState<number | null>(null);

  const loadLetters = useCallback(async () => {
    setLoading(true);
    try {
      const [profRes, lettersRes] = await Promise.all([
        teacherProp ? Promise.resolve(teacherProp) : apiService.get<TeacherInfo>('/teachers/me').catch(() => null),
        apiService.get<AppointmentLetterRow[]>('/teachers/me/appointment-letters').catch(() => []),
      ]);
      if (!teacherProp && profRes) setTeacher(profRes);
      setLetters(Array.isArray(lettersRes) ? lettersRes : []);
    } catch {
      setLetters([]);
    } finally {
      setLoading(false);
    }
  }, [teacherProp]);

  useEffect(() => {
    if (schoolId != null) apiService.setTenantContext(schoolId);
  }, [schoolId]);

  useEffect(() => {
    void loadLetters();
  }, [loadLetters, schoolId]);

  const fetchLetterContent = async (letter: AppointmentLetterRow): Promise<AppointmentLetterData | null> => {
    const teacherId = teacher?.id;
    if (!teacherId) return null;
    const res = await apiService.get<{ letter_content?: AppointmentLetterData }>(
      `/teachers/me/appointment-letters/${letter.id}/download`
    );
    return res.letter_content || null;
  };

  const printLetter = async (letter: AppointmentLetterRow) => {
    if (!teacher) return;
    setDownloadingId(letter.id);
    try {
      const res = await apiService.get<{ letter_content?: AppointmentLetterData }>(
        `/teachers/me/appointment-letters/${letter.id}/download`
      );
      if (res.letter_content) {
        setPreviewLetter(res.letter_content);
        setPreviewOpen(true);
        setTimeout(() => { printAppointmentLetter(); }, 800);
        return;
      }
      toast({ title: 'Print unavailable', description: 'Could not load the letter.', variant: 'destructive' });
    } catch (e: unknown) {
      toast({
        title: 'Print failed',
        description: e instanceof Error ? e.message : 'Try again later',
        variant: 'destructive',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const previewLetterDoc = async (letter: AppointmentLetterRow) => {
    setPreviewLoadingId(letter.id);
    try {
      const content = await fetchLetterContent(letter);
      if (!content) {
        toast({ title: 'Preview unavailable', variant: 'destructive' });
        return;
      }
      setPreviewLetter(content);
      setPreviewOpen(true);
    } catch {
      toast({ title: 'Preview failed', variant: 'destructive' });
    } finally {
      setPreviewLoadingId(null);
    }
  };

  const hasPhoto =
    teacher?.has_passport_photo ??
    !!(teacher?.passport_photo_url && teacher.passport_photo_url.length > 0);

  const sortedLetters = [...letters].sort((a, b) => b.version_number - a.version_number);

  const listBody = () => {
    if (loading) {
      return <p className="text-sm text-muted-foreground animate-pulse">Loading appointment letters…</p>;
    }
    if (sortedLetters.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          No appointment letter has been issued yet. Contact your administrator.
        </p>
      );
    }
    return (
      <ul className="space-y-3">
        {sortedLetters.map((letter) => (
          <li
            key={letter.id}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div className="flex items-start gap-3 min-w-0">
              {teacher ? (
                <LazyTeacherAvatar
                  teacherId={String(teacher.id)}
                  fullName={teacher.full_name}
                  hasPassportPhoto={hasPhoto}
                  className="h-10 w-10 shrink-0"
                  eager
                />
              ) : null}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">
                    Version {letter.version_number}
                    {letter.reference_number ? ` · ${letter.reference_number}` : ''}
                  </p>
                  {letter.version_number === sortedLetters[0]?.version_number ? (
                    <Badge variant="secondary" className="text-xs">
                      Latest
                    </Badge>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  Issued {formatDisplayDate(letter.generated_at)}
                  {letter.position_title ? ` · ${letter.position_title}` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5"
                disabled={previewLoadingId === letter.id}
                onClick={() => void previewLetterDoc(letter)}
              >
                <Eye className="h-4 w-4" />
                {previewLoadingId === letter.id ? 'Loading…' : 'Preview'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={downloadingId === letter.id}
                onClick={() => void printLetter(letter)}
              >
                <Printer className="h-4 w-4" />
                {downloadingId === letter.id ? 'Loading…' : 'Print'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  if (compact) {
    return (
      <>
        {listBody()}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[95dvh] overflow-y-auto p-0">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>Appointment Letter Preview</DialogTitle>
            </DialogHeader>
            <div className="p-4 sm:p-6 bg-slate-100">
              {previewLetter ? <AppointmentLetterDocument data={previewLetter} userRole={user?.role} /> : null}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Appointment Letters
            {sortedLetters.length > 0 ? (
              <Badge variant="outline" className="ml-1 font-normal">
                {sortedLetters.length} version{sortedLetters.length === 1 ? '' : 's'}
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>{listBody()}</CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[95dvh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Appointment Letter Preview</DialogTitle>
          </DialogHeader>
          <div className="p-4 sm:p-6 bg-slate-100">
            {previewLetter ? <AppointmentLetterDocument data={previewLetter} userRole={user?.role} /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TeacherAppointmentLettersPanel;
