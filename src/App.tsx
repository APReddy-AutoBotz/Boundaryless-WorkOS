import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AppLayout } from './components/Layout/AppLayout';
import { authService } from './services/authService';
import { hasRouteRole, ROUTE_ROLES } from './services/accessControl';
import { UserRole } from './types';
import { EnterpriseFeatureFlag, isEnterpriseFeatureEnabled } from './config/featureFlags';

const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const EmployeeMaster = lazy(() => import('./pages/EmployeeMaster').then(module => ({ default: module.EmployeeMaster })));
const EmployeeDetail = lazy(() => import('./pages/EmployeeDetail').then(module => ({ default: module.EmployeeDetail })));
const EmployeeWorkspace = lazy(() => import('./pages/EmployeeWorkspace').then(module => ({ default: module.EmployeeWorkspace })));
const ProjectMaster = lazy(() => import('./pages/ProjectMaster').then(module => ({ default: module.ProjectMaster })));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail').then(module => ({ default: module.ProjectDetail })));
const ProjectManagerWorkspace = lazy(() => import('./pages/ProjectManagerWorkspace').then(module => ({ default: module.ProjectManagerWorkspace })));
const ClientPortfolio = lazy(() => import('./pages/ClientPortfolio').then(module => ({ default: module.ClientPortfolio })));
const AllocationManagement = lazy(() => import('./pages/AllocationManagement').then(module => ({ default: module.AllocationManagement })));
const MyTimesheet = lazy(() => import('./pages/MyTimesheet').then(module => ({ default: module.MyTimesheet })));
const TimesheetApproval = lazy(() => import('./pages/TimesheetApproval').then(module => ({ default: module.TimesheetApproval })));
const PlannedUtilization = lazy(() => import('./pages/PlannedUtilization').then(module => ({ default: module.PlannedUtilization })));
const ActualUtilization = lazy(() => import('./pages/ActualUtilization').then(module => ({ default: module.ActualUtilization })));
const ForecastUtilization = lazy(() => import('./pages/ForecastUtilization').then(module => ({ default: module.ForecastUtilization })));
const DataQuality = lazy(() => import('./pages/DataQuality').then(module => ({ default: module.DataQuality })));
const BRDTraceability = lazy(() => import('./pages/BRDTraceability').then(module => ({ default: module.BRDTraceability })));
const EnterpriseModuleShell = lazy(() => import('./pages/EnterpriseModuleShell').then(module => ({ default: module.EnterpriseModuleShell })));
const ESSHome = lazy(() => import('./pages/LeaveManagement').then(module => ({ default: module.ESSHome })));
const MyLeave = lazy(() => import('./pages/LeaveManagement').then(module => ({ default: module.MyLeave })));
const TeamLeaveCalendar = lazy(() => import('./pages/LeaveManagement').then(module => ({ default: module.TeamLeaveCalendar })));
const LeaveAdmin = lazy(() => import('./pages/LeaveManagement').then(module => ({ default: module.LeaveAdmin })));
const ImportExport = lazy(() => import('./pages/ImportExport').then(module => ({ default: module.ImportExport })));
const AuditTrail = lazy(() => import('./pages/AuditTrail').then(module => ({ default: module.AuditTrail })));
const AdminSettings = lazy(() => import('./pages/AdminSettings').then(module => ({ default: module.AdminSettings })));
const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const RoleRoute = ({ children, roles }: { children: React.ReactNode; roles: readonly UserRole[] }) => {
  const user = authService.getCurrentUser();
  if (!hasRouteRole(user, roles)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const FeatureRoute = ({
  children,
  flag,
  roles,
}: {
  children: React.ReactNode;
  flag: EnterpriseFeatureFlag;
  roles: readonly UserRole[];
}) => {
  if (!isEnterpriseFeatureEnabled(flag)) {
    return <Navigate to="/governance/brd-traceability" replace />;
  }
  return <RoleRoute roles={roles}>{children}</RoleRoute>;
};

const getRoleHomePath = (role: UserRole) => {
  if (role === 'Employee') return '/my-workspace';
  if (role === 'ProjectManager') return '/pm-workspace';
  if (role === 'TeamLead') return '/timesheets/approval';
  return null;
};

const DashboardRoute = () => {
  const user = authService.getCurrentUser();
  if (!user) return <Navigate to="/login" replace />;
  if (!hasRouteRole(user, ROUTE_ROLES.dashboard)) {
    return <Navigate to={getRoleHomePath(user.role) || '/timesheets'} replace />;
  }
  return <Dashboard />;
};

const EmployeeDetailRoute = () => {
  const user = authService.getCurrentUser();
  if (!user) return <Navigate to="/" replace />;
  return <EmployeeDetail />;
};

const ProjectDetailRoute = () => {
  const user = authService.getCurrentUser();
  if (!user) return <Navigate to="/" replace />;
  return <ProjectDetail />;
};

const NotFound = () => (
  <div className="h-[60vh] flex flex-col items-center justify-center text-center px-6">
    <h1 className="text-3xl font-black text-heading">Page not found</h1>
    <p className="text-sm text-body/60 mt-2 max-w-md">The route you opened is not part of the utilization tracker workspace.</p>
    <Link to="/" className="btn-primary py-2.5 px-6 mt-8">Return to Dashboard</Link>
  </div>
);

const RouteFallback = () => (
  <div className="h-[50vh] flex items-center justify-center">
    <div className="h-8 w-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
  </div>
);

export default function App() {
  return (
    <Router>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
        
          <Route path="/*" element={
            <ProtectedRoute>
              <AppLayout>
                <Routes>
                  <Route path="/" element={<DashboardRoute />} />
                  <Route path="/dashboard" element={<Navigate to="/" replace />} />
                
                {/* Employee Routes */}
                <Route path="/my-workspace" element={
                  <RoleRoute roles={ROUTE_ROLES.employeeWorkspace}>
                    <EmployeeWorkspace />
                  </RoleRoute>
                } />
                <Route path="/employees" element={
                  <RoleRoute roles={ROUTE_ROLES.employees}>
                    <EmployeeMaster />
                  </RoleRoute>
                } />
                <Route path="/employees/:id" element={<EmployeeDetailRoute />} />
                
                {/* Project Routes */}
                <Route path="/pm-workspace" element={
                  <RoleRoute roles={ROUTE_ROLES.projectManagerWorkspace}>
                    <ProjectManagerWorkspace />
                  </RoleRoute>
                } />
                <Route path="/projects" element={
                  <RoleRoute roles={ROUTE_ROLES.projects}>
                    <ProjectMaster />
                  </RoleRoute>
                } />
                <Route path="/projects/:id" element={<ProjectDetailRoute />} />
                <Route path="/clients" element={
                  <RoleRoute roles={ROUTE_ROLES.clients}>
                    <ClientPortfolio />
                  </RoleRoute>
                } />
                
                <Route path="/allocations" element={
                  <RoleRoute roles={ROUTE_ROLES.allocations}>
                    <AllocationManagement />
                  </RoleRoute>
                } />
                <Route path="/timesheets" element={
                  <RoleRoute roles={ROUTE_ROLES.timesheets}>
                    <MyTimesheet />
                  </RoleRoute>
                } />
                <Route path="/timesheets/approval" element={
                  <RoleRoute roles={ROUTE_ROLES.timesheetApproval}>
                    <TimesheetApproval />
                  </RoleRoute>
                } />
                
                {/* Utilization Routes */}
                <Route path="/utilization/planned" element={
                  <RoleRoute roles={ROUTE_ROLES.utilization}>
                    <PlannedUtilization />
                  </RoleRoute>
                } />
                <Route path="/utilization/actual" element={
                  <RoleRoute roles={ROUTE_ROLES.utilization}>
                    <ActualUtilization />
                  </RoleRoute>
                } />
                <Route path="/utilization/forecast" element={
                  <RoleRoute roles={ROUTE_ROLES.utilization}>
                    <ForecastUtilization />
                  </RoleRoute>
                } />
                <Route path="/reports/data-quality" element={
                  <RoleRoute roles={ROUTE_ROLES.dataQuality}>
                    <DataQuality />
                  </RoleRoute>
                } />
                <Route path="/governance/brd-traceability" element={
                  <RoleRoute roles={ROUTE_ROLES.brdTraceability}>
                    <BRDTraceability />
                  </RoleRoute>
                } />
                <Route path="/ess" element={
                  <FeatureRoute flag="leave" roles={ROUTE_ROLES.ess}>
                    <ESSHome />
                  </FeatureRoute>
                } />
                <Route path="/leave/my" element={
                  <FeatureRoute flag="leave" roles={ROUTE_ROLES.leaveSelfService}>
                    <MyLeave />
                  </FeatureRoute>
                } />
                <Route path="/leave/team-calendar" element={
                  <FeatureRoute flag="leave" roles={ROUTE_ROLES.leaveTeam}>
                    <TeamLeaveCalendar />
                  </FeatureRoute>
                } />
                <Route path="/leave/admin" element={
                  <FeatureRoute flag="leave" roles={ROUTE_ROLES.leaveAdmin}>
                    <LeaveAdmin />
                  </FeatureRoute>
                } />
                <Route path="/approvals" element={
                  <FeatureRoute flag="notifications" roles={ROUTE_ROLES.approvals}>
                    <EnterpriseModuleShell
                      module="Approvals"
                      phase="Phase 3"
                      subtitle="Shared approval inbox and history for timesheets, leave, allocations, and future workflows."
                      capabilities={['My approvals inbox', 'Approval history and comments', 'Delegation and SLA foundation']}
                      nextMilestone="Create generic approval records and migrate timesheet approvals onto the shared model."
                    />
                  </FeatureRoute>
                } />
                <Route path="/notifications" element={
                  <FeatureRoute flag="notifications" roles={ROUTE_ROLES.notifications}>
                    <EnterpriseModuleShell
                      module="Notifications"
                      phase="Phase 4"
                      subtitle="In-app notification center with adapter-ready email and Teams delivery."
                      capabilities={['Notification inbox', 'Templates and preferences', 'Delivery attempts and audit']}
                      nextMilestone="Add notification events, templates, preferences, delivery attempts, and mock providers."
                    />
                  </FeatureRoute>
                } />
                <Route path="/integrations/identity" element={
                  <FeatureRoute flag="entra" roles={ROUTE_ROLES.identityIntegrations}>
                    <EnterpriseModuleShell
                      module="Identity"
                      phase="Phase 5"
                      subtitle="Microsoft Entra-ready identity mapping and role synchronization."
                      capabilities={['Identity provider links', 'Entra group-role mapping', 'Integration health checks']}
                      nextMilestone="Add identity provider link tables, Entra mapping UI, and local/mock adapter."
                    />
                  </FeatureRoute>
                } />
                <Route path="/integrations/teams" element={
                  <FeatureRoute flag="teams" roles={ROUTE_ROLES.teamsIntegrations}>
                    <EnterpriseModuleShell
                      module="Teams"
                      phase="Phase 5"
                      subtitle="Deterministic Teams action layer for approvals and portal links."
                      capabilities={['Teams user mapping', 'Teams action tokens', 'Mock Teams adapter and action audit']}
                      nextMilestone="Add Teams mapping, deterministic action token model, and mock provider adapter."
                    />
                  </FeatureRoute>
                } />
                <Route path="/planning/resources" element={
                  <FeatureRoute flag="planning" roles={ROUTE_ROLES.resourcePlanning}>
                    <EnterpriseModuleShell
                      module="Planning"
                      phase="Phase 6"
                      subtitle="Resource planning board backed by employees, allocations, utilization, leave, and holidays."
                      capabilities={['Availability timeline', 'Bench and roll-off view', 'Overload and underload view']}
                      nextMilestone="Add planning report APIs and visual board after leave availability data is available."
                    />
                  </FeatureRoute>
                } />
                <Route path="/reports/command-center" element={
                  <FeatureRoute flag="planning" roles={ROUTE_ROLES.workforceCommandCenter}>
                    <EnterpriseModuleShell
                      module="Command Center"
                      phase="Phase 6"
                      subtitle="Enterprise command center for capacity, approvals, notifications, identity, and data confidence."
                      capabilities={['Leave-adjusted availability', 'Approval and notification risk', 'Identity and Teams readiness']}
                      nextMilestone="Extend dashboard reports into workforce command-center APIs and UI."
                    />
                  </FeatureRoute>
                } />

                {/* System Routes */}
                <Route path="/import-export" element={
                  <RoleRoute roles={ROUTE_ROLES.importExport}>
                    <ImportExport />
                  </RoleRoute>
                } />
                <Route path="/audit-trail" element={
                  <RoleRoute roles={ROUTE_ROLES.auditTrail}>
                    <AuditTrail />
                  </RoleRoute>
                } />
                <Route path="/admin" element={
                  <RoleRoute roles={ROUTE_ROLES.adminSettings}>
                    <AdminSettings />
                  </RoleRoute>
                } />

                {/* Catch all */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AppLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </Suspense>
    </Router>
  );
}
