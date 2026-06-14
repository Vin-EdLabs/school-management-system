
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { User, Mail, Phone, MapPin, Calendar, Briefcase, DollarSign, FileText, Ban, UserX, UserCheck } from 'lucide-react';
import { formatDisplayDate } from '../../utils/dateFormat';
import type { Teacher } from '../../contexts/DataContext';
import LazyTeacherAvatar from './LazyTeacherAvatar';
import { TeacherStatusModals, teacherStatusBadge } from './TeacherStatusModals';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import {
  type AppointmentLetterData,
} from './AppointmentLetterDocument';
import AppointmentLetterGeneratorDialog from './AppointmentLetterGeneratorDialog';
import { useData } from '../../contexts/DataContext';

interface TeacherDetailsDialogProps {
  teacher: Teacher | null;
  open: boolean;
  onClose: () => void;
}

const TeacherDetailsDialog: React.FC<TeacherDetailsDialogProps> = ({
  teacher,
  open,
  onClose,
}) => {
  const { user } = useAuth();
  const { refresh } = useData();
  const isAdmin = user?.role === 'super-admin' || user?.role === 'administrator';
  const [statusMode, setStatusMode] = useState<'suspend' | 'deactivate' | 'reactivate' | null>(null);
  const [checklist, setChecklist] = useState<Array<{ label: string; ok: boolean }>>([]);
  const [letters, setLetters] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [letterPreview, setLetterPreview] = useState<AppointmentLetterData | null>(null);
  const [showLetterGenerator, setShowLetterGenerator] = useState(false);

  const status = teacher?.status || 'active';
  const badge = teacher ? teacherStatusBadge(status) : null;

  useEffect(() => {
    if (!open || !teacher || !isAdmin) return;
    void (async () => {
      try {
        const [check, list] = await Promise.all([
          apiService.get<{ checklist: Array<{ label: string; ok: boolean }> }>(
            `/teachers/${teacher.id}/appointment-letters/checklist`
          ),
          apiService.get<any[]>(`/teachers/${teacher.id}/appointment-letters`),
        ]);
        setChecklist(check.checklist || []);
        setLetters(Array.isArray(list) ? list : []);
      } catch {
        setChecklist([]);
        setLetters([]);
      }
    })();
  }, [open, teacher, isAdmin]);

  if (!teacher) return null;

  const generateLetter = async () => {
    setGenerating(true);
    try {
      const check = await apiService.get<{
        checklist: Array<{ label: string; ok: boolean }>;
        ready: boolean;
        letter?: AppointmentLetterData;
      }>(`/teachers/${teacher.id}/appointment-letters/checklist`);

      setChecklist(check.checklist || []);
      if (!check.ready || !check.letter) {
        toast({
          title: 'Cannot generate letter',
          description: 'Complete all checklist items and appointment letter settings first.',
          variant: 'destructive',
        });
        return;
      }

      setLetterPreview(check.letter);
      setShowLetterGenerator(true);
    } catch (e: unknown) {
      toast({
        title: 'Generation failed',
        description: e instanceof Error ? e.message : 'Try again',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const refreshLetters = async () => {
    if (!teacher) return;
    const list = await apiService.get<any[]>(`/teachers/${teacher.id}/appointment-letters`);
    setLetters(Array.isArray(list) ? list : []);
  };

  const onStatusSuccess = async () => {
    await refresh(['teachers']);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <LazyTeacherAvatar teacherId={teacher.id} fullName={teacher.fullName} hasPassportPhoto={teacher.hasPassportPhoto} eager />
              <span>Teacher Profile</span>
              {badge ? <Badge className={badge.className}>{badge.label}</Badge> : null}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Full Name</label>
                <p className="text-base">{teacher.fullName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Staff ID</label>
                <p className="text-base font-mono">{teacher.staffId}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center space-x-2"><Phone className="w-4 h-4 text-gray-500" /><span>{teacher.phoneNumber}</span></div>
              <div className="flex items-center space-x-2"><Mail className="w-4 h-4 text-gray-500" /><span>{teacher.email}</span></div>
              <div className="flex items-start space-x-2"><MapPin className="w-4 h-4 text-gray-500 mt-1" /><span>{teacher.address}</span></div>
            </div>

            <Separator />

            <div>
              <label className="text-sm font-medium text-gray-500">Subjects</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {teacher.subjectsTaught.map((subject, index) => (
                  <Badge key={index} variant="secondary">{subject}</Badge>
                ))}
              </div>
              <p className="mt-2 text-sm">Class: {teacher.classAssigned || 'No class assigned'}</p>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <div>
                  <label className="text-sm font-medium text-gray-500">Employment Date</label>
                  <p>{formatDisplayDate(teacher.employmentDate)}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-gray-500" />
                <div>
                  <label className="text-sm font-medium text-gray-500">Monthly Salary</label>
                  <p className="font-mono">
                    {teacher.monthlySalary > 0 ? `GHS ${teacher.monthlySalary.toLocaleString()}` : 'Not set'}
                  </p>
                </div>
              </div>
            </div>

            {isAdmin && (
              <>
                <Separator />
                <div className="flex flex-wrap gap-2">
                  {status === 'active' && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setStatusMode('suspend')}>
                        <Ban className="h-4 w-4 mr-1" /> Suspend
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setStatusMode('deactivate')}>
                        <UserX className="h-4 w-4 mr-1" /> Deactivate
                      </Button>
                    </>
                  )}
                  {status !== 'active' && (
                    <Button variant="outline" size="sm" onClick={() => setStatusMode('reactivate')}>
                      <UserCheck className="h-4 w-4 mr-1" /> Reactivate
                    </Button>
                  )}
                </div>

                <Separator />
                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4" /> Appointment Letter
                  </h3>
                  {checklist.some((c) => !c.ok) && (
                    <ul className="text-sm text-amber-700 mb-2 list-disc pl-5">
                      {checklist.filter((c) => !c.ok).map((c) => (
                        <li key={c.label}>{c.label}</li>
                      ))}
                    </ul>
                  )}
                  <Button size="sm" onClick={generateLetter} disabled={generating}>
                    {generating ? 'Loading…' : 'Generate Appointment Letter'}
                  </Button>
                  {letters.length > 0 && (
                    <ul className="mt-3 text-sm space-y-1">
                      {letters.map((l) => (
                        <li key={l.id}>
                          v{l.version_number} — {formatDisplayDate(l.generated_at)} — {l.position_title}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <TeacherStatusModals
        teacher={teacher}
        mode={statusMode}
        onClose={() => setStatusMode(null)}
        onSuccess={onStatusSuccess}
      />

      {letterPreview && (
        <AppointmentLetterGeneratorDialog
          open={showLetterGenerator}
          onClose={() => setShowLetterGenerator(false)}
          teacherId={teacher.id}
          teacherStaffId={teacher.staffId}
          initialLetter={letterPreview}
          checklist={checklist}
          onSaved={() => void refreshLetters()}
        />
      )}
    </>
  );
};

export default TeacherDetailsDialog;
