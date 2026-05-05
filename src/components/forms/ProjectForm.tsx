import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Briefcase, 
  Calendar, 
  User, 
  Building2, 
  Target,
  FileText,
  Loader2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Project, Employee, Client } from '../../types';
import { projectService, employeeService, clientService } from '../../services/api';
import { PROJECT_STATUSES } from '../../constants/statuses';

interface ProjectFormProps {
  onClose: () => void;
  onSave: () => void;
  project?: Project; // For edit mode
}

export const ProjectForm = ({ onClose, onSave, project }: ProjectFormProps) => {
  const [formData, setFormData] = useState<Partial<Project>>({
    name: '',
    projectCode: '',
    client: '',
    managerId: '',
    managerName: '',
    startDate: '',
    endDate: '',
    status: 'Proposed',
    billable: true,
    plannedUtilization: 0,
    actualUtilization: 0,
    resourceCount: 0,
    ...project
  });

  const [managers, setManagers] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      const [allEmployees, allClients] = await Promise.all([
        employeeService.getAll(),
        clientService.getAll(),
      ]);
      setManagers(allEmployees);
      setClients(allClients.filter(client => client.status === 'Active'));
    };
    load();
  }, []);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name) newErrors.name = 'Project Name is required';
    if (!formData.projectCode) newErrors.projectCode = 'Project Code is required';
    if (!formData.clientId && !formData.client) newErrors.client = 'Client is required';
    if (!formData.managerId) newErrors.managerId = 'Project Manager is required';
    if (!formData.startDate) newErrors.startDate = 'Start Date is required';
    if (!formData.endDate) newErrors.endDate = 'End Date is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const selectedManager = managers.find(m => m.id === formData.managerId);
      const selectedClient = clients.find(client => client.id === formData.clientId) ||
        clients.find(client => client.name.toLowerCase() === (formData.client || '').toLowerCase());
      const dataToSave: Project = {
        id: project?.id || `p-${Date.now()}`,
        ...formData as Project,
        clientId: selectedClient?.id || formData.clientId,
        client: selectedClient?.name || formData.client || '',
        managerName: selectedManager?.name || formData.managerName || ''
      };

      await projectService.save(dataToSave);
      onSave();
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-border-light max-h-[90vh] flex flex-col">
      <div className="bg-slate-dark p-6 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-xl">
            <Briefcase size={20} className="text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{project ? 'Edit Project Registry' : 'Register New Engagement'}</h2>
            <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Project Governance Initiation</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-xl transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-8 overflow-y-auto space-y-8 custom-scrollbar">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* General Information */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <FileText size={14} /> General Information
            </h3>
            <div className="space-y-4 pt-1">
              <div className="space-y-1.5 font-bold">
                <label className="text-[10px] font-bold text-heading uppercase tracking-wider">Project Name</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Cloud Migration Phase 2"
                  className={cn("w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all", errors.name ? "border-danger" : "border-slate-200")}
                />
              </div>
              <div className="space-y-1.5 font-bold">
                <label className="text-[10px] font-bold text-heading uppercase tracking-wider">Project Code</label>
                <input 
                  type="text" 
                  value={formData.projectCode}
                  onChange={(e) => setFormData({ ...formData, projectCode: e.target.value })}
                  placeholder="e.g. P-2026-CLOUD"
                  className={cn("w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono", errors.projectCode ? "border-danger" : "border-slate-200")}
                />
              </div>
            </div>
          </div>

          {/* Client & Ownership */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Building2 size={14} /> Client & Ownership
            </h3>
            <div className="space-y-4 pt-1">
              <div className="space-y-1.5 font-bold">
                <label className="text-[10px] font-bold text-heading uppercase tracking-wider">Client</label>
                <select
                  value={formData.clientId || clients.find(client => client.name === formData.client)?.id || ''}
                  onChange={(e) => {
                    const selectedClient = clients.find(client => client.id === e.target.value);
                    setFormData({ ...formData, clientId: selectedClient?.id || '', client: selectedClient?.name || '' });
                  }}
                  className={cn("w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none cursor-pointer", errors.client ? "border-danger" : "border-slate-200")}
                >
                  <option value="">Select Client</option>
                  {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
                <p className="text-[10px] text-slate-400 font-medium">New clients are managed in Client Portfolio to keep project reporting consistent.</p>
              </div>
              <div className="space-y-1.5 font-bold">
                <label className="text-[10px] font-bold text-heading uppercase tracking-wider">Project Manager</label>
                <select 
                  value={formData.managerId}
                  onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                  className={cn("w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none cursor-pointer", errors.managerId ? "border-danger" : "border-slate-200")}
                >
                  <option value="">Select Project Lead</option>
                  {managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Delivery Metadata */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Target size={14} /> Delivery Metadata
            </h3>
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-4 font-bold">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-heading uppercase tracking-wider">Billing Mode</label>
                  <select 
                    value={formData.billable ? 'Billable' : 'Non-Billable'}
                    onChange={(e) => setFormData({ ...formData, billable: e.target.value === 'Billable' })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none"
                  >
                    <option value="Billable">Billable</option>
                    <option value="Non-Billable">Non-Billable</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-heading uppercase tracking-wider">Resource Plan</label>
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[11px] font-bold text-slate-500">
                    Managed in Allocation Control
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline & Status */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Calendar size={14} /> Timeline & Status
            </h3>
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-2 gap-4 font-bold">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-heading uppercase tracking-wider">Start Date</label>
                  <input 
                    type="date" 
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className={cn("w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all", errors.startDate ? "border-danger" : "border-slate-200")}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-heading uppercase tracking-wider">End Date</label>
                  <input 
                    type="date" 
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className={cn("w-full bg-slate-50 border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all", errors.endDate ? "border-danger" : "border-slate-200")}
                  />
                </div>
              </div>
              <div className="space-y-1.5 font-bold">
                <label className="text-[10px] font-bold text-heading uppercase tracking-wider">Current Status</label>
                <select 
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                >
                  {PROJECT_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </div>
          </div>
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
            {loading ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            {project ? 'Save Changes' : 'Register Project'}
          </button>
        </div>
      </form>
    </div>
  );
};
