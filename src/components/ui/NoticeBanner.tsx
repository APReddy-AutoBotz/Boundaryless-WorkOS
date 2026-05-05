import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface NoticeBannerProps {
  type?: 'success' | 'warning' | 'danger' | 'info';
  title?: string;
  message: string;
  onClose?: () => void;
  className?: string;
}

export const NoticeBanner = ({
  type = 'info',
  title,
  message,
  onClose,
  className,
}: NoticeBannerProps) => {
  const Icon = type === 'success' ? CheckCircle2 : type === 'info' ? Info : AlertCircle;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-sm',
        type === 'success' && 'border-green-100 bg-green-50 text-green-800',
        type === 'warning' && 'border-orange-100 bg-orange-50 text-heading',
        type === 'danger' && 'border-red-100 bg-red-50 text-red-800',
        type === 'info' && 'border-slate-200 bg-white text-heading',
        className
      )}
    >
      <Icon
        size={16}
        className={cn(
          'mt-0.5 shrink-0',
          type === 'success' && 'text-success',
          type === 'warning' && 'text-primary',
          type === 'danger' && 'text-danger',
          type === 'info' && 'text-primary'
        )}
      />
      <div className="min-w-0 flex-1">
        {title && <p className="text-[10px] font-black uppercase tracking-widest">{title}</p>}
        <p className="text-xs font-medium leading-relaxed">{message}</p>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-current opacity-40 transition-opacity hover:opacity-80"
          aria-label="Dismiss notice"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};
