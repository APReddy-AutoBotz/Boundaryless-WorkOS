export type UserRole = 'Admin' | 'HR' | 'CountryDirector' | 'ProjectManager' | 'TeamLead' | 'Employee';

export interface UserSession {
  id: string;
  userName: string;
  employeeId: string;
  name: string;
  email: string;
  role: UserRole;
  availableRoles: UserRole[];
  cdId?: string; // ID from CountryDirector object
  avatar?: string;
  mustChangePassword?: boolean;
  lastLogin: string;
}

export interface UserAccount {
  id: string;
  userName: string;
  employeeRecordId: string;
  employeeId: string;
  email: string;
  displayName: string;
  passwordHash: string;
  roles: UserRole[];
  primaryRole: UserRole;
  status: 'Active' | 'Disabled';
  mustChangePassword?: boolean;
  lastLogin?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  activeRole?: string;
  source?: 'Web' | 'Teams' | 'Email' | 'Import' | 'System' | string;
  action: string;
  module: string;
  details: string;
  entityType?: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  ipAddress?: string;
  sessionId?: string;
  timestamp: string;
}

export interface ImportExportLog {
  id: string;
  operation: 'Import' | 'Export';
  channel: string;
  fileName: string;
  status: 'Success' | 'Partial' | 'Failed' | 'Dry Run';
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors?: Array<{
    rowNumber: number;
    field?: string;
    message: string;
  }>;
  userName: string;
  timestamp: string;
}

export interface SystemSettings {
  utilizationThresholdHigh: number;
  utilizationThresholdLow: number;
  timesheetPolicyMaxHours: number;
  expectedWeeklyHours: number;
  benchThreshold: number;
  blockOverAllocation?: boolean;
  demoSubmissionMode?: boolean;
  currency: string;
}

export interface DataQualityIssue {
  entityType: string;
  entityId: string;
  entity: string;
  issueType: string;
  owner: string;
  impact: string;
  suggestedAction: string;
}

export interface DataQualityReport {
  score: number;
  totalRecords: number;
  issueCount: number;
  byType: Record<string, number>;
  issues: DataQualityIssue[];
  generatedAt: string;
}

