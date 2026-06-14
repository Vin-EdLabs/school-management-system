import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import FinanceStatementModal from './FinanceStatementModal';
import { canAccessFinanceStatement } from '../../utils/financeStatementAccess';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '@/lib/utils';

type FinanceStatementButtonProps = {
  studentId: number | string;
  studentLabel?: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
};

export function FinanceStatementButton({
  studentId,
  studentLabel,
  variant = 'outline',
  size = 'sm',
  className,
}: FinanceStatementButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!canAccessFinanceStatement(user?.role)) return null;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn('gap-1.5', className)}
        onClick={() => setOpen(true)}
      >
        <FileText className="h-3.5 w-3.5" />
        Finance Statement
      </Button>
      <FinanceStatementModal
        open={open}
        onOpenChange={setOpen}
        studentId={studentId}
        studentLabel={studentLabel}
      />
    </>
  );
}

type ParentFinanceStatementButtonProps = {
  parentToken: string;
  studentLabel?: string;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function ParentFinanceStatementButton({
  parentToken,
  studentLabel,
  className,
  open,
  onOpenChange,
}: ParentFinanceStatementButtonProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const modalOpen = isControlled ? open : internalOpen;
  const setModalOpen = (next: boolean) => {
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" className={cn('gap-1.5', className)} onClick={() => setModalOpen(true)}>
        <FileText className="h-4 w-4" />
        Finance Statement
      </Button>
      <FinanceStatementModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        parentToken={parentToken}
        studentLabel={studentLabel}
      />
    </>
  );
}
