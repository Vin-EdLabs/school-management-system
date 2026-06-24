
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, detailDialogContentWideClass, detailDialogHeaderClass, detailDialogBodyClass, detailDialogFooterClass, DetailField } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { User, Mail, Phone, MapPin, FileText, Ban, UserX, UserCheck, Trash2 } from 'lucide-react';
import { formatDisplayDate } from '../../utils/dateFormat';
import type { Teacher } from '../../contexts/DataContext';
import LazyTeacherAvatar from './LazyTeacherAvatar';
import StaffPhotoLightbox from '../staff/StaffPhotoLightbox';
import { TeacherStatusModals, teacherStatusBadge } from './TeacherStatusModals';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import {
  type AppointmentLetterData,
} from './AppointmentLetterDocument';
import AppointmentLetterGeneratorDialog from './AppointmentLetterGeneratorDialog';
import { useData } from '../../contexts/DataContext';
import StaffDeleteConfirmDialog from '../common/StaffDeleteConfirmDialog';
import TeacherStatusHistory from './TeacherStatusHistory';

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
  const { refresh, deleteTeacher } = useData();
  const isAdmin = user?.role === 'super-admin' || user?.role === 'administrator';
  const [statusMode, setStatusMode] = useState<'suspend' | 'deactivate' | 'reactivate' | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checklist, setChecklist] = useState<Array<{ label: string; ok: boolean }>>([]);
  const [letters, setLetters] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [letterPreview, setLetterPreview] = useState<AppointmentLetterData | null>(null);
  const [showLetterGenerator, setShowLetterGenerator] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

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

  useEffect(() => {
    if (!open || !teacher?.hasPassportPhoto) {
      setPhotoUrl(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiService.get<{ passport_photo_url?: string }>(`/teachers/${teacher.id}/photo`);
        if (!cancelled && res.passport_photo_url) setPhotoUrl(res.passport_photo_url);
      } catch {
        if (!cancelled) setPhotoUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [open, teacher?.id, teacher?.hasPassportPhoto]);

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

  const handleSoftDelete = async () => {
    if (!teacher) return;
    setDeleting(true);
    try {
      await deleteTeacher(teacher.id);
      toast({
        title: 'Teacher removed',
        description: `${teacher.fullName} was removed from active lists. Salary history is preserved.`,
      });
      setShowDeleteConfirm(false);
      onClose();
    } catch (e: unknown) {
      toast({
        title: 'Remove failed',
        description: e instanceof Error ? e.message : 'Could not remove teacher',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className={detailDialogContentWideClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className="flex flex-wrap items-center gap-3 pr-0">
              {photoUrl ? (
                <StaffPhotoLightbox src={photoUrl} name={teacher.fullName} size="sm" />
              ) : (
                <LazyTeacherAvatar teacherId={teacher.id} fullName={teacher.fullName} hasPassportPhoto={teacher.hasPassportPhoto} eager />
              )}
              <span className="min-w-0 break-words">Teacher profile</span>
              {badge ? <Badge className={badge.className}>{badge.label}</Badge> : null}
            </DialogTitle>
            {photoUrl ? <p className="text-sm text-muted-foreground">Click photo to view full size</p> : null}
          </DialogHeader>

          <DialogBody className={`${detailDialogBodyClass} space-y-6`}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DetailField label="Full name">{teacher.fullName}</DetailField>
              <DetailField label="Staff ID">
                <span className="font-mono">{teacher.staffId}</span>
              </DetailField>
              <DetailField label="Position">{teacher.position || '—'}</DetailField>
              <DetailField label="Department">{teacher.department || '—'}</DetailField>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center space-x-2 break-words"><Phone className="w-4 h-4 shrink-0 text-muted-foreground" /><span>{teacher.phoneNumber}</span></div>
              <div className="flex items-center space-x-2 break-words"><Mail className="w-4 h-4 shrink-0 text-muted-foreground" /><span>{teacher.email}</span></div>
              <div className="flex items-start space-x-2 break-words"><MapPin className="w-4 h-4 shrink-0 text-muted-foreground mt-1" /><span>{teacher.address}</span></div>
            </div>

            <Separator />

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800/75 dark:text-emerald-300/80">Subjects</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {teacher.subjectsTaught.map((subject, index) => (
                  <Badge key={index} variant="secondary">{subject}</Badge>
                ))}
              </div>
              <p className="mt-2 text-sm break-words">Class: {teacher.classAssigned || 'No class assigned'}</p>
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <DetailField label="Employment date">{formatDisplayDate(teacher.employmentDate)}</DetailField>
              <DetailField label="Monthly salary">
                {teacher.monthlySalary > 0 ? `GHS ${teacher.monthlySalary.toLocaleString()}` : 'Not set'}
              </DetailField>
            </div>

            {isAdmin ? (
              <>
                <Separator />
                <TeacherStatusHistory teacherId={teacher.id} open={open} />
              </>
            ) : null}

            <Separator />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <h4 className="text-sm font-semibold mb-2">Emergency contact</h4>
                <DetailField label="Name">{teacher.emergencyContactName || '—'}</DetailField>
                <DetailField label="Relationship">{teacher.emergencyContactRelationship || '—'}</DetailField>
                <DetailField label="Phone">{teacher.emergencyContactPhone || '—'}</DetailField>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Bank details</h4>
                <DetailField label="Bank">{teacher.bankName || '—'}</DetailField>
                <DetailField label="Account name">{teacher.bankAccountName || '—'}</DetailField>
                <DetailField label="Account number">
                  <span className="font-mono">{teacher.bankAccountNumber || '—'}</span>
                </DetailField>
                <DetailField label="Branch">{teacher.bankBranch || '—'}</DetailField>
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
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/40" onClick={() => setShowDeleteConfirm(true)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Remove from list
                  </Button>
                </div>

                <Separator />
                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4" /> Appointment letter
                  </h3>
                  {checklist.some((c) => !c.ok) && (
                    <ul className="text-sm text-amber-700 mb-2 list-disc pl-5">
                      {checklist.filter((c) => !c.ok).map((c) => (
                        <li key={c.label}>{c.label}</li>
                      ))}
                    </ul>
                  )}
                  <Button size="sm" onClick={generateLetter} disabled={generating}>
                    {generating ? 'Loading…' : 'Generate appointment letter'}
                  </Button>
                  {letters.length > 0 && (
                    <ul className="mt-3 text-sm space-y-1 break-words">
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
          </DialogBody>

          <DialogFooter className={detailDialogFooterClass}>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </DialogFooter>
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

      <StaffDeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        staffName={teacher.fullName}
        staffId={teacher.staffId}
        staffType="teacher"
        loading={deleting}
        onConfirm={() => void handleSoftDelete()}
      />
    </>
  );
};

export default TeacherDetailsDialog;
