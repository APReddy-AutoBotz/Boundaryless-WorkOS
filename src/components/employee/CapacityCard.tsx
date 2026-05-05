import { Link } from 'react-router-dom';
import { ArrowUpRight, Edit2, User } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Employee, Allocation, CountryDirector, SystemSettings } from '../../types';

import React from 'react';

interface CapacityCardProps {
  employee: Employee;
  allocations: Allocation[];
  cds: CountryDirector[];
  settings: SystemSettings;
  onEdit: (emp: Employee) => void;
}

function getUtilStatus(util: number, settings: SystemSettings) {
  if (util === 0) return { label: 'Bench', color: 'text-gray-400', bg: 'bg-gray-100', ring: '#9CA3AF', bar: 'bg-gray-300' };
  if (util < settings.utilizationThresholdLow)
    return { label: 'Underutilized', color: 'text-warning', bg: 'bg-warning-bg border border-warning/20', ring: '#D97706', bar: 'bg-warning' };
  if (util <= settings.utilizationThresholdHigh)
    return { label: 'Balanced', color: 'text-success', bg: 'bg-success-bg border border-success/20', ring: '#059669', bar: 'bg-success' };
  return { label: 'Overloaded', color: 'text-danger', bg: 'bg-danger-bg border border-danger/20', ring: '#EF4444', bar: 'bg-danger' };
}

/** SVG donut ring — CSS only, no library */
function UtilRing({ value, color, size = 56 }: { value: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(value / 100, 1) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={7} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="#003761">
        {value}%
      </text>
    </svg>
  );
}

export const CapacityCard: React.FC<CapacityCardProps> = ({ employee, allocations, cds, settings, onEdit }) => {
  const activeAllocs = allocations.filter(a => a.employeeId === employee.id && a.status === 'Active');
  const planned = employee.plannedUtilization;
  const actual = employee.actualUtilization;
  const status = getUtilStatus(planned, settings);

  const getCDName = (id: string) => cds.find(c => c.id === id)?.name || id;
  const primaryCD = getCDName(employee.primaryCountryDirectorId);
  const extraCDs = employee.mappedCountryDirectorIds.filter(id => id !== employee.primaryCountryDirectorId);

  const cardBorder = planned > settings.utilizationThresholdHigh
    ? 'border-danger/30 shadow-[0_0_0_1px_theme(colors.danger/0.15)]'
    : planned === 0
    ? 'border-gray-200'
    : planned < settings.utilizationThresholdLow
    ? 'border-warning/30'
    : 'border-border-light';

  return (
    <div className={cn(
      'bg-white rounded-2xl border p-5 flex flex-col gap-4 hover:shadow-lg transition-all duration-200 group',
      cardBorder
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition-colors',
            planned > settings.utilizationThresholdHigh
              ? 'bg-red-50 text-danger'
              : planned === 0
              ? 'bg-gray-50 text-gray-400'
              : 'bg-orange-50 text-primary group-hover:bg-primary group-hover:text-white'
          )}>
            {employee.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          </div>
          <div className="min-w-0">
            <Link to={`/employees/${employee.id}`} className="text-sm font-bold text-heading hover:text-primary transition-colors block truncate leading-tight">
              {employee.name}
            </Link>
            <p className="text-[10px] text-body/60 font-mono truncate">{employee.employeeId}</p>
          </div>
        </div>
        <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0', status.bg, status.color)}>
          {status.label}
        </span>
      </div>

      {/* Role + dept */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-primary uppercase tracking-wider truncate">{employee.designation}</span>
        <span className="text-gray-200 text-xs">·</span>
        <span className="text-[10px] text-body/60 truncate">{employee.department}</span>
      </div>

      {/* Utilization ring + bar side-by-side */}
      <div className="flex items-center gap-4">
        <UtilRing value={planned} color={status.ring} />
        <div className="flex-1 space-y-2 min-w-0">
          <div>
            <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              <span>Planned</span><span>{planned}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', status.bar)} style={{ width: `${Math.min(planned, 100)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">
              <span>Actual</span><span>{actual}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-heading/40 transition-all" style={{ width: `${Math.min(actual, 100)}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* CD mapping */}
      <div className="flex flex-wrap gap-1">
        <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-full text-[9px] font-bold text-slate-600 truncate max-w-[130px]" title={primaryCD}>
          <User size={9} className="text-primary shrink-0" />{primaryCD}
        </span>
        {extraCDs.slice(0, 2).map(id => (
          <span key={id} className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-full text-[9px] font-bold text-slate-400 truncate max-w-[100px]" title={getCDName(id)}>
            {getCDName(id)}
          </span>
        ))}
        {extraCDs.length > 2 && (
          <span className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-full text-[9px] font-bold text-slate-400">
            +{extraCDs.length - 2}
          </span>
        )}
      </div>

      {/* Project chips */}
      <div className="flex flex-wrap gap-1 min-h-[22px]">
        {activeAllocs.length === 0 ? (
          <span className="text-[9px] text-gray-400 italic">No active projects</span>
        ) : (
          <>
            {activeAllocs.slice(0, 3).map((a, i) => (
              <Link key={i} to={`/projects/${a.projectId}`} className="px-2 py-0.5 bg-orange-50 border border-primary/10 rounded text-[9px] font-bold text-primary truncate max-w-[120px] hover:bg-primary hover:text-white transition-colors" title={`${a.projectName} · ${a.percentage}%`}>
                {a.projectName}
              </Link>
            ))}
            {activeAllocs.length > 3 && (
              <span className="px-2 py-0.5 bg-slate-50 border border-slate-100 rounded text-[9px] font-bold text-gray-400">
                +{activeAllocs.length - 3}
              </span>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-50">
        <Link
          to={`/employees/${employee.id}`}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold text-heading bg-bg-secondary hover:bg-orange-50 hover:text-primary transition-colors"
        >
          <ArrowUpRight size={12} /> View Profile
        </Link>
        <button
          onClick={() => onEdit(employee)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-bold text-heading bg-bg-secondary hover:bg-orange-50 hover:text-primary transition-colors"
        >
          <Edit2 size={12} /> Edit
        </button>
      </div>
    </div>
  );
};
