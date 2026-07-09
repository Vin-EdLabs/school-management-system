import React from 'react';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export type MessageDeleteKind = 'message' | 'conversation';

interface MessageDeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  kind?: MessageDeleteKind;
}

const copy: Record<MessageDeleteKind, { title: string; description: string; confirm: string }> = {
  message: {
    title: 'Delete this message?',
    description:
      'This message will be removed for both you and the other person. The rest of the conversation will stay.',
    confirm: 'Delete message',
  },
  conversation: {
    title: 'Delete entire conversation?',
    description:
      'This will permanently remove the full thread for both sides, including all messages and replies.',
    confirm: 'Delete conversation',
  },
};

const MessageDeleteConfirmDialog: React.FC<MessageDeleteConfirmDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  kind = 'message',
}) => {
  const text = copy[kind];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md rounded-2xl border-t-4 border-red-500 p-0 gap-0 overflow-hidden">
        <div className="px-6 pt-6 pb-2">
          <AlertDialogHeader className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-600">
              <Trash2 className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-center text-lg">{text.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-center text-sm leading-relaxed">
              {text.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>
        <AlertDialogFooter className="flex-col-reverse gap-2 border-t border-border/70 bg-muted/30 px-6 py-4 sm:flex-row sm:justify-end">
          <AlertDialogCancel className="mt-0 rounded-xl">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="rounded-xl bg-red-600 text-white hover:bg-red-700"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
              onOpenChange(false);
            }}
          >
            {text.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default MessageDeleteConfirmDialog;
