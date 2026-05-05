import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  if (!open) return null;

  const Icon = variant === 'danger' ? AlertTriangle : CheckCircle2;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-dark/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border-light bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                variant === 'danger' ? 'bg-red-50 text-danger' : 'bg-orange-50 text-primary'
              )}
            >
              <Icon size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-heading">{title}</h3>
              <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl p-2 text-slate-300 transition-colors hover:bg-slate-50 hover:text-heading"
            aria-label="Close confirmation"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex items-center justify-end gap-3 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-heading transition-colors hover:bg-slate-100"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              'rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-lg transition-colors',
              variant === 'danger'
                ? 'bg-danger shadow-red-200 hover:bg-red-600'
                : 'bg-primary shadow-orange-200 hover:bg-orange-600'
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
