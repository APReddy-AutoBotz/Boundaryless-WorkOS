import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import { SortConfig } from '../../lib/sorting';
import { cn } from '../../lib/utils';

interface SortableHeaderProps<T extends string> {
  label: string;
  sortKey: T;
  sortConfig: SortConfig<T> | null;
  onSort: (key: T) => void;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export const SortableHeader = <T extends string>({
  label,
  sortKey,
  sortConfig,
  onSort,
  align = 'left',
  className,
}: SortableHeaderProps<T>) => {
  const active = sortConfig?.key === sortKey;
  const Icon = active ? (sortConfig.direction === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
  const ariaSort = active ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none';
  const title = active
    ? `${label}: sorted ${sortConfig.direction === 'asc' ? 'ascending' : 'descending'}. Click to change sort.`
    : `${label}: click to sort.`;

  return (
    <th className={cn(
      'py-4 px-6 text-[10px] font-bold uppercase tracking-widest',
      align === 'center' && 'text-center',
      align === 'right' && 'text-right',
      className
    )} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={title}
        aria-label={title}
        className={cn(
          'group inline-flex h-8 items-center gap-2 rounded-full border px-2.5 transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2',
          align === 'center' && 'mx-auto justify-center',
          align === 'right' && 'ml-auto justify-end',
          active
            ? 'border-primary/25 bg-primary/10 text-primary shadow-sm'
            : 'border-gray-200 bg-white text-gray-500 hover:border-primary/30 hover:bg-primary/5 hover:text-heading'
        )}
      >
        <span>{label}</span>
        <span className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full transition-colors',
          active ? 'bg-primary text-white' : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white'
        )}>
          <Icon size={13} strokeWidth={2.4} />
        </span>
      </button>
    </th>
  );
};
