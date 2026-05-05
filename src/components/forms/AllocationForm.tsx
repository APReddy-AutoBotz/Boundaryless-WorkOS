import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Save, 
  User, 
  Briefcase, 
  Target, 
  Calendar, 
  AlertCircle,
  FileText
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { NoticeBanner } from '../ui/NoticeBanner';
import { employeeService, projectService, allocationService, adminService } from '../../services/api';
import { authService } from '../../services/authService';
import { Employee, Project, RoleDefinition } from '../../types';
import { ALLOCATION_STATUSES } from '../../constants/statuses';

interface AllocationFormProps {
  onClose: () => void;
  allocation?: any;
}

export const AllocationForm = ({ onClose, allocation }: AllocationFormProps) => {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [roleDefinitions, setRoleDefinitions] = useState<RoleDefinition[]>([]);
  const [settings, setSettings] = useState<any>({ utilizationThresholdHigh: 100, blockOverAllocation: false });
  
  // Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(allocation?.employeeId || '');
  const [selectedProjectId, setSelectedProjectId] = useState(allocation?.projectId || '');
  const [allocationPercent, setAllocationPercent] = useState(allocation?.percentage || 100);
  const [isBillable, setIsBillable] = useState((allocation?.billable ?? true).toString());
  const [status, setStatus] = useState(allocation?.status || 'Active');
  const [startDate, setStartDate] = useState(allocation?.startDate || '');
  const [endDate, setEndDate] = useState(allocation?.endDate || '');
  const [roleOnProject, setRoleOnProject] = useState(allocation?.roleOnProject || '');
  const [remarks, setRemarks] = useState(allocation?.remarks || '');
  const [formError, setFormError] = useState('');

  const [employeeAllocations, setEmployeeAllocations] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const user = authService.getCurrentUser();
      const [e, p, a, setts, roles] = await Promise.all([
        employeeService.getAll(),
        projectService.getAll(),
        allocationService.getAll(),
        adminService.getSettings(),
        adminService.getRoleDefinitions(),
      ]);
      setSettings(setts);
      setRoleDefinitions(roles);

      let scopedEmployees = e.filter(employee => employee.status === 'Active');
      let scopedProjects = p.filter(project => project.status !== 'Completed');

      if (user?.role === 'ProjectManager') {
        scopedProjects = scopedProjects.filter(proj => proj.managerId === user.id || proj.managerId === user.employeeId || proj.managerName === user.name);
      }

      if (user?.role === 'CountryDirector' && user.cdId) {
        scopedEmployees = scopedEmployees.filter(employee =>
          employee.primaryCountryDirectorId === user.cdId ||
          employee.mappedCountryDirectorIds.includes(user.cdId)
        );
      }

      if (allocation?.employeeId && !scopedEmployees.some(employee => employee.id === allocation.employeeId)) {
        const existingEmployee = e.find(employee => employee.id === allocation.employeeId);
        if (existingEmployee) scopedEmployees = [existingEmployee, ...scopedEmployees];
      }
      if (allocation?.projectId && !scopedProjects.some(project => project.id === allocation.projectId)) {
        const existingProject = p.find(project => project.id === allocation.projectId);
        if (existingProject) scopedProjects = [existingProject, ...scopedProjects];
      }

      setEmployees(scopedEmployees);
      setProjects(scopedProjects);
      setEmployeeAllocations(a);
    };
    fetchData();
  }, []);

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
  
  // Advanced overlap check
  const peakLoad = useMemo(() => {
    if (!selectedEmployeeId || !startDate || !endDate) return 0;
    
    // Simple overlap check: Filter current employee's other allocations that overlap with the new range
    const others = employeeAllocations.filter(a => 
      a.employeeId === selectedEmployeeId && 
      a.id !== (allocation?.id) &&
      a.status === 'Active' &&
      !(new Date(endDate) < new Date(a.startDate) || new Date(startDate) > new Date(a.endDate))
    );
    
    const base = others.reduce((sum, a) => sum + a.percentage, 0);
    return base + allocationPercent;
  }, [selectedEmployeeId, startDate, endDate, allocationPercent, employeeAllocations, allocation]);

  const isOverloading = peakLoad > settings.utilizationThresholdHigh;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!selectedEmployeeId || !selectedProjectId || !startDate || !endDate) return;
    if (new Date(startDate) > new Date(endDate)) {
      setFormError('End date must be on or after start date.');
      return;
    }
    if (settings.blockOverAllocation && isOverloading) {
      setFormError(`Allocation blocked: peak load ${peakLoad}% exceeds the configured ${settings.utilizationThresholdHigh}% threshold.`);
      return;
    }

    setLoading(true);
    
    const selectedProject = projects.find(p => p.id === selectedProjectId);
    
    const newAllocation: any = {
      id: allocation?.id || Math.random().toString(36).substr(2, 9),
      employeeId: selectedEmployeeId,
      projectId: selectedProjectId,
      projectName: selectedProject?.name || '',
      projectManager: selectedProject?.managerName || '',
      roleOnProject: roleOnProject || selectedEmployee?.designation || '',
      percentage: allocationPercent,
      startDate,
      endDate,
      status,
      billable: isBillable === 'true',
      remarks
    };

    try {
      await allocationService.save(newAllocation);
      await adminService.logAction(
        allocation ? 'Update' : 'Create',
        'Allocation Management',
        `${allocation ? 'Modified' : 'Created'} allocation for ${employees.find(e => e.id === selectedEmployeeId)?.name} on ${projects.find(p => p.id === selectedProjectId)?.name}`
      );
      onClose();
    } catch (error) {
      console.error("Failed to save allocation", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-border-light max-h-[90vh] flex flex-col">
      <div className="bg-slate-dark p-6 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-xl">
            <Target size={20} className="text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{allocation ? 'Modify Allocation' : 'Create New Allocation'}</h2>
            <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Planned Resource Placement</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-xl transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-8 overflow-y-auto space-y-8">
        {formError && (
          <NoticeBanner
            type="danger"
            title="Allocation Validation"
            message={formError}
            onClose={() => setFormError('')}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Main Selection */}
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <User size={14} /> Entity Mapping
              </h3>
              <div className="space-y-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-heading uppercase tracking-wider">Select Consultant</label>
                  <select 
                    required
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Choose Employee</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.designation})</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-heading uppercase tracking-wider">Select Project</label>
                  <select 
                    required
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Choose Project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.projectCode} - {p.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-[10px] font-bold text-heading uppercase tracking-wider">Role on This Project</label>
                    <select
                      value={roleOnProject}
                      onChange={(e) => setRoleOnProject(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="">{selectedEmployee?.designation || 'Use employee designation'}</option>
                      {roleDefinitions.map(role => <option key={role.id}>{role.name}</option>)}
                      <option>Business Analyst + Project Manager</option>
                      <option>RPA Developer + Solution Architect</option>
                      <option>Support Team + Operations Executive</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-heading uppercase tracking-wider">Billing Status</label>
                    <select 
                      value={isBillable}
                      onChange={(e) => setIsBillable(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                    >
                      <option value="true">Billable</option>
                      <option value="false">Non-Billable</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-heading uppercase tracking-wider">Allocation Status</label>
                    <select 
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                    >
                      {ALLOCATION_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Target size={14} /> Allocation Load
              </h3>
              <div className="space-y-4 pt-1">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-end mb-1">
                    <label className="text-[10px] font-bold text-heading uppercase tracking-wider">Allocation Percentage (%)</label>
                    <span className="text-xs font-bold text-primary">{allocationPercent}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0"
                    max="100"
                    step="5"
                    value={allocationPercent}
                    onChange={(e) => setAllocationPercent(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                    <span>Part Time (10-40%)</span>
                    <span>Standard (50-80%)</span>
                    <span>Full Time (100%)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Context & Cues */}
          <div className="space-y-6">
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-6">
              <h3 className="text-xs font-bold text-slate-dark uppercase tracking-widest">Utilisation Context</h3>
              
              {selectedEmployee ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-body">Current Planned Load</span>
                    <span className="text-xs font-bold text-heading">{selectedEmployee.plannedUtilization}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-body">Concurrent Load (Overlap)</span>
                    <span className={cn(
                      "text-sm font-bold",
                      isOverloading ? "text-danger" : "text-success"
                    )}>{peakLoad}%</span>
                  </div>
                  
                  {isOverloading && (
                    <div className="flex gap-3 p-4 bg-red-50 border border-red-100 rounded-xl">
                      <AlertCircle size={16} className="text-danger shrink-0 mt-0.5" />
                      <p className="text-[10px] text-danger/80 leading-relaxed font-medium">
                        <span className="font-bold">Over-utilisation Alert:</span> This allocation creates a {peakLoad}% peak for {selectedEmployee.name} during the selected period. Threshold is {settings.utilizationThresholdHigh}%.
                      </p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-200">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-3">Professional Mapping</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-dark font-medium truncate pr-4">Department</span>
                        <span className="font-bold text-heading">{selectedEmployee.department}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-dark font-medium truncate pr-4">Grade</span>
                        <span className="font-bold text-heading">{selectedEmployee.designation}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center space-y-3 opacity-40">
                  <User size={32} className="mx-auto text-gray-400" />
                  <p className="text-[10px] font-bold uppercase tracking-wider">Select a consultant for context</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <Calendar size={14} /> Schedule & Period
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-heading uppercase tracking-wider">Start Date</label>
                   <input 
                    type="date" 
                    required 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none" 
                   />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-heading uppercase tracking-wider">End Date</label>
                   <input 
                    type="date" 
                    required 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none" 
                   />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-heading uppercase tracking-wider">Allocation Logic / Remarks</label>
          <textarea 
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Reason for allocation, specific focus area, or utilization notes..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none"
          ></textarea>
        </div>

        <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
          <button 
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-dark hover:bg-slate-50 transition-all border border-transparent hover:border-slate-200"
          >
            Cancel
          </button>
          <button 
            type="submit"
            disabled={loading}
            className="px-8 py-2.5 rounded-xl text-xs font-bold bg-heading text-white hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center gap-2"
          >
            {loading ? 'Processing...' : (
              <>
                <Save size={14} /> {allocation ? 'Update Allocation' : 'Confirm Allocation'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
