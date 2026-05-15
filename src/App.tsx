import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AppLayout } from './components/Layout/AppLayout';
import { authService } from './services/authService';
import { hasRouteRole, ROUTE_ROLES } from './services/accessControl';
import { UserRole } from './types';

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
