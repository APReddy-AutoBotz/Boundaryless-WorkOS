import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Employee, Allocation, SystemSettings } from '../../types';

interface AllocationTimelineProps {
  employees: Employee[];
  allocations: Allocation[];
  settings: SystemSettings;
  onEditAllocation: (allocation: Allocation) => void;
}

/** Generate next N weeks starting from this Monday + offset */
function generateWeeks(count: number, offsetWeeks: number = 0): { label: string; start: Date; end: Date }[] {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + (offsetWeeks * 7)); // this Monday + offset
  monday.setHours(0, 0, 0, 0);

  return Array.from({ length: count }, (_, i) => {
    const start = new Date(monday);
    start.setDate(monday.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      label: start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
      start,
      end,
    };
  });
}

/** Get all active allocations overlapping a given week for an employee */
function getAllocsForWeek(employeeId: string, allocations: Allocation[], weekStart: Date, weekEnd: Date) {
  return allocations.filter(a => {
    if (a.employeeId !== employeeId || a.status !== 'Active') return false;
    const aStart = new Date(a.startDate);
    const aEnd = new Date(a.endDate);
    return aStart <= weekEnd && aEnd >= weekStart;
  });
}

/** Colour slot based on project index (cycle through palette) */
const PROJECT_COLORS = [
  'bg-blue-50 text-blue-700',
  'bg-emerald-50 text-emerald-700',
  'bg-violet-50 text-violet-700',
  'bg-cyan-50 text-cyan-700',
  'bg-pink-50 text-pink-700',
  'bg-amber-50 text-amber-700',
  'bg-indigo-50 text-indigo-700',
  'bg-teal-50 text-teal-700',
];
const PROJECT_BORDER = [
  'border-blue-200',
  'border-emerald-200',
  'border-violet-200',
  'border-cyan-200',
  'border-pink-200',
  'border-amber-200',
  'border-indigo-200',
  'border-teal-200',
];

/** Build a stable project→color index map */
function buildColorMap(allocations: Allocation[]) {
  const map = new Map<string, number>();
  allocations
    .filter(a => a.status === 'Active')
    .forEach(a => {
      if (!map.has(a.projectId)) map.set(a.projectId, map.size % PROJECT_COLORS.length);
    });
  return map;
}

interface TooltipState {
  alloc: Allocation;
  x: number;
  y: number;
}

const WEEK_COL_WIDTH = 88; // px
const NAME_COL_WIDTH = 192; // px

