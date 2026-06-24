import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  detailDialogContentWideClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
  detailDialogFooterClass,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { Pencil, Phone, Mail, MapPin, Briefcase, Banknote, User, Calendar, Hash, Trash2 } from 'lucide-react';
import OtherStaffFormDialog from './OtherStaffFormDialog';
import StaffDeleteConfirmDialog from '../common/StaffDeleteConfirmDialog';
import type { OtherStaffRecord } from './otherStaffTypes';
import StaffPhotoLightbox from './StaffPhotoLightbox';

export type { OtherStaffRecord } from './otherStaffTypes';

type Props = {
  staffId: number | null;
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
};

const DetailRow = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) => (
  <div className="flex gap-3 py-2">
    <Icon className="w-5 h-5 text-emerald-700/70 shrink-0 mt-0.5" />
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800/75 dark:text-emerald-300/80">{label}</p>
      <p className="text-sm text-foreground mt-1 break-words">{value}</p>
    </div>
  </div>
);

const OtherStaffProfileDialog: React.FC<Props> = ({ staffId, open, onClose, onUpdated }) => {
  const [staff, setStaff] = useState<OtherStaffRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open || staffId == null) {
      setStaff(null);
      return;
    }
    setLoading(true);
    apiService
      .get<OtherStaffRecord>(`/other-staff/${staffId}`)
      .then(setStaff)
      .catch((e: Error) => {
        toast({ title: 'Error', description: e.message, variant: 'destructive' });
        setStaff(null);
      })
      .finally(() => setLoading(false));
  }, [open, staffId]);

  const toggleStatus = async () => {
    if (!staff) return;
    const isActive = (staff.employment_status || 'active').toLowerCase() === 'active';
    setToggling(true);
    try {
      if (isActive) {
        await apiService.put(`/other-staff/${staff.id}`, { employment_status: 'inactive' });
        toast({ title: 'Deactivated', description: `${staff.full_name} has been deactivated` });
      } else {
        await apiService.put(`/other-staff/${staff.id}`, { employment_status: 'active' });
        toast({ title: 'Activated', description: `${staff.full_name} is now active` });
      }
      const updated = await apiService.get<OtherStaffRecord>(`/other-staff/${staff.id}`);
      setStaff(updated);
      onUpdated?.();
    } catch (e: unknown) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to update status',
        variant: 'destructive',
      });
    } finally {
      setToggling(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!staff) return;
    setDeleting(true);
    try {
      await apiService.delete(`/other-staff/${staff.id}`);
      toast({
        title: 'Staff removed',
        description: `${staff.full_name} was removed from active lists. Salary history is preserved.`,
      });
      setShowDeleteConfirm(false);
      onUpdated?.();
      onClose();
    } catch (e: unknown) {
      toast({
        title: 'Remove failed',
        description: e instanceof Error ? e.message : 'Could not remove staff member',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const isActive = (staff?.employment_status || 'active').toLowerCase() === 'active';

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className={detailDialogContentWideClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle>Staff profile</DialogTitle>
            {staff ? (
              <p className="text-sm text-muted-foreground">
                {staff.full_name} · {staff.staff_id}
              </p>
            ) : null}
          </DialogHeader>
          <DialogBody className={`${detailDialogBodyClass} space-y-6`}>
          {loading ? (
            <p className="py-12 text-center text-muted-foreground">Loading profile…</p>
          ) : !staff ? (
            <p className="py-12 text-center text-muted-foreground">Staff member not found.</p>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40">
                <StaffPhotoLightbox
                  src={staff.passport_photo_url}
                  name={staff.full_name}
                  size="md"
                />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <h3 className="text-lg font-semibold tracking-tight break-words">{staff.full_name}</h3>
                  <p className="font-mono text-sm text-muted-foreground">{staff.staff_id}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {staff.position && <Badge variant="secondary" className="text-sm">{staff.position}</Badge>}
                    {staff.department && <Badge variant="outline" className="text-sm">{staff.department}</Badge>}
                    <Badge variant="outline" className={isActive ? 'text-emerald-600 border-emerald-500/30' : ''}>
                      {staff.employment_status || 'active'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Click photo to view full size</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-x-6">
                <div>
                  <DetailRow icon={Phone} label="Phone" value={staff.phone_number || '—'} />
                  <DetailRow icon={Mail} label="Email" value={staff.email || '—'} />
                  <DetailRow icon={MapPin} label="Address" value={staff.home_address || '—'} />
                  <DetailRow icon={User} label="Gender" value={staff.gender || '—'} />
                </div>
                <div>
                  <DetailRow icon={Briefcase} label="Employment type" value={staff.employment_type || '—'} />
                  <DetailRow icon={Calendar} label="Employment date" value={staff.employment_date?.slice(0, 10) || '—'} />
                  <DetailRow icon={Banknote} label="Monthly salary" value={
                    staff.monthly_salary != null && Number(staff.monthly_salary) > 0
                      ? `GHS ${Number(staff.monthly_salary).toLocaleString()}`
                      : '—'
                  } />
                  <DetailRow icon={Hash} label="National ID" value={staff.national_id || '—'} />
                </div>
              </div>

              <Separator />

              <div className="grid sm:grid-cols-2 gap-x-6">
                <div>
                  <p className="text-sm font-semibold mb-1">Emergency contact</p>
                  <DetailRow icon={User} label="Name" value={staff.emergency_contact_name || '—'} />
                  <DetailRow icon={User} label="Relationship" value={staff.emergency_contact_relationship || '—'} />
                  <DetailRow icon={Phone} label="Phone" value={staff.emergency_contact_phone || '—'} />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1">Bank details</p>
                  <DetailRow icon={Briefcase} label="Bank" value={staff.bank_name || '—'} />
                  <DetailRow icon={User} label="Account name" value={staff.bank_account_name || '—'} />
                  <DetailRow icon={Hash} label="Account number" value={staff.bank_account_number || '—'} />
                  <DetailRow icon={MapPin} label="Branch" value={staff.bank_branch || '—'} />
                </div>
              </div>

              {staff.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800/75 dark:text-emerald-300/80">Notes</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words mt-2">{staff.notes}</p>
                  </div>
                </>
              )}
            </>
          )}
          </DialogBody>
          <DialogFooter className={`${detailDialogFooterClass} flex-wrap`}>
            <Button variant="outline" onClick={onClose}>Close</Button>
            {staff && (
              <>
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant={isActive ? 'destructive' : 'default'}
                  onClick={toggleStatus}
                  disabled={toggling}
                >
                  {isActive ? 'Deactivate' : 'Activate'}
                </Button>
                <Button
                  variant="outline"
                  className="text-destructive border-destructive/40"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remove from list
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OtherStaffFormDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        staff={staff}
        onSuccess={async () => {
          setEditOpen(false);
          if (staffId != null) {
            const updated = await apiService.get<OtherStaffRecord>(`/other-staff/${staffId}`);
            setStaff(updated);
          }
          onUpdated?.();
        }}
      />

      {staff ? (
        <StaffDeleteConfirmDialog
          open={showDeleteConfirm}
          onOpenChange={setShowDeleteConfirm}
          staffName={staff.full_name}
          staffId={staff.staff_id}
          staffType="other"
          loading={deleting}
          onConfirm={() => void handleSoftDelete()}
        />
      ) : null}
    </>
  );
};

export default OtherStaffProfileDialog;
