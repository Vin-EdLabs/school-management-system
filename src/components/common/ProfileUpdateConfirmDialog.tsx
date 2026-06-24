import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  detailDialogContentClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
  detailDialogFooterClass,
  DetailField,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';

export type ProfileUpdateField = {
  label: string;
  value: string;
};

type ProfileUpdateConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  entityName: string;
  fields: ProfileUpdateField[];
  onDone: () => void;
};

const ProfileUpdateConfirmDialog: React.FC<ProfileUpdateConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description = 'The profile was saved successfully.',
  entityName,
  fields,
  onDone,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className={`${detailDialogContentClass} sm:max-w-lg`}>
      <DialogHeader className={detailDialogHeaderClass}>
        <DialogTitle className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          {title}
        </DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
        <DetailField label="Name">{entityName}</DetailField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <DetailField key={field.label} label={field.label}>
              {field.value || '—'}
            </DetailField>
          ))}
        </div>
      </DialogBody>

      <DialogFooter className={detailDialogFooterClass}>
        <Button
          variant="primaryAction"
          className="rounded-xl px-8"
          onClick={() => {
            onDone();
            onOpenChange(false);
          }}
        >
          Done
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default ProfileUpdateConfirmDialog;
