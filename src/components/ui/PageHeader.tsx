import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: string[];
  actions?: ReactNode;
}

export const PageHeader = ({ title, subtitle, breadcrumb, actions }: PageHeaderProps) => {
  return (
    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8 pt-2">
      <div className="space-y-1">
        {breadcrumb && (
          <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">
            {breadcrumb.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="hover:text-primary transition-colors cursor-default">{item}</span>
                {idx < breadcrumb.length - 1 && <span className="opacity-30">/</span>}
              </div>
            ))}
          </div>
        )}
        <h1 className="text-3xl font-bold text-heading tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm font-medium text-body/70 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
};
