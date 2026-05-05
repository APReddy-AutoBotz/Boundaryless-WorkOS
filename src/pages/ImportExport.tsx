import { useEffect, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Badge } from '../components/ui/Badge';
import {
  Upload,
  Download,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Search,
  Filter,
  ArrowUpRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { allocationService, clientService, employeeService, projectService, timesheetService, adminService } from '../services/api';
import { Employee, Project, Allocation, ImportExportLog, Client } from '../types';

type ImportChannel = 'employees' | 'clients' | 'projects' | 'allocations' | 'timesheets';
type CsvRow = Record<string, string>;
type ImportErrorRow = {
  rowNumber: number;
  field?: string;
  message: string;
};
type PendingImport = {
  id: ImportChannel;
  title: string;
  fileName: string;
  rows: CsvRow[];
  validRows: CsvRow[];
  errors: ImportErrorRow[];
};

const importOptions: Array<{ id: ImportChannel; title: string; description: string; icon: typeof FileText }> = [
  { id: 'employees', title: 'Employee Master', description: 'Bulk onboard or update resources, skills, and mapping.', icon: FileText },
  { id: 'clients', title: 'Client Master', description: 'Bulk create or update clients, industries, and director scope.', icon: FileText },
  { id: 'projects', title: 'Project Master', description: 'Batch create projects, managers, clients, and timelines.', icon: FileText },
  { id: 'allocations', title: 'Allocation Control', description: 'Validate assignment matrix and percentage loads.', icon: FileText },
  { id: 'timesheets', title: 'Timesheet Import', description: 'Blocked until backend validation is available.', icon: FileText },
];

const exportOptions = [
  { id: 'master_emp', title: 'Employee Master Export', filters: ['Status', 'Dept', 'CD'], formats: ['CSV'] },
  { id: 'master_client', title: 'Client Master Export', filters: ['Status', 'Industry', 'CD'], formats: ['CSV'] },
  { id: 'master_prj', title: 'Project Master Export', filters: ['Status', 'Client', 'Manager'], formats: ['CSV'] },
  { id: 'util_report', title: 'Utilization Analysis', filters: ['Date Range', 'Horizon', 'Region'], formats: ['CSV'] },
  { id: 'timesheet_logs', title: 'Timesheet Audit Export', filters: ['Week End', 'Approval status'], formats: ['CSV'] },
  { id: 'alloc_matrix', title: 'Allocation Matrix', filters: ['Resource', 'Project'], formats: ['CSV'] },
  { id: 'system_audit', title: 'Full Traceability Audit', filters: ['Date Range', 'User Role'], formats: ['CSV'] },
];

const employeeStatuses: Employee['status'][] = ['Active', 'On Leave', 'Exited'];
const projectStatuses: Project['status'][] = ['Proposed', 'Active', 'On Hold', 'Completed'];
const allocationStatuses: Allocation['status'][] = ['Active', 'Paused', 'Completed'];
const clientStatuses: Client['status'][] = ['Active', 'Inactive'];

const isValidDate = (value: string) => !Number.isNaN(new Date(value).getTime());
const isDateOrderValid = (startDate: string, endDate: string) => isValidDate(startDate) && isValidDate(endDate) && new Date(endDate) >= new Date(startDate);

export const ImportExport = () => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [lastResult, setLastResult] = useState<string>('');
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [history, setHistory] = useState<ImportExportLog[]>([]);

  const refreshHistory = async () => setHistory(await adminService.getImportExportLogs());

  useEffect(() => {
    refreshHistory();
  }, []);

  const toCsv = (rows: object[]) => {
    if (rows.length === 0) return '';
    const headerSet = rows.reduce<Set<string>>((set, row) => {
      Object.keys(row as Record<string, unknown>).forEach(key => set.add(key));
      return set;
    }, new Set<string>());
    const headers = Array.from(headerSet);
    return [headers, ...rows.map(row => {
      const record = row as Record<string, unknown>;
      return headers.map(header => record[header] ?? '');
    })]
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  };

  const downloadCsv = (fileName: string, rows: object[], channel = fileName) => {
    const csv = toCsv(rows);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    adminService.saveImportExportLog({
      operation: 'Export',
      channel,
      fileName,
      status: 'Success',
      totalRows: rows.length,
      validRows: rows.length,
      errorRows: 0,
    });
    refreshHistory();
  };

  const parseCsv = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return [];
    const [headerLine, ...lines] = trimmed.split(/\r?\n/);
    const splitCsvLine = (line: string) => line
      .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      .map(value => value.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
    const headers = splitCsvLine(headerLine);
    return lines.filter(Boolean).map(line => {
      const values = splitCsvLine(line);
      return headers.reduce<CsvRow>((row, header, index) => {
        row[header] = values[index] || '';
        return row;
      }, {});
    });
  };

  const addError = (errors: ImportErrorRow[], rowNumber: number, field: string, message: string) => {
    errors.push({ rowNumber, field, message });
  };

  const validateRows = async (id: ImportChannel, rows: CsvRow[]) => {
    const errors: ImportErrorRow[] = [];
    const [employees, projects, directors] = await Promise.all([
      employeeService.getAll(),
      projectService.getAll(),
      adminService.getCountryDirectors(),
    ]);
    const employeeIds = new Set(employees.flatMap(employee => [employee.id, employee.employeeId]));
    const projectIds = new Set(projects.flatMap(project => [project.id, project.projectCode]));
    const directorIds = new Set(directors.map(director => director.id));
    const rowsWithErrors = new Set<number>();

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const before = errors.length;

      if (id === 'employees') {
        if (!row.employeeId) addError(errors, rowNumber, 'employeeId', 'Employee ID is required.');
        if (!row.name) addError(errors, rowNumber, 'name', 'Employee name is required.');
        if (!row.email) addError(errors, rowNumber, 'email', 'Email is required.');
        if (row.email && !row.email.includes('@')) addError(errors, rowNumber, 'email', 'Email format is invalid.');
        if (row.status && !employeeStatuses.includes(row.status as Employee['status'])) {
          addError(errors, rowNumber, 'status', `Status must be one of: ${employeeStatuses.join(', ')}.`);
        }
        if (row.primaryCountryDirectorId && !directorIds.has(row.primaryCountryDirectorId)) {
          addError(errors, rowNumber, 'primaryCountryDirectorId', 'Primary country director does not exist.');
        }
        (row.mappedCountryDirectorIds || '').split('|').filter(Boolean).forEach(cdId => {
          if (!directorIds.has(cdId)) addError(errors, rowNumber, 'mappedCountryDirectorIds', `Country director ${cdId} does not exist.`);
        });
      }

      if (id === 'projects') {
        if (!row.projectCode) addError(errors, rowNumber, 'projectCode', 'Project code is required.');
        if (!row.name) addError(errors, rowNumber, 'name', 'Project name is required.');
        if (!row.client) addError(errors, rowNumber, 'client', 'Client is required.');
        if (!row.managerId) addError(errors, rowNumber, 'managerId', 'Project manager is required.');
        if (row.managerId && !employeeIds.has(row.managerId)) addError(errors, rowNumber, 'managerId', 'Project manager employee record does not exist.');
        if (!row.startDate || !isValidDate(row.startDate)) addError(errors, rowNumber, 'startDate', 'Valid start date is required.');
        if (!row.endDate || !isValidDate(row.endDate)) addError(errors, rowNumber, 'endDate', 'Valid end date is required.');
        if (row.startDate && row.endDate && !isDateOrderValid(row.startDate, row.endDate)) {
          addError(errors, rowNumber, 'endDate', 'End date must be on or after start date.');
        }
        if (row.status && !projectStatuses.includes(row.status as Project['status'])) {
          addError(errors, rowNumber, 'status', `Status must be one of: ${projectStatuses.join(', ')}.`);
        }
      }

      if (id === 'clients') {
        if (!row.name) addError(errors, rowNumber, 'name', 'Client name is required.');
        if (row.status && !clientStatuses.includes(row.status as Client['status'])) {
          addError(errors, rowNumber, 'status', `Status must be one of: ${clientStatuses.join(', ')}.`);
        }
        (row.countryDirectorIds || '').split('|').filter(Boolean).forEach(cdId => {
          if (!directorIds.has(cdId)) addError(errors, rowNumber, 'countryDirectorIds', `Country director ${cdId} does not exist.`);
        });
      }

      if (id === 'allocations') {
        if (!row.employeeId) addError(errors, rowNumber, 'employeeId', 'Employee ID is required.');
        if (row.employeeId && !employeeIds.has(row.employeeId)) addError(errors, rowNumber, 'employeeId', 'Employee does not exist.');
        if (!row.projectId) addError(errors, rowNumber, 'projectId', 'Project ID is required.');
        if (row.projectId && !projectIds.has(row.projectId)) addError(errors, rowNumber, 'projectId', 'Project does not exist.');
        const percentage = Number(row.percentage);
        if (!row.percentage || Number.isNaN(percentage) || percentage <= 0 || percentage > 200) {
          addError(errors, rowNumber, 'percentage', 'Percentage must be a number between 1 and 200.');
        }
        if (!row.startDate || !isValidDate(row.startDate)) addError(errors, rowNumber, 'startDate', 'Valid start date is required.');
        if (!row.endDate || !isValidDate(row.endDate)) addError(errors, rowNumber, 'endDate', 'Valid end date is required.');
        if (row.startDate && row.endDate && !isDateOrderValid(row.startDate, row.endDate)) {
          addError(errors, rowNumber, 'endDate', 'End date must be on or after start date.');
        }
        if (row.status && !allocationStatuses.includes(row.status as Allocation['status'])) {
          addError(errors, rowNumber, 'status', `Status must be one of: ${allocationStatuses.join(', ')}.`);
        }
      }

      if (id === 'timesheets') {
        addError(errors, rowNumber, 'timesheets', 'Timesheet import is blocked until backend validation is available.');
      }

      if (errors.length > before) rowsWithErrors.add(rowNumber);
    });

    return {
      errors,
      validRows: rows.filter((_, index) => !rowsWithErrors.has(index + 2)),
    };
  };

  const handleExport = async (id: string) => {
    if (id === 'master_emp') {
      downloadCsv('employees.csv', (await employeeService.getAll()).map(e => ({ ...e, mappedCountryDirectorIds: e.mappedCountryDirectorIds.join('|') })), 'Employee Master Export');
    } else if (id === 'master_client') {
      downloadCsv('clients.csv', (await clientService.getAll()).map(client => ({ ...client, countryDirectorIds: client.countryDirectorIds.join('|') })), 'Client Master Export');
    } else if (id === 'master_prj') {
      downloadCsv('projects.csv', await projectService.getAll(), 'Project Master Export');
    } else if (id === 'timesheet_logs') {
      downloadCsv('timesheets.csv', (await timesheetService.getAll()).map(t => ({ ...t, entries: JSON.stringify(t.entries) })), 'Timesheet Audit Export');
    } else if (id === 'alloc_matrix') {
      downloadCsv('allocations.csv', await allocationService.getAll(), 'Allocation Matrix');
    } else if (id === 'system_audit') {
      downloadCsv('audit-logs.csv', await adminService.getAuditLogs(), 'Full Traceability Audit');
    } else {
      const employees = await employeeService.getAll();
      downloadCsv('utilization-report.csv', employees.map(e => ({
        employeeId: e.employeeId,
        name: e.name,
        department: e.department,
        country: e.country,
        plannedUtilization: e.plannedUtilization,
        actualUtilization: e.actualUtilization,
        activeProjectCount: e.activeProjectCount,
        status: e.status
      })), 'Utilization Analysis');
    }
  };

  const handleImport = async (id: ImportChannel, file?: File) => {
    if (!file) return;
    const rows = parseCsv(await file.text());
    const option = importOptions.find(item => item.id === id);
    const { validRows, errors } = await validateRows(id, rows);
    const status: ImportExportLog['status'] = id === 'timesheets' || validRows.length === 0 ? 'Failed' : 'Dry Run';

    setPendingImport(id === 'timesheets' ? null : { id, title: option?.title || id, fileName: file.name, rows, validRows, errors });
    setLastResult(
      status === 'Failed'
        ? `${option?.title || id} validation failed for ${file.name}. Download the error report and correct the file.`
        : `Dry run complete for ${file.name}: ${validRows.length}/${rows.length} rows are valid. Review errors before applying.`
    );
    adminService.saveImportExportLog({
      operation: 'Import',
      channel: option?.title || id,
      fileName: file.name,
      status,
      totalRows: rows.length,
      validRows: validRows.length,
      errorRows: errors.length,
      errors,
    });
    refreshHistory();
  };

  const applyPendingImport = async () => {
    if (!pendingImport) return;
    let saved = 0;

    if (pendingImport.id === 'employees') {
      const existing = await employeeService.getAll();
      for (const row of pendingImport.validRows) {
        const current = existing.find(e => e.employeeId === row.employeeId || e.email === row.email);
        const employee: Employee = {
          id: current?.id || `e-${Date.now()}-${saved}`,
          employeeId: row.employeeId,
          name: row.name,
          email: row.email,
          designation: row.designation || current?.designation || 'Consultant',
          department: row.department || current?.department || 'Digital Transformation',
          country: row.country || current?.country || 'United Kingdom',
          primaryCountryDirectorId: row.primaryCountryDirectorId || current?.primaryCountryDirectorId || 'cd-1',
          mappedCountryDirectorIds: (row.mappedCountryDirectorIds || current?.mappedCountryDirectorIds?.join('|') || row.primaryCountryDirectorId || 'cd-1').split('|').filter(Boolean),
          status: (row.status as Employee['status']) || current?.status || 'Active',
          plannedUtilization: current?.plannedUtilization || 0,
          actualUtilization: current?.actualUtilization || 0,
          activeProjectCount: current?.activeProjectCount || 0,
        };
        await employeeService.save(employee);
        saved += 1;
      }
    }

    if (pendingImport.id === 'clients') {
      const existing = await clientService.getAll();
      for (const row of pendingImport.validRows) {
        const current = existing.find(client => client.name.toLowerCase() === row.name.toLowerCase() || client.id === row.id);
        const client: Client = {
          id: current?.id || row.id || `client-${Date.now()}-${saved}`,
          name: row.name,
          industry: row.industry || current?.industry || 'Unclassified',
          accountOwnerId: row.accountOwnerId || current?.accountOwnerId,
          countryDirectorIds: (row.countryDirectorIds || current?.countryDirectorIds?.join('|') || '').split('|').filter(Boolean),
          status: (row.status as Client['status']) || current?.status || 'Active',
          createdAt: current?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await clientService.save(client);
        saved += 1;
      }
    }

    if (pendingImport.id === 'projects') {
      const [existing, allEmployees] = await Promise.all([projectService.getAll(), employeeService.getAll()]);
      for (const row of pendingImport.validRows) {
        const current = existing.find(p => p.projectCode === row.projectCode);
        const manager = allEmployees.find(employee => employee.id === row.managerId || employee.employeeId === row.managerId);
        const project: Project = {
          id: current?.id || `p-${Date.now()}-${saved}`,
          projectCode: row.projectCode,
          name: row.name,
          clientId: row.clientId || current?.clientId,
          client: row.client,
          managerId: manager?.id || row.managerId,
          managerName: manager?.name || current?.managerName || '',
          startDate: row.startDate || current?.startDate || new Date().toISOString().split('T')[0],
          endDate: row.endDate || current?.endDate || new Date().toISOString().split('T')[0],
          status: (row.status as Project['status']) || current?.status || 'Proposed',
          billable: row.billable ? row.billable === 'true' : current?.billable ?? true,
          plannedUtilization: current?.plannedUtilization || 0,
          actualUtilization: current?.actualUtilization || 0,
          resourceCount: current?.resourceCount || 0,
        };
        await projectService.save(project);
        saved += 1;
      }
    }

    if (pendingImport.id === 'allocations') {
      const [allEmployees, allProjects] = await Promise.all([employeeService.getAll(), projectService.getAll()]);
      for (const row of pendingImport.validRows) {
        const employee = allEmployees.find(item => item.id === row.employeeId || item.employeeId === row.employeeId);
        const project = allProjects.find(item => item.id === row.projectId || item.projectCode === row.projectId);
        if (!employee || !project) continue;
        const allocation: Allocation = {
          id: row.id || `a-${Date.now()}-${saved}`,
          employeeId: employee.id,
          projectId: project.id,
          projectName: project.name,
          projectManager: project.managerName,
          roleOnProject: row.roleOnProject || employee.designation,
          percentage: Number(row.percentage),
          startDate: row.startDate,
          endDate: row.endDate,
          billable: row.billable ? row.billable === 'true' : true,
          status: (row.status as Allocation['status']) || 'Active',
        };
        await allocationService.save(allocation);
        saved += 1;
      }
    }

    await adminService.saveImportExportLog({
      operation: 'Import',
      channel: pendingImport.title,
      fileName: pendingImport.fileName,
      status: pendingImport.errors.length > 0 ? 'Partial' : 'Success',
      totalRows: pendingImport.rows.length,
      validRows: saved,
      errorRows: pendingImport.errors.length,
      errors: pendingImport.errors,
    });
    setLastResult(`Applied ${saved} valid ${pendingImport.title.toLowerCase()} rows from ${pendingImport.fileName}.`);
    setPendingImport(null);
    refreshHistory();
  };

  const downloadErrorReport = () => {
    if (!pendingImport) return;
    downloadCsv(`${pendingImport.id}-import-errors.csv`, pendingImport.errors.map(error => ({
      fileName: pendingImport.fileName,
      channel: pendingImport.title,
      rowNumber: error.rowNumber,
      field: error.field || '',
      message: error.message,
    })), `${pendingImport.title} Error Report`);
  };

  const handleTemplate = (id: ImportChannel) => {
    const templates: Record<ImportChannel, Record<string, unknown>[]> = {
      employees: [{
        employeeId: 'BL-999',
        name: 'Example Consultant',
        email: 'example@boundaryless.com',
        designation: 'Consultant',
        department: 'Digital Transformation',
        country: 'United Kingdom',
        primaryCountryDirectorId: 'cd-1',
        mappedCountryDirectorIds: 'cd-1|cd-3',
        status: 'Active'
      }], 
      clients: [{
        id: 'client-example',
        name: 'Example Client',
        industry: 'Banking',
        countryDirectorIds: 'cd-1|cd-3',
        status: 'Active'
      }],
      projects: [{
        projectCode: 'P-2026-EXAMPLE',
        name: 'Example Client Delivery',
        client: 'Example Client',
        managerId: 'pm-1',
        startDate: '2026-05-01',
        endDate: '2026-08-31',
        status: 'Proposed',
        billable: true
      }],
      allocations: [{
        employeeId: 'e-3',
        projectId: 'p-1',
        percentage: 50,
        startDate: '2026-05-01',
        endDate: '2026-08-31',
        roleOnProject: 'RPA Developer',
        billable: true,
        status: 'Active'
      }],
      timesheets: [{
        employeeId: 'e-3',
        weekEnding: '2026-05-01',
        workType: 'Project Work',
        projectId: 'p-1',
        date: '2026-04-27',
        hours: 8,
        remark: 'Client project delivery'
      }]
    };
    downloadCsv(`${id}-template.csv`, templates[id] || [], `${id} Template`);
  };

  const historyIcon = (status: ImportExportLog['status']) => {
    if (status === 'Success') return { icon: CheckCircle2, color: 'text-success' };
    if (status === 'Dry Run') return { icon: Clock, color: 'text-primary' };
    return { icon: AlertCircle, color: 'text-danger' };
  };

  return (
    <div className="animate-in fade-in duration-500 pb-12">
      <PageHeader
        title="Import / Export"
        subtitle="Controlled bulk data operations and operational report generation center."
        breadcrumb={['System', 'Data Management']}
      />

      <div className="flex bg-slate-50 p-1 rounded-2xl w-fit mb-8 border border-slate-100">
         <button
           onClick={() => setActiveTab('import')}
           className={cn(
             "px-8 py-2.5 text-xs font-bold uppercase tracking-widest transition-all rounded-xl",
             activeTab === 'import' ? "bg-white text-heading shadow-sm" : "text-gray-400 hover:text-heading"
           )}
         >
           Bulk Imports
         </button>
         <button
           onClick={() => setActiveTab('export')}
           className={cn(
             "px-8 py-2.5 text-xs font-bold uppercase tracking-widest transition-all rounded-xl",
             activeTab === 'export' ? "bg-white text-heading shadow-sm" : "text-gray-400 hover:text-heading"
           )}
         >
           Data Exports
         </button>
      </div>

      {lastResult && (
        <div className="mb-8 bg-orange-50 border border-primary/20 rounded-2xl px-5 py-4 text-xs font-bold text-heading flex flex-wrap items-center justify-between gap-4">
          <span>{lastResult}</span>
          {pendingImport && (
            <div className="flex flex-wrap gap-3">
              {pendingImport.errors.length > 0 && (
                <button
                  onClick={downloadErrorReport}
                  className="px-4 py-2 bg-white border border-primary/20 rounded-xl text-[10px] uppercase tracking-widest text-primary"
                >
                  Download Errors
                </button>
              )}
              <button
                onClick={applyPendingImport}
                disabled={pendingImport.validRows.length === 0}
                className="btn-primary px-4 py-2 rounded-xl text-[10px] uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply Valid Rows
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'import' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="space-y-6">
              <h3 className="text-sm font-bold text-heading uppercase tracking-widest px-1">Import Channels</h3>
              {importOptions.map(option => (
                <div key={option.id} className="bg-white border border-border-light rounded-2xl p-6 shadow-sm hover:border-primary/30 transition-all group">
                   <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-dark group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                            <option.icon size={20} />
                         </div>
                         <div>
                            <h4 className="text-sm font-bold text-heading">{option.title}</h4>
                            <p className="text-xs text-body/60 mt-1">{option.description}</p>
                         </div>
                      </div>
                      <Badge variant={option.id === 'timesheets' ? 'warning' : 'neutral'} className="text-[9px] font-mono">
                        {option.id === 'timesheets' ? 'BACKEND' : 'READY'}
                      </Badge>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => handleTemplate(option.id)}
                        className="flex items-center justify-center gap-2 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl text-[10px] font-bold uppercase tracking-widest text-heading transition-colors"
                      >
                         <Download size={14} className="text-primary" /> Template
                      </button>
                      <label className="flex items-center justify-center gap-2 py-3 bg-white border-2 border-dashed border-slate-200 hover:border-primary/50 hover:bg-orange-50 rounded-xl text-[10px] font-bold uppercase tracking-widest text-primary transition-all cursor-pointer">
                         <Upload size={14} /> Dry Run CSV
                         <input
                          type="file"
                          accept=".csv,text/csv"
                          className="hidden"
                          onChange={(event) => handleImport(option.id, event.target.files?.[0])}
                         />
                      </label>
                   </div>
                </div>
              ))}
           </div>

           <div className="space-y-8">
              <div className="bg-slate-dark text-white rounded-3xl p-8 shadow-xl relative overflow-hidden">
                 <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                       <ShieldCheck className="text-primary" size={24} />
                       <h3 className="text-lg font-bold tracking-tight">Import Governance</h3>
                    </div>
                    <ul className="space-y-4">
                       {[
                         { label: 'CSV Dry Run First', desc: 'Uploads validate headers, required fields, references, dates, and statuses before writing data.' },
                         { label: 'Apply Valid Rows', desc: 'Users explicitly apply validated rows; invalid rows stay out and can be downloaded as an error report.' },
                         { label: 'Traceable Operations', desc: 'Every dry run, final import, error report, template, and export is logged with user and timestamp.' },
                       ].map((rule, idx) => (
                         <li key={idx} className="flex gap-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                            <div>
                               <p className="text-xs font-bold text-white/90">{rule.label}</p>
                               <p className="text-[10px] text-white/40 mt-0.5">{rule.desc}</p>
                            </div>
                         </li>
                       ))}
                    </ul>
                 </div>
                 <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] -mr-32 -mt-32 rounded-full" />
              </div>

              <div className="bg-white border border-border-light rounded-3xl p-8 shadow-sm">
                 <h3 className="text-sm font-bold text-heading uppercase tracking-widest mb-8 flex items-center justify-between">
                    Import / Export History
                    <Badge variant="neutral" className="text-[9px]">LIVE</Badge>
                 </h3>
                 <div className="space-y-6">
                    {history.length === 0 && (
                      <div className="p-4 bg-slate-50 rounded-2xl text-xs text-body/60">
                        No bulk data operations have been run yet in this workspace.
                      </div>
                    )}
                    {history.slice(0, 8).map(item => {
                      const { icon: Icon, color } = historyIcon(item.status);
                      return (
                        <div key={item.id} className="flex items-start gap-4 p-4 hover:bg-slate-50 rounded-2xl transition-colors group cursor-default border border-transparent hover:border-slate-100">
                           <div className={cn("mt-0.5", color)}>
                              <Icon size={16} />
                           </div>
                           <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-heading truncate">{item.fileName}</p>
                              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.operation}</span>
                                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">-</span>
                                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.status}</span>
                                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.validRows}/{item.totalRows} valid</span>
                              </div>
                              <p className="text-[10px] text-body/40 mt-1">{new Date(item.timestamp).toLocaleString()} by {item.userName}</p>
                           </div>
                           <button className="opacity-0 group-hover:opacity-100 p-2 text-primary hover:bg-orange-50 rounded-lg transition-all" title={item.channel}>
                              <ArrowUpRight size={16} />
                           </button>
                        </div>
                      );
                    })}
                 </div>
              </div>
           </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {exportOptions.map(option => (
                <div key={option.id} className="bg-white border border-border-light rounded-3xl p-6 shadow-sm hover:shadow-xl hover:border-primary/20 transition-all flex flex-col group">
                   <div className="flex items-center justify-between mb-6">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                         <Search size={18} />
                      </div>
                      <div className="flex gap-1.5">
                         {option.formats.map(f => (
                           <span key={f} className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-100 rounded text-gray-500">{f}</span>
                         ))}
                      </div>
                   </div>

                   <h4 className="text-sm font-bold text-heading mb-2">{option.title}</h4>
                   <div className="flex flex-wrap gap-2 mb-8">
                      {option.filters.map(filter => (
                        <div key={filter} className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                           <Filter size={10} /> {filter}
                        </div>
                      ))}
                   </div>

                   <div className="mt-auto pt-6 border-t border-slate-50 flex items-center gap-3">
                      <select className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-xs font-bold text-heading outline-none focus:border-primary transition-all shadow-sm">
                         <option>Standard CSV</option>
                         <option>Audit CSV</option>
                         <option>Raw CSV</option>
                      </select>
                      <button
                        onClick={() => handleExport(option.id)}
                        className="btn-primary p-3 rounded-xl shadow-lg shadow-primary/20"
                      >
                         <Download size={18} />
                      </button>
                   </div>
                </div>
              ))}
           </div>

           <div className="bg-orange-50 border border-primary/20 rounded-3xl p-8 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-6">
                 <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-primary shadow-md">
                    <ShieldCheck size={32} />
                 </div>
                 <div>
                    <h4 className="text-lg font-bold text-heading tracking-tight">Access Controlled Reporting</h4>
                    <p className="text-sm text-body/70 mt-1 leading-relaxed max-w-lg">
                       Exports are audited and restricted by system role. Current implementation supports CSV output;
                       XLSX/PDF generation remains a backend roadmap item.
                    </p>
                 </div>
              </div>
              <button
                onClick={() => { window.location.href = '/admin'; }}
                className="btn-secondary py-3 px-8 text-xs font-bold uppercase tracking-widest shadow-sm"
              >
                 Permissions Admin
              </button>
           </div>
        </div>
      )}
    </div>
  );
};
