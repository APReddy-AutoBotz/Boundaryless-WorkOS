import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface DataTableProps {
  header: ReactNode;
  children: ReactNode;
  className?: string;
  tableClassName?: string;
  bodyClassName?: string;
}

export const DataTable = ({
  header,
  children,
  className,
  tableClassName,
  bodyClassName,
}: DataTableProps) => (
  <div className={cn('table-container', className)}>
    <table className={cn('w-full text-left', tableClassName)}>
      <thead className="bg-gray-50/80 sticky top-0 z-10">
        {header}
      </thead>
      <tbody className={cn('divide-y divide-border-light bg-white', bodyClassName)}>
        {children}
      </tbody>
    </table>
  </div>
);
