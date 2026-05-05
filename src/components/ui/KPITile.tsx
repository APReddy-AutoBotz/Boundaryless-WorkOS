import * as Icons from 'lucide-react';
import { cn } from '../../lib/utils';

interface KPITileProps {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon: string;
  subtitle?: string;
}

export const KPITile = ({ title, value, change, changeType, icon, subtitle }: KPITileProps) => {
  // @ts-ignore
  const IconComponent = Icons[icon] || Icons.Circle;

  return (
    <div className="bg-white border border-border-light rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full group">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-bg-secondary rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
          <IconComponent size={18} />
        </div>
        {change !== undefined && (
          <div className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full",
            changeType === 'increase' ? "bg-success-bg text-success" : 
            changeType === 'decrease' ? "bg-danger-bg text-danger" : "bg-bg-secondary text-slate-dark"
          )}>
            {changeType === 'increase' ? '+' : ''}{change}%
          </div>
        )}
      </div>
      
      <div className="mt-auto">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-heading leading-none mb-2">{value}</h3>
        {subtitle ? (
          <p className="text-[10px] text-body opacity-60 font-medium">{subtitle}</p>
        ) : change !== undefined ? (
          <p className="text-[10px] text-body opacity-60 font-medium tracking-wide">
            {changeType === 'increase' ? 'Higher than' : 'Lower than'} last period
          </p>
        ) : null}
      </div>
    </div>
  );
};
