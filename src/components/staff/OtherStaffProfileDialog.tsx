import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { Pencil, Phone, Mail, MapPin, Briefcase, Banknote, User, Calendar, Hash } from 'lucide-react';
import OtherStaffFormDialog from './OtherStaffFormDialog';
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
    <Icon className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
    <div className="min-w-0">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm text-foreground mt-0.5 break-words">{value}</p>
    </div>
  </div>
);

const OtherStaffProfileDialog: React.FC<Props> = ({ staffId, open, onClose, onUpdated }) => {
  const [staff, setStaff] = useState<OtherStaffRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

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
        await apiService.delete(`/other-staff/${staff.id}`);
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

  const isActive = (staff?.employment_status || 'active').toLowerCase() === 'active';

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Staff Profile</DialogTitle>
          </DialogHeader>
          {loading ? (
            <p className="py-12 text-center text-muted-foreground">Loading profile...</p>
          ) : !staff ? (
            <p className="py-12 text-center text-muted-foreground">Staff member not found.</p>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center p-3 rounded-lg bg-muted/40 border border-border">
                <StaffPhotoLightbox
                  src={staff.passport_photo_url}
                  name={staff.full_name}
                  size="md"
                />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <h3 className="text-lg font-semibold tracking-tight">{staff.full_name}</h3>
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

              <div className="grid sm:grid-cols-2 gap-x-6 divide-y sm:divide-y-0">
                <div>
                  <DetailRow icon={Phone} label="Phone" value={staff.phone_number || '—'} />
                  <DetailRow icon={Mail} label="Email" value={staff.email || '—'} />
                  <DetailRow icon={MapPin} label="Address" value={staff.home_address || '—'} />
                  <DetailRow icon={User} label="Gender" value={staff.gender || '—'} />
                </div>
                <div>
                  <DetailRow icon={Briefcase} label="Employment Type" value={staff.employment_type || '—'} />
                  <DetailRow icon={Calendar} label="Employment Date" value={staff.employment_date?.slice(0, 10) || '—'} />
                  <DetailRow icon={Banknote} label="Monthly Salary" value={
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
                  <p className="text-sm font-semibold mb-1">Emergency Contact</p>
                  <DetailRow icon={User} label="Name" value={staff.emergency_contact_name || '—'} />
                  <DetailRow icon={User} label="Relationship" value={staff.emergency_contact_relationship || '—'} />
                  <DetailRow icon={Phone} label="Phone" value={staff.emergency_contact_phone || '—'} />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1">Bank Details</p>
                  <DetailRow icon={Briefcase} label="Bank" value={staff.bank_name || '—'} />
                  <DetailRow icon={User} label="Account Name" value={staff.bank_account_name || '—'} />
                  <DetailRow icon={Hash} label="Account Number" value={staff.bank_account_number || '—'} />
                  <DetailRow icon={MapPin} label="Branch" value={staff.bank_branch || '—'} />
                </div>
              </div>

              {staff.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-semibold mb-2">Notes</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{staff.notes}</p>
                  </div>
                </>
              )}
            </div>
          )}
          {staff && (
            <DialogFooter className="gap-2 sm:gap-0 pt-2">
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
            </DialogFooter>
          )}
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
    </>
  );
};

export default OtherStaffProfileDialog;
