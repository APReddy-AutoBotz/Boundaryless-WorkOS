import { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Link } from 'react-router-dom';
import { KPIStrip } from '../components/ui/KPIStrip';
import { Badge } from '../components/ui/Badge';
import { employeeService, adminService } from '../services/api';
import { Employee, CountryDirector, KPIData } from '../types';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  Download, 
  Filter, 
  Calendar, 
  Search, 
  AlertTriangle, 
  TrendingUp, 
  ArrowUpRight,
  ChevronRight,
  Info,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { downloadCsv } from '../lib/csv';
import { getUtilizationEligibleEmployees } from '../services/calculations';

const COLORS = ['#EF7D00', '#1E293B', '#64748B', '#94A3B8', '#CBD5E1'];

export const PlannedUtilization = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [directors, setDirectors] = useState<CountryDirector[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('All Departments');
  const [cdFilter, setCdFilter] = useState('All Directors');
  const [bandFilter, setBandFilter] = useState('All Bands');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [empData, cdData, setts] = await Promise.all([
          employeeService.getAll(),
          adminService.getCountryDirectors(),
          adminService.getSettings(),
        ]);
        setEmployees(empData);
        setDirectors(cdData);
        setSettings(setts);
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredEmployees = useMemo(() => {
    const eligibleEmployees = getUtilizationEligibleEmployees(employees);
    return eligibleEmployees.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = deptFilter === 'All Departments' || emp.department === deptFilter;
      
      const matchesCd = cdFilter === 'All Directors' || 
        emp.primaryCountryDirectorId === cdFilter || 
        (emp.mappedCountryDirectorIds && emp.mappedCountryDirectorIds.includes(cdFilter));

      let matchesBand = true;
      if (bandFilter === 'Over 100%') matchesBand = emp.plannedUtilization > settings.utilizationThresholdHigh;
      else if (bandFilter === '80-100%') matchesBand = emp.plannedUtilization >= 80 && emp.plannedUtilization <= 100;
      else if (bandFilter === 'Under 80%') matchesBand = emp.plannedUtilization < settings.utilizationThresholdLow;

      return matchesSearch && matchesDept && matchesCd && matchesBand;
    });
  }, [employees, searchQuery, deptFilter, cdFilter, bandFilter, settings]);

  const kpis = useMemo<KPIData[]>(() => {
    if (employees.length === 0) return [];
    
    const active = getUtilizationEligibleEmployees(employees);
    const totalPlanned = active.reduce((sum, e) => sum + e.plannedUtilization, 0);
    const avgPlanned = active.length > 0 ? (totalPlanned / active.length).toFixed(1) : 0;
    
    const overAllocated = active.filter(e => e.plannedUtilization > settings.utilizationThresholdHigh).length;
    const underUtilized = active.filter(e => e.plannedUtilization < settings.utilizationThresholdLow && e.plannedUtilization > settings.benchThreshold).length;
    const bench = active.filter(e => e.plannedUtilization <= settings.benchThreshold).length;
    
    return [
      { title: 'Avg. Planned Util.', value: `${avgPlanned}%`, icon: 'Target' },
      { title: 'Overloaded', value: overAllocated, change: 2, changeType: 'increase', icon: 'AlertTriangle' },
      { title: 'Underutilized', value: underUtilized, change: -3, changeType: 'decrease', icon: 'ArrowDownRight' },
      { title: 'Bench Count', value: bench, icon: 'Users' },
      { title: 'Overload Density', value: active.length > 0 ? (overAllocated / active.length * 100).toFixed(0) + '%' : '0%', icon: 'Activity' },
      { title: 'Utilization FTE', value: active.length, icon: 'Users' }
    ];
  }, [employees, settings]);

  const deptChartData = useMemo(() => {
    const eligibleEmployees = getUtilizationEligibleEmployees(employees);
    const depts = Array.from(new Set(eligibleEmployees.map(e => e.department)));
    return depts.map(dept => {
      const deptEmps = eligibleEmployees.filter(e => e.department === dept);
      const avg = deptEmps.length > 0 
        ? deptEmps.reduce((sum, e) => sum + e.plannedUtilization, 0) / deptEmps.length 
        : 0;
      return { name: dept, value: Math.round(avg) };
    }).sort((a, b) => b.value - a.value);
  }, [employees]);

  const cdChartData = useMemo(() => {
    const eligibleEmployees = getUtilizationEligibleEmployees(employees);
    return directors.map(cd => {
      const cdEmps = eligibleEmployees.filter(e =>
        (e.primaryCountryDirectorId === cd.id || (e.mappedCountryDirectorIds && e.mappedCountryDirectorIds.includes(cd.id))) && 
        e.status === 'Active'
      );
      const avg = cdEmps.length > 0 
        ? cdEmps.reduce((sum, e) => sum + e.plannedUtilization, 0) / cdEmps.length 
        : 0;
      return { name: cd.name, value: Math.round(avg) };
    }).slice(0, 5);
  }, [employees, directors]);

  const overAllocated = useMemo(() => {
    return getUtilizationEligibleEmployees(employees).filter(e => e.plannedUtilization > settings.utilizationThresholdHigh).sort((a,b) => b.plannedUtilization - a.plannedUtilization).slice(0, 4);
  }, [employees, settings]);

  const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
  const currentYear = new Date().getFullYear();

  const handleExport = () => {
    downloadCsv('planned-utilization-export.csv', filteredEmployees.map(emp => ({
      employeeId: emp.employeeId,
      name: emp.name,
      department: emp.department,
      country: emp.country,
      countryDirector: directors.find(director => director.id === emp.primaryCountryDirectorId)?.name || emp.primaryCountryDirectorId,
      plannedUtilization: emp.plannedUtilization,
      actualUtilization: emp.actualUtilization,
      activeProjectCount: emp.activeProjectCount,
      status: emp.status,
      utilizationEligible: 'Yes',
    })));
    adminService.logAction('Export', 'Planned Utilization', `Exported ${filteredEmployees.length} planned utilization rows`);
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 pb-12">
      <PageHeader 
        title="Planned Utilization" 
        subtitle="Forward-looking operational planning based on established project allocations."
        breadcrumb={['Analysis', 'Utilization']}
        actions={
          <div className="flex items-center gap-3">
             <div className="flex items-center bg-white border border-border-light rounded-xl p-1 shadow-sm mr-2">
                <div className="px-4 flex items-center gap-2 border-r border-gray-100 h-full py-1.5 cursor-pointer hover:bg-slate-50 transition-colors rounded-l-lg">
                   <Calendar size={14} className="text-primary" />
                   <span className="text-[10px] font-bold uppercase tracking-widest text-heading">Q{currentQuarter} {currentYear} Outlook</span>
                </div>
                <div className="group relative px-4 flex items-center gap-2 h-full py-1.5 cursor-pointer hover:bg-slate-50 transition-colors rounded-r-lg">
                   <Filter size={14} className="text-gray-400" />
                   <span className="text-[10px] font-bold uppercase tracking-widest text-heading">Global View</span>
                   <div className="absolute right-0 bottom-full mb-2 w-64 p-2 bg-slate-800 text-white text-[10px] rounded shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-20 font-medium normal-case tracking-normal">
                      Employees with multiple Country Director mappings appear in each of their mapped views.
                   </div>
                </div>
             </div>
             <button onClick={handleExport} className="btn-secondary py-2.5 px-5 flex items-center gap-2 shadow-sm font-bold text-xs uppercase tracking-wider">
                <Download size={14} /> Export Plan
             </button>
          </div>
        }
      />

      <KPIStrip kpis={kpis} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Main Chart Case */}
        <div className="lg:col-span-2 bg-white border border-border-light rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm font-bold text-heading">Planned Allocation by Department</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Strategic Resource Distribution</p>
            </div>
            <div className="flex items-center gap-2">
               <div className="flex items-center gap-1.5 mr-4">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  <span className="text-[9px] font-bold uppercase text-gray-400">Target 85%</span>
               </div>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart data={deptChartData} layout="vertical" margin={{ left: 40, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#F1F5F9" />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748B' }}
                  width={140}
                />
                <Tooltip 
                  cursor={{ fill: '#F8FAFC' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 'bold' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                  {deptChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.value > 90 ? '#EF7D00' : '#1E293B'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CD Breakdown / Mix */}
        <div className="bg-white border border-border-light rounded-3xl p-6 shadow-sm flex flex-col">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-heading">Mix by Practice Lead</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Country Director Mapping</p>
          </div>
          
          <div className="flex-1 flex flex-col justify-center">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <PieChart>
                  <Pie
                    data={cdChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {cdChartData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="grid grid-cols-2 gap-y-3 mt-4">
              {cdChartData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-heading leading-tight truncate max-w-[100px]">{item.name}</span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase">{item.value}% Avg.</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-orange-50 border border-primary/20 rounded-2xl p-5 shadow-sm">
           <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                 <AlertTriangle size={16} className="text-primary" />
                 <h4 className="text-[10px] font-bold text-heading uppercase tracking-widest">Over-Allocated</h4>
              </div>
              <ArrowUpRight size={14} className="text-primary" />
           </div>
           <div className="space-y-3">
              {overAllocated.map(e => (
                <div key={e.id} className="flex items-center justify-between">
                   <span className="text-xs font-bold text-heading truncate pr-2">{e.name}</span>
                   <span className="text-xs font-bold text-danger">{e.plannedUtilization}%</span>
                </div>
              ))}
              {overAllocated.length === 0 && <p className="text-[10px] text-gray-400 font-bold uppercase py-2">No critical overload</p>}
           </div>
        </div>

        <div className="bg-white border border-border-light rounded-2xl p-5 shadow-sm">
           <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-success" />
              <h4 className="text-[10px] font-bold text-heading uppercase tracking-widest">High Capacity Tech</h4>
           </div>
           <p className="text-xs text-body/70 font-medium mb-3 leading-relaxed">System Engineering units in EMEA show elevated planned load for the next quarter.</p>
           <button onClick={() => setBandFilter('Over 100%')} className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1 hover:underline">
             Deep Audit <ChevronRight size={14} />
           </button>
        </div>

        <div className="lg:col-span-2 bg-slate-dark text-white rounded-2xl p-6 flex flex-col justify-between shadow-xl">
           <div className="flex items-center gap-3">
              <Info size={18} className="text-primary" />
              <h4 className="text-sm font-bold tracking-tight">Allocation Governance Note</h4>
           </div>
           <p className="text-xs text-white/50 mt-3 leading-relaxed font-medium">
             Planned utilization is strictly derived from the Assignment Matrix. Ensure all "Proposed" projects are balanced 
             to avoid phantom capacity gaps. Practice managers must review over-allocations exceeding {settings.utilizationThresholdHigh}%.
           </p>
        </div>
      </div>

      {/* Drill Down Table */}
      <div className="bg-white border border-border-light rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-slate-50/50">
           <div className="flex items-center gap-4">
              <h3 className="text-sm font-bold text-heading">Resource Planning Drill-down</h3>
              <div className="relative">
                 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={12} />
                 <input 
                   type="text" 
                   placeholder="Filter resource name..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="bg-white border border-border-light rounded-lg py-1.5 pl-8 pr-3 text-[10px] outline-none focus:border-primary w-48 font-bold"
                 />
              </div>
           </div>
           <div className="flex items-center gap-3">
              <select 
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="bg-white border border-border-light rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none cursor-pointer"
              >
                <option>All Departments</option>
                {Array.from(new Set(employees.map(e => e.department))).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select 
                value={cdFilter}
                onChange={(e) => setCdFilter(e.target.value)}
                className="bg-white border border-border-light rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none cursor-pointer"
              >
                <option value="All Directors">All Directors</option>
                {directors.map(cd => <option key={cd.id} value={cd.id}>{cd.name}</option>)}
              </select>
              <select 
                value={bandFilter}
                onChange={(e) => setBandFilter(e.target.value)}
                className="bg-white border border-border-light rounded-lg px-2 py-1.5 text-[10px] font-bold outline-none cursor-pointer"
              >
                <option>All Bands</option>
                <option>Over 100%</option>
                <option>80-100%</option>
                <option>Under 80%</option>
              </select>
              <button onClick={handleExport} className="btn-secondary py-1.5 px-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                 <Download size={12} /> CSV
              </button>
           </div>
        </div>
        
        <div className="table-container">
          <table className="w-full text-left">
            <thead className="bg-white/50 border-b border-border-light">
              <tr>
                <th className="py-4 px-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Consultant</th>
                <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Department</th>
                <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Planned Load</th>
                <th className="py-4 px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Projects</th>
                <th className="py-4 px-8 text-[10px] font-bold text-right uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="py-5 px-8">
                     <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded bg-bg-secondary flex items-center justify-center font-bold text-xs text-primary shadow-sm border border-border-light/40">
                           {emp.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-heading group-hover:text-primary transition-colors">{emp.name}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{emp.employeeId}</p>
                        </div>
                     </div>
                  </td>
                  <td className="py-5 px-6">
                    <p className="text-xs font-bold text-heading">{emp.department}</p>
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-tight">{emp.country}</p>
                  </td>
                  <td className="py-5 px-6">
                    <div className="flex flex-col items-center">
                       <span className={cn(
                         "text-sm font-bold mb-1",
                         emp.plannedUtilization > 100 ? "text-danger" : "text-heading"
                       )}>{emp.plannedUtilization}%</span>
                       <div className="w-24 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full transition-all duration-500", emp.plannedUtilization > 100 ? "bg-danger" : "bg-primary")} 
                            style={{ width: `${Math.min(emp.plannedUtilization, 100)}%` }}
                          />
                       </div>
                    </div>
                  </td>
                  <td className="py-5 px-6 text-center">
                     <Badge variant="neutral" className="font-mono">{emp.activeProjectCount} Active</Badge>
                  </td>
                  <td className="py-5 px-8 text-right">
                     <Link to={`/employees/${emp.id}`} className="p-2 inline-block text-gray-300 hover:text-primary hover:bg-orange-50 rounded-lg transition-all">
                        <ChevronRight size={18} />
                     </Link>
                  </td>
                </tr>
              ))}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">No resources match defined criteria</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
