import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Circle,
  FileCheck,
  LucideIcon,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
  Minus
} from 'lucide-react';
import { KPIData } from '../../types';
import { cn } from '../../lib/utils';

interface KPIStripProps {
  kpis: KPIData[];
}

export const KPIStrip = ({ kpis }: KPIStripProps) => {
  const iconMap: Record<string, LucideIcon> = {
    Activity,
    AlertTriangle,
    ArrowDownRight,
    Briefcase,
    Calendar,
    CheckCircle2,
    Clock,
    FileCheck,
    Target,
    Timer,
    TrendingUp,
    Users,
    Zap,
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      {kpis.map((kpi, idx) => {
        const Icon = iconMap[kpi.icon] || Circle;
        return (
          <div key={idx} className="bg-white border border-border-light p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-bg-secondary rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                {Icon && <Icon size={16} />}
              </div>
              {kpi.change !== undefined && (
                <div className={cn(
                  "flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                  kpi.changeType === 'increase' ? "bg-green-50 text-success" : 
                  kpi.changeType === 'decrease' ? "bg-red-50 text-danger" : 
                  "bg-slate-50 text-gray-400"
                )}>
                  {kpi.changeType === 'increase' ? <TrendingUp size={8} /> : 
                   kpi.changeType === 'decrease' ? <TrendingDown size={8} /> : 
                   <Minus size={8} />}
                  {Math.abs(kpi.change)}%
                </div>
              )}
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">{kpi.title}</p>
              <p className="text-xl font-bold text-heading mt-1">{kpi.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