export interface DashboardReport {
  generatedAt: string;
  settings: Record<string, unknown>;
  workforce: {
    activePeople: number;
    utilizationEligibleFte: number;
    governanceUsers: number;
  };
  projectStaffingRisks: number;
  pendingTimesheets: number;
  dataQuality: DataQualityReport;
}

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  paid: boolean;
  requiresApproval: boolean;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeavePolicy {
  id: string;
  name: string;
  country: string;
  annualAllowanceDays: number;
  carryForwardDays: number;
  accrualMethod: 'Annual' | 'Monthly' | 'Manual' | string;
  status: 'Active' | 'Inactive';
  leaveTypeIds: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Holiday {
  id: string;
  calendarId: string;
  name: string;
  date: string;
  type: 'Public' | 'Company' | 'Regional' | string;
}

export interface HolidayCalendar {
  id: string;
  name: string;
  country: string;
  year: number;
  status: 'Active' | 'Inactive';
  holidays: Holiday[];
  createdAt?: string;
  updatedAt?: string;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  employeeName?: string;
  leaveTypeId: string;
  leaveTypeName?: string;
  policyId?: string;
  year: number;
  openingDays: number;
  accruedDays: number;
  usedDays: number;
  adjustedDays: number;
  pendingDays: number;
  availableDays: number;
  updatedAt?: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName?: string;
  leaveTypeId: string;
  leaveTypeName?: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Cancelled';
  reason?: string;
  approverId?: string;
  approverName?: string;
  comments?: string;
  submittedAt?: string;
  decidedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeaveAvailabilityEntry {
  employeeId: string;
  employeeName: string;
  standardWeeklyHours: number;
  approvedLeaveDays: number;
  holidayDays: number;
  availabilityHours: number;
}

export interface ApprovalRecord {
  id: string;
  entityType: 'Timesheet' | 'LeaveRequest' | 'AllocationChange' | string;
  entityId: string;
  subjectEmployeeId?: string;
  subjectEmployeeName?: string;
  requesterId?: string;
  requesterName?: string;
  approverId?: string;
  approverName?: string;
  approverRole?: UserRole | string;
  activeRole?: UserRole | string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  comments?: string;
  source?: 'Web' | 'Teams' | 'Email' | 'Import' | 'System' | string;
  auditLogId?: string;
  dueAt?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ApprovalDelegation {
  id: string;
  delegatorId: string;
  delegatorName?: string;
  delegateId: string;
  delegateName?: string;
  role: UserRole | string;
  startDate: string;
  endDate: string;
  status: 'Active' | 'Inactive';
  reason?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApprovalSlaReport {
  generatedAt: string;
  pendingCount: number;
  overdueCount: number;
  averageAgeHours: number;
  rows: ApprovalRecord[];
}

export interface CountryDirector {
  id: string;
  name: string;
  region: string;
}

export interface Client {
  id: string;
  name: string;
  industry: string;
  accountOwnerId?: string;
  countryDirectorIds: string[];
  status: 'Active' | 'Inactive';
  createdAt: string;
  updatedAt: string;
}

export interface RoleDefinition {
  id: string;
  name: string;
  department: string;
  description?: string;
  active: boolean;
  createdAt: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Employee {
  id: string;
  employeeId: string; // Corporate ID
  name: string;
  email: string;
  designation: string;
  department: string;
  country: string;
  reportingManagerId?: string;
  primaryCountryDirectorId: string;
  mappedCountryDirectorIds: string[]; // Supports many-to-many mapping
  avatar?: string;
  status: 'Active' | 'On Leave' | 'Exited';
  utilizationEligible?: boolean;
  joiningDate?: string;
  exitDate?: string;
  standardWeeklyHours?: number;
  capacityType?: 'Delivery' | 'Governance' | 'Shared' | 'NonDelivery' | string;
  contractType?: 'Permanent' | 'Contractor' | 'FixedTerm' | 'Intern' | string;
  leavePolicyId?: string;
  entraObjectId?: string;
  teamsUserId?: string;
  plannedUtilization: number;
  actualUtilization: number;
  activeProjectCount: number;
}

export interface Project {
  id: string;
  projectCode: string;
  name: string;
  clientId?: string;
  client: string;
  managerId: string;
  managerName: string;
  startDate: string;
  endDate: string;
  status: 'Proposed' | 'Active' | 'On Hold' | 'Completed';
  billable: boolean;
  plannedUtilization: number;
  actualUtilization: number;
  resourceCount: number;
}

export interface Allocation {
  id: string;
  employeeId: string;
  projectId: string;
  projectName: string;
  projectManager: string;
  roleOnProject?: string;
  percentage: number;
  startDate: string;
  endDate: string;
  billable: boolean;
  status: 'Active' | 'Paused' | 'Completed';
}

export type WorkType = 'Project Work' | 'Client Misc Task';

export interface TimesheetEntry {
  id: string;
  employeeId: string;
  projectId?: string;
  projectName?: string;
  workType: WorkType;
  clientName?: string; // For misc tasks
  category?: string;
  date: string;
  hours: number;
  remark?: string;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  billable: true; // All client work is billable/client effort
  weekEnding: string;
}

export interface TimesheetSummary {
  id?: string;
  employeeId: string;
  employeeName: string;
  weekEnding: string;
  totalHours: number;
  billableHours: number;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  rejectionNote?: string;
  rejectionReason?: string;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  updatedAt?: string;
  entries: TimesheetEntry[];
}

export interface KPIData {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon: string;
}

export interface UtilizationTrendEntry {
  period: string; // e.g., "Week 1", "Apr 2026"
  planned?: number;
  actual?: number;
  forecast?: number;
}

export interface UtilizationByGroup {
  name: string;
  value: number;
}

export type UtilizationReportMode = 'planned' | 'actual' | 'forecast';

export interface UtilizationReport {
  mode: UtilizationReportMode;
  asOfDate: string;
  sourceDate: string;
  forecastMonths: number | null;
  expectedWeeklyHours: number;
  thresholds: {
    high: number;
    low: number;
    bench: number;
  };
  summary: {
    rows: number;
    averagePlanned: number;
    averageActual: number;
    overloaded: number;
    underutilized: number;
    bench: number;
  };
  rows: Employee[];
}
