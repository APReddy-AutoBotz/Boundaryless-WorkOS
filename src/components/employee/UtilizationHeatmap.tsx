import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { Employee, Allocation, SystemSettings } from '../../types';

interface UtilizationHeatmapProps {
  employees: Employee[];
  allocations: Allocation[];
  settings: SystemSettings;
}

type HeatPeriod = 'weeks' | 'months';

function getMondays(count: number): Date[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i * 7);
    return d;
  });
}

function getMonthStarts(count: number): Date[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    return new Date(now.getFullYear(), now.getMonth() + i, 1);
  });
}

function getUtilForWeek(employeeId: string, allocations: Allocation[], weekStart: Date): number {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return allocations
    .filter(a => {
      if (a.employeeId !== employeeId || a.status !== 'Active') return false;
      return new Date(a.startDate) <= weekEnd && new Date(a.endDate) >= weekStart;
    })
    .reduce((s, a) => s + a.percentage, 0);
}

function getUtilForMonth(employeeId: string, allocations: Allocation[], monthStart: Date): number {
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  return allocations
    .filter(a => {
      if (a.employeeId !== employeeId || a.status !== 'Active') return false;
      return new Date(a.startDate) <= monthEnd && new Date(a.endDate) >= monthStart;
    })
    .reduce((s, a) => s + a.percentage, 0);
}

function getCellStyle(util: number, settings: SystemSettings): { bg: string; text: string; label: string } {
  if (util === 0) return { bg: 'bg-gray-100', text: 'text-gray-400', label: 'Bench' };
  if (util < settings.utilizationThresholdLow) return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Under' };
  if (util <= settings.utilizationThresholdHigh) return { bg: 'bg-heading/80', text: 'text-white', label: 'OK' };
  return { bg: 'bg-danger', text: 'text-white', label: 'Over' };
}

const LEGEND = [
  { bg: 'bg-gray-100', border: 'border-gray-200', label: 'Bench (0%)', text: 'text-gray-400' },
  { bg: 'bg-amber-100', border: 'border-amber-200', label: 'Underutilized', text: 'text-amber-700' },
  { bg: 'bg-heading/80', border: 'border-heading/20', label: 'Balanced', text: 'text-white' },
  { bg: 'bg-danger', border: 'border-danger/40', label: 'Overloaded', text: 'text-white' },
];

export const UtilizationHeatmap = ({ employees, allocations, settings }: UtilizationHeatmapProps) => {
  const [period, setPeriod] = useState<HeatPeriod>('weeks');

  const mondays = getMondays(12);
  const monthStarts = getMonthStarts(6);
  const periods = period === 'weeks' ? mondays : monthStarts;

  const formatLabel = (d: Date) =>
    period === 'weeks'
      ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      : d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });

  const getUtil = (empId: string, d: Date) =>
    period === 'weeks' ? getUtilForWeek(empId, allocations, d) : getUtilForMonth(empId, allocations, d);

  return (
    <div className="bg-white border border-border-light rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-border-light bg-bg-secondary/40">
        <div>
          <p className="text-xs font-bold text-heading">Utilization Heatmap</p>
          <p className="text-[10px] text-body/60 mt-0.5">Hover any cell for exact value · click employee name to open profile</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="hidden md:flex items-center gap-3">
            {LEGEND.map(l => (
              <span key={l.label} className="flex items-center gap-1.5 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                <span className={cn('w-3 h-3 rounded border shrink-0', l.bg, l.border)} />
                {l.label}
              </span>
            ))}
          </div>
          {/* Period toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setPeriod('weeks')}
              className={cn('px-2.5 py-1 rounded text-[10px] font-bold transition-all', period === 'weeks' ? 'bg-white text-heading shadow-sm' : 'text-gray-400 hover:text-heading')}
            >
              Weeks
            </button>
            <button
              onClick={() => setPeriod('months')}
              className={cn('px-2.5 py-1 rounded text-[10px] font-bold transition-all', period === 'months' ? 'bg-white text-heading shadow-sm' : 'text-gray-400 hover:text-heading')}
            >
              Months
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse" style={{ minWidth: 640 }}>
          <thead>
            <tr className="bg-bg-secondary/60 border-b border-border-light">
              <th className="sticky left-0 bg-bg-secondary/80 z-10 py-3 px-4 text-[9px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap border-r border-border-light" style={{ minWidth: 180 }}>
                Employee
              </th>
              {periods.map((d, i) => (
                <th key={i} className="py-3 px-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider text-center whitespace-nowrap" style={{ minWidth: 62 }}>
                  {formatLabel(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td colSpan={periods.length + 1} className="py-12 text-center text-xs text-gray-400 font-medium">
                  No employees match the current filters.
                </td>
              </tr>
            )}
            {employees.map((emp, ri) => (
              <tr key={emp.id} className={cn('border-b border-border-light/60', ri % 2 === 0 ? 'bg-white' : 'bg-bg-secondary/30')}>
                <td className="sticky left-0 bg-white z-10 py-2.5 px-4 border-r border-border-light" style={{ minWidth: 180 }}>
                  <Link to={`/employees/${emp.id}`} className="text-xs font-bold text-heading hover:text-primary transition-colors block truncate" style={{ maxWidth: 164 }}>
                    {emp.name}
                  </Link>
                  <span className="text-[9px] text-body/50 truncate block">{emp.designation}</span>
                </td>
                {periods.map((d, ci) => {
                  const util = getUtil(emp.id, d);
                  const style = getCellStyle(util, settings);
                  return (
                    <td key={ci} className="py-2 px-1 text-center">
                      <div
                        className={cn(
                          'mx-auto rounded flex items-center justify-center text-[10px] font-bold transition-all cursor-default hover:scale-110 hover:shadow-md',
                          style.bg, style.text
                        )}
                        style={{ width: 48, height: 28 }}
                        title={`${emp.name} · ${formatLabel(d)} · ${util}% (${style.label})`}
                      >
                        {util > 0 ? `${util}%` : '—'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile legend */}
      <div className="flex flex-wrap items-center gap-3 px-5 py-3 border-t border-border-light bg-bg-secondary/20 md:hidden">
        {LEGEND.map(l => (
          <span key={l.label} className="flex items-center gap-1.5 text-[9px] font-bold text-gray-500 uppercase tracking-wider">
            <span className={cn('w-3 h-3 rounded border shrink-0', l.bg, l.border)} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
};
