import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from '@/components/ui/dialog';
import {
  paymentImageDialogClass,
  paymentImageDialogHeaderClass,
  paymentImageDialogBodyClass,
} from './paymentSubmissionUi';

interface PaymentProofImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | null;
  title?: string;
  subtitle?: string;
}

const PaymentProofImageDialog: React.FC<PaymentProofImageDialogProps> = ({
  open,
  onOpenChange,
  imageUrl,
  title = 'Payment proof screenshot',
  subtitle,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className={paymentImageDialogClass}>
      <DialogHeader className={paymentImageDialogHeaderClass}>
        <DialogTitle>{title}</DialogTitle>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </DialogHeader>
      <DialogBody className={paymentImageDialogBodyClass}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="max-h-[min(70dvh,640px)] w-full rounded-lg border border-slate-200 object-contain bg-white shadow-sm"
          />
        ) : null}
      </DialogBody>
    </DialogContent>
  </Dialog>
);

export default PaymentProofImageDialog;
