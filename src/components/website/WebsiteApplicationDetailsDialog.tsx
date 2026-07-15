import React, { useMemo } from 'react';
import {
  Calendar,
  CheckCircle2,
  FileText,
  GraduationCap,
  Home,
  Info,
  Mail,
  MapPin,
  Phone,
  User,
  Users,
} from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  detailDialogBodyClass,
  detailDialogContentWideClass,
  detailDialogFooterClass,
  detailDialogHeaderClass,
  formDialogContentClass,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatDisplayDate } from '@/utils/dateFormat';
import { resolveWebsiteImageUrl } from '@/services/schoolWebsiteService';
import { WebsiteDocumentGrid, WebsiteDocumentPreview } from './WebsiteDocumentPreview';

type AppDoc = { name?: string; url?: string; label?: string; type?: string };

export type ParsedWebsiteApplication = {
  id: number;
  applicantName: string;
  status: string;
  submittedAt: string | null;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  nationality: string;
  classAssigned: string;
  previousSchool: string;
  dateOfAdmission: string;
  guardianName: string;
  guardianContact: string;
  guardianEmail: string;
  guardian2Name: string;
  guardian2Contact: string;
  guardian2Relationship: string;
  homeAddress: string;
  numberOfSiblings: number | string;
  namesOfSiblings: string;
  notes: string;
  documents: AppDoc[];
  photoUrl: string | null;
};

