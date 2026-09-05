'use client';

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
import { Loader2, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConfirmVariant = 'default' | 'warning' | 'destructive';

interface ValidationWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * Colour of the icon badge and confirm button.
   * 'default' uses the primary button styles, 'warning' amber, 'destructive' red.
   */
  confirmVariant?: ConfirmVariant;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  /** Close the dialog automatically once onConfirm resolves without throwing. */
  closeOnConfirm?: boolean;
}

const badgeStyles: Record<ConfirmVariant, string> = {
  default: 'bg-primary/10 text-primary',
  warning: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
  destructive: 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400',
};

const actionStyles: Record<ConfirmVariant, string> = {
  default: '',
  warning:
    'bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-600',
  destructive:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600',
};

/**
 * A confirmation dialog that presents a warning before a destructive or
 * irreversible admin action (approve, reject, forfeit, advance stage, etc.).
 *
 * Usage:
 *   <ValidationWarningDialog
 *     open={showConfirm}
 *     onOpenChange={setShowConfirm}
 *     title="Approve application?"
 *     description="This will mark the property as sold_rto. Cannot be undone."
 *     confirmLabel="Yes, approve"
 *     confirmVariant="warning"
 *     onConfirm={handleApprove}
 *     loading={processing}
 *   />
 */
export function ValidationWarningDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'default',
  onConfirm,
  loading = false,
  closeOnConfirm = false,
}: ValidationWarningDialogProps) {
  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await onConfirm();
      if (closeOnConfirm) onOpenChange(false);
    } catch {
      // Swallowed on purpose — the caller surfaces the error (toast, inline).
      // Rethrowing here would produce an unhandled rejection in the handler.
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (loading) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent
        onEscapeKeyDown={(e) => {
          if (loading) e.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <div className="grid grid-cols-[40px_1fr] items-center gap-x-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                badgeStyles[confirmVariant],
              )}
            >
              <TriangleAlert className="h-5 w-5" aria-hidden="true" />
            </div>
            <AlertDialogTitle className="text-left">{title}</AlertDialogTitle>

            <AlertDialogDescription className="col-start-2 mt-2 text-left">
              {description}
            </AlertDialogDescription>
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            aria-busy={loading}
            onClick={handleConfirm}
            className={cn('min-w-[100px]', actionStyles[confirmVariant])}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span className="sr-only">Processing</span>
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}