export const AllocationTimeline = ({ employees, allocations, settings, onEditAllocation }: AllocationTimelineProps) => {
  const [weekOffset, setWeekOffset] = useState(0);
  const weeks = generateWeeks(12, weekOffset);
  const colorMap = buildColorMap(allocations);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  return (
    <div className="bg-white border border-border-light rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-light bg-bg-secondary/40">
        <div>
          <p className="text-xs font-bold text-heading">Allocation Timeline</p>
          <p className="text-[10px] text-body/60 mt-0.5">Next 12 weeks · hover block for details · click to edit</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="hidden md:flex items-center gap-3 mr-4">
            <span className="flex items-center gap-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              <span className="w-3 h-3 rounded bg-gray-200 inline-block" /> Bench
            </span>
            <span className="flex items-center gap-1 text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              <span className="w-3 h-3 rounded bg-blue-400 inline-block" /> Allocated
            </span>
            <span className="flex items-center gap-1 text-[9px] font-bold text-danger uppercase tracking-wider">
              <span className="w-3 h-3 rounded bg-danger inline-block" /> Overloaded
            </span>
          </div>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setWeekOffset(p => p - 4)} className="p-1 rounded hover:bg-white text-gray-500 hover:text-heading transition-all shadow-sm" title="Previous 4 weeks">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setWeekOffset(0)} className="px-2 py-1 text-[10px] font-bold text-gray-500 hover:text-heading transition-all">
              Today
            </button>
            <button onClick={() => setWeekOffset(p => p + 4)} className="p-1 rounded hover:bg-white text-gray-500 hover:text-heading transition-all shadow-sm" title="Next 4 weeks">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="relative">
        <div ref={scrollRef} className="overflow-x-auto">
          <table className="w-full text-left border-collapse" style={{ minWidth: NAME_COL_WIDTH + weeks.length * WEEK_COL_WIDTH }}>
            <thead>
              <tr className="bg-bg-secondary/60 border-b border-border-light">
                <th className="sticky left-0 z-20 bg-bg-secondary/90 backdrop-blur h-10 px-4 text-[9px] font-bold text-gray-400 uppercase tracking-wider border-r border-border-light" style={{ width: NAME_COL_WIDTH, minWidth: NAME_COL_WIDTH, maxWidth: NAME_COL_WIDTH }}>
                  Employee
                </th>
                {weeks.map((week, wi) => (
                  <th key={wi} className="h-10 text-center text-[9px] font-bold text-gray-400 uppercase tracking-wider border-r border-border-light/60 last:border-r-0" style={{ width: WEEK_COL_WIDTH, minWidth: WEEK_COL_WIDTH, maxWidth: WEEK_COL_WIDTH }}>
                    {week.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id} className="border-b border-border-light group/row">
                  <td className="sticky left-0 z-10 bg-white group-hover/row:bg-orange-50/20 px-4 py-3 border-r border-border-light align-top transition-colors">
                    <Link to={`/employees/${emp.id}`} className="min-w-0 group/link block">
                      <p className="text-xs font-bold text-heading truncate group-hover/link:text-primary transition-colors">
                        {emp.name}
                      </p>
                      <p className="text-[9px] text-body/50 truncate mt-0.5">{emp.designation}</p>
                    </Link>
                  </td>
                  {weeks.map((week, wi) => {
                    const weekAllocs = getAllocsForWeek(emp.id, allocations, week.start, week.end);
                    const totalPct = weekAllocs.reduce((s, a) => s + a.percentage, 0);
                    const isOver = totalPct > settings.utilizationThresholdHigh;
                    const isBench = weekAllocs.length === 0;

                    return (
                      <td key={wi} className={cn(
                        'relative p-1 align-top border-r border-border-light/40 last:border-r-0 group-hover/row:bg-orange-50/10 transition-colors',
                        isBench ? 'bg-gray-50/60' : '',
                        isOver ? 'bg-red-50/70' : ''
                      )}>
                        {isOver && (
                          <div className="absolute top-1 right-1 z-10 pointer-events-none">
                            <AlertTriangle size={8} className="text-danger" />
                          </div>
                        )}
                        <div className="flex flex-col gap-1 min-h-[32px]">
                          {weekAllocs.length === 0 && (
                            <div className="flex-1 flex items-center justify-center">
                              <span className="text-[8px] text-gray-300 font-medium">—</span>
                            </div>
                          )}
                          {weekAllocs.map(a => {
                            const colorIdx = colorMap.get(a.projectId) ?? 0;
                            return (
                              <button
                                key={a.id}
                                className={cn(
                                  'w-full rounded px-1.5 py-1 text-left text-[8px] leading-tight font-bold border cursor-pointer hover:opacity-90 transition-opacity flex flex-col',
                                  isOver ? 'bg-red-50 text-red-700 border-red-200' : `${PROJECT_COLORS[colorIdx]} ${PROJECT_BORDER[colorIdx]}`
                                )}
                                title={`${a.projectName} · ${a.percentage}% · ${a.startDate} → ${a.endDate}`}
                                onClick={() => onEditAllocation(a)}
                                onMouseEnter={e => {
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  setTooltip({ alloc: a, x: rect.left, y: rect.top });
                                }}
                                onMouseLeave={() => setTooltip(null)}
                              >
                                <span className="opacity-90">{a.percentage}%</span>
                                <span className="truncate w-full block mt-0.5">{a.projectName}</span>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Total load footer row */}
      {employees.length === 0 && (
        <div className="py-12 text-center text-gray-400 text-xs font-medium">No employees match the current filters.</div>
      )}

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-slate-dark text-white text-[10px] rounded-xl px-3 py-2 shadow-2xl border border-white/10 max-w-[200px]"
          style={{ left: tooltip.x + 8, top: tooltip.y - 64 }}
        >
          <p className="font-bold truncate">{tooltip.alloc.projectName}</p>
          <p className="text-white/70 mt-0.5">{tooltip.alloc.percentage}% allocation</p>
          <p className="text-white/50 mt-0.5">{tooltip.alloc.startDate} → {tooltip.alloc.endDate}</p>
          {tooltip.alloc.billable && <p className="text-primary font-bold mt-1">Billable</p>}
        </div>
      )}
    </div>
  );
};