export function parseWebsiteApplication(row: Record<string, unknown>): ParsedWebsiteApplication {
  let data: Record<string, unknown> = {};
  if (row.application_data) {
    if (typeof row.application_data === 'string') {
      try {
        data = JSON.parse(row.application_data) as Record<string, unknown>;
      } catch {
        data = {};
      }
    } else if (typeof row.application_data === 'object') {
      data = row.application_data as Record<string, unknown>;
    }
  }

  let documents: AppDoc[] = [];
  const rawDocs = row.documents ?? data.documents;
  if (Array.isArray(rawDocs)) {
    documents = rawDocs as AppDoc[];
  } else if (typeof rawDocs === 'string') {
    try {
      documents = JSON.parse(rawDocs) as AppDoc[];
    } catch {
      documents = [];
    }
  }

  const photoDoc = documents.find((d) => (d.label || d.name || '').toLowerCase().includes('passport'));
  const photoUrl = photoDoc?.url ? resolveWebsiteImageUrl(String(photoDoc.url)) : null;

  const firstName = String(data.first_name || data.firstName || '').trim();
  const lastName = String(data.last_name || data.lastName || '').trim();
  const applicantName = String(row.applicant_name || `${firstName} ${lastName}`.trim());

  return {
    id: Number(row.id),
    applicantName,
    status: String(row.status || 'pending'),
    submittedAt: row.submitted_at ? String(row.submitted_at) : null,
    firstName,
    lastName,
    gender: String(row.gender || data.gender || '—'),
    dateOfBirth: String(row.dob || data.dateOfBirth || data.date_of_birth || '—'),
    nationality: String(row.nationality || data.nationality || '—'),
    classAssigned: String(row.program_applied || data.classAssigned || data.class_assigned || '—'),
    previousSchool: String(data.previousSchool || data.previous_school || '—'),
    dateOfAdmission: String(data.dateOfAdmission || data.date_of_admission || '—'),
    guardianName: String(row.parent_name || data.guardianName || data.guardian_name || '—'),
    guardianContact: String(row.parent_phone || data.guardianContact || data.guardian_contact || '—'),
    guardianEmail: String(row.parent_email || data.guardianEmail || data.guardian_email || '—'),
    guardian2Name: String(data.guardian2Name || data.guardian2_name || ''),
    guardian2Contact: String(data.guardian2Contact || data.guardian2_contact || ''),
    guardian2Relationship: String(data.guardian2Relationship || data.guardian2_relationship || row.relationship || ''),
    homeAddress: String(data.homeAddress || data.home_address || '—'),
    numberOfSiblings: (data.numberOfSiblings ?? data.number_of_siblings ?? 0) as number | string,
    namesOfSiblings: String(data.namesOfSiblings || data.names_of_siblings || ''),
    notes: String(data.notes || '').trim(),
    documents,
    photoUrl,
  };
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  under_review: 'Under review',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

function statusBadgeClass(status: string) {
  switch (status) {
    case 'accepted':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300';
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300';
    case 'under_review':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300';
    default:
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300';
  }
}

function DetailRow({ icon: Icon, label, value }: { icon?: React.ElementType; label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '' || value === '—') return null;
  return (
    <div className="flex gap-3 py-2.5 border-b border-border/50 last:border-0">
      {Icon && (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-foreground break-words">{value}</p>
      </div>
    </div>
  );
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="pt-5 pb-4">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
        <div>{children}</div>
      </CardContent>
    </Card>
  );
}

type Props = {
  application: Record<string, unknown> | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: (status: string) => Promise<void>;
  saving?: boolean;
};

export default function WebsiteApplicationDetailsDialog({
  application,
  open,
  onClose,
  onStatusChange,
  saving = false,
}: Props) {
  const app = useMemo(
    () => (application ? parseWebsiteApplication(application) : null),
    [application]
  );
  const [status, setStatus] = React.useState(app?.status || 'pending');
  const [photoOpen, setPhotoOpen] = React.useState(false);
  const [acceptConfirmOpen, setAcceptConfirmOpen] = React.useState(false);

  React.useEffect(() => {
    if (app) setStatus(app.status);
  }, [app]);

  const handleSaveStatus = () => {
    if (!app) return;
    if (status === 'accepted' && app.status !== 'accepted') {
      setAcceptConfirmOpen(true);
      return;
    }
    void onStatusChange(status);
  };

  const confirmAccept = () => {
    setAcceptConfirmOpen(false);
    void onStatusChange('accepted');
  };

  if (!app) return null;

  const supportDocs = app.documents.filter(
    (d) => !(d.label || d.name || '').toLowerCase().includes('passport')
  );

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={`${detailDialogContentWideClass} sm:max-w-3xl`}>
        <DialogHeader className={detailDialogHeaderClass}>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-0">
            <GraduationCap className="h-5 w-5 shrink-0 text-indigo-600" />
            <span>Admission application</span>
            <Badge className={cn('ml-1 font-medium', statusBadgeClass(app.status))}>
              {STATUS_LABELS[app.status] || app.status}
            </Badge>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {app.applicantName}
            {app.submittedAt ? ` · Submitted ${formatDisplayDate(app.submittedAt)}` : ''}
          </p>
        </DialogHeader>

        <DialogBody className={`${detailDialogBodyClass} space-y-5`}>
          <Card className="border-slate-200 bg-gradient-to-r from-slate-50/80 to-white dark:from-slate-900/50 dark:to-slate-950/30">
            <CardContent className="pt-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <button
                  type="button"
                  onClick={() => app.photoUrl && setPhotoOpen(true)}
                  className="mx-auto h-44 w-44 shrink-0 overflow-hidden rounded-xl border-[3px] border-amber-400/90 bg-slate-100 shadow-lg sm:mx-0"
                >
                  {app.photoUrl ? (
                    <img src={app.photoUrl} alt="" className="h-full w-full object-contain p-1" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <User className="h-12 w-12 text-slate-300" />
                    </div>
                  )}
                </button>
                <div className="min-w-0 flex-1 space-y-1">
                  <h2 className="text-xl font-bold text-foreground">{app.applicantName}</h2>
                  <p className="text-sm text-muted-foreground">
                    Applying for <span className="font-semibold text-foreground">{app.classAssigned}</span>
                  </p>
                  {app.dateOfAdmission && app.dateOfAdmission !== '—' && (
                    <p className="text-sm text-muted-foreground">
                      Preferred admission: {formatDisplayDate(app.dateOfAdmission)}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <SectionBlock title="Personal information">
              <DetailRow icon={User} label="First name" value={app.firstName} />
              <DetailRow icon={User} label="Last name" value={app.lastName} />
              <DetailRow icon={User} label="Gender" value={app.gender} />
              <DetailRow icon={Calendar} label="Date of birth" value={app.dateOfBirth !== '—' ? formatDisplayDate(app.dateOfBirth) : null} />
              <DetailRow icon={MapPin} label="Nationality" value={app.nationality} />
            </SectionBlock>

            <SectionBlock title="School information">
              <DetailRow icon={GraduationCap} label="Class applying for" value={app.classAssigned} />
              <DetailRow icon={Calendar} label="Preferred admission date" value={app.dateOfAdmission !== '—' ? formatDisplayDate(app.dateOfAdmission) : null} />
              <DetailRow icon={Home} label="Previous school" value={app.previousSchool !== '—' ? app.previousSchool : null} />
            </SectionBlock>
          </div>

          <SectionBlock title="Parent / guardian">
            <DetailRow icon={User} label="Primary guardian" value={app.guardianName} />
            <DetailRow icon={Phone} label="Phone" value={app.guardianContact} />
            <DetailRow icon={Mail} label="Email" value={app.guardianEmail} />
            <DetailRow icon={MapPin} label="Home address" value={app.homeAddress} />
            {(app.guardian2Name || app.guardian2Contact) && (
              <>
                <DetailRow icon={Users} label="Second guardian" value={app.guardian2Name} />
                <DetailRow icon={Phone} label="Second contact" value={app.guardian2Contact} />
                <DetailRow icon={User} label="Relationship" value={app.guardian2Relationship} />
              </>
            )}
          </SectionBlock>

          {(app.numberOfSiblings || app.namesOfSiblings) && (
            <SectionBlock title="Family">
              <DetailRow icon={Users} label="Number of siblings" value={String(app.numberOfSiblings || 0)} />
              <DetailRow icon={Users} label="Sibling names" value={app.namesOfSiblings} />
            </SectionBlock>
          )}

          {app.notes && (
            <SectionBlock title="Additional notes">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{app.notes}</p>
            </SectionBlock>
          )}

          {supportDocs.length > 0 && (
            <SectionBlock title="Documents">
              <WebsiteDocumentGrid documents={supportDocs} />
            </SectionBlock>
          )}
        </DialogBody>

        <DialogFooter className={cn(detailDialogFooterClass, 'flex-col gap-3 sm:flex-row sm:items-end')}>
          <div className="w-full sm:max-w-xs space-y-1.5">
            <Label className="text-xs text-muted-foreground">Update status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['pending', 'under_review', 'accepted', 'rejected'] as const).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-full gap-2 sm:w-auto sm:ml-auto">
            <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>
              Close
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              disabled={saving || status === app.status}
              onClick={handleSaveStatus}
            >
              Save status
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={acceptConfirmOpen} onOpenChange={setAcceptConfirmOpen}>
      <DialogContent className={`${formDialogContentClass} sm:max-w-lg`}>
        <DialogHeader className={detailDialogHeaderClass}>
          <DialogTitle className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            Accept this application?
          </DialogTitle>
          <DialogDescription>
            Review what will happen to <span className="font-medium text-foreground">{app.applicantName}</span> before you continue.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
          <div className="rounded-2xl border border-emerald-100/80 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <p className="flex items-start gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              What happens next
            </p>
            <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                A student record is created and placed in <strong className="font-medium text-foreground">Students → Pending Admissions</strong>.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                Their application details, passport photo, and uploaded documents are copied to that record.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                They are <strong className="font-medium text-foreground">not enrolled yet</strong> — no class assignment, fees, or parent portal access until you approve enrollment.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                Go to Pending Admissions to assign a class and confirm full enrollment when ready.
              </li>
            </ul>
          </div>
          {app.classAssigned && app.classAssigned !== '—' && (
            <p className="text-sm text-muted-foreground">
              Applied for: <span className="font-medium text-foreground">{app.classAssigned}</span>
            </p>
          )}
        </DialogBody>
        <DialogFooter className={detailDialogFooterClass}>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => setAcceptConfirmOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" className="rounded-xl" onClick={confirmAccept} disabled={saving}>
            {saving ? 'Accepting…' : 'Yes, accept application'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      {app.photoUrl && (
        <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
          <DialogContent className="max-w-3xl border-0 bg-black/95 p-3 sm:max-w-4xl">
            <DialogHeader className="sr-only">
              <DialogTitle>Passport photo</DialogTitle>
            </DialogHeader>
            <DialogBody className="flex max-h-[85vh] items-center justify-center p-2">
              <img src={app.photoUrl} alt="Passport photo" className="max-h-[82vh] max-w-full object-contain" />
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
