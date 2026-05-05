import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface CardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  headerAction?: ReactNode;
  footer?: ReactNode;
  headerVariant?: 'default' | 'secondary';
}

export const Card = ({ children, title, subtitle, className, headerAction, footer, headerVariant = 'default' }: CardProps) => {
  return (
    <div className={cn("dashboard-card flex flex-col", className)}>
      {(title || headerAction) && (
        <div className={cn(
          "px-4 py-3 border-b border-border-light flex items-center justify-between",
          headerVariant === 'secondary' || (title === 'Recent Activity' || title === 'Attention Needed' || title === 'High-Priority Project Status' || title === 'Project Summary') ? "bg-bg-secondary" : "bg-white"
        )}>
          <div>
            {title && <h3 className={cn(
               "text-[#0A1B3D]",
               (title === 'Attention Needed' || title === 'Recent Activity' || title === 'High-Priority Project Status') ? "text-[11px] font-bold uppercase tracking-wider" : "text-sm font-bold"
            )}>{title}</h3>}
          </div>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div className="flex-1 p-4 overflow-hidden">
        {children}
      </div>
      {footer && (
        <div className="px-4 py-3 border-t border-border-light bg-bg-secondary">
          {footer}
        </div>
      )}
    </div>
  );
};
