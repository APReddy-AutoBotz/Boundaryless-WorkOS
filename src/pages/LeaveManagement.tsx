import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarDays, CheckCircle2, Clock, ShieldCheck, UserRound, XCircle } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { authService } from '../services/authService';
import { employeeService, leaveService } from '../services/api';
import type { Employee, HolidayCalendar, LeaveAvailabilityEntry, LeaveBalance, LeavePolicy, LeaveRequest, LeaveType } from '../types';
import { formatHours } from '../lib/format';

type LeaveViewState = {
  employees: Employee[];
  types: LeaveType[];
  policies: LeavePolicy[];
  calendars: HolidayCalendar[];
  balances: LeaveBalance[];
  requests: LeaveRequest[];
  availability: LeaveAvailabilityEntry[];
};

const emptyState: LeaveViewState = {
  employees: [],
  types: [],
  policies: [],
  calendars: [],
  balances: [],
  requests: [],
  availability: [],
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const loadLeaveViewState = async (): Promise<LeaveViewState> => {
  const [employees, types, policies, calendars, balances, requests, availability] = await Promise.all([
    employeeService.getAll(),
    leaveService.getTypes(),
    leaveService.getPolicies(),
    leaveService.getHolidayCalendars(),
    leaveService.getBalances(),
    leaveService.getRequests(),
    leaveService.getAvailability(),
  ]);
  return { employees, types, policies, calendars, balances, requests, availability };
};

const useLeaveViewState = () => {
  const [state, setState] = useState(emptyState);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    setLoading(true);
    setState(await loadLeaveViewState());
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  return { state, loading, notice, setNotice, refresh };
};

const getCurrentEmployee = (employees: Employee[]) => {
  const user = authService.getCurrentUser();
  return employees.find(employee => employee.id === user?.employeeId || employee.employeeId === user?.employeeId) || employees[0];
};

const statusVariant = (status: LeaveRequest['status']) => {
  if (status === 'Approved') return 'success';
  if (status === 'Rejected' || status === 'Cancelled') return 'danger';
  if (status === 'Submitted') return 'warning';
  return 'neutral';
};

const SummaryTile = ({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub: string; icon: typeof CalendarDays }) => (
  <Card className="p-0">
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <p className="mt-2 text-2xl font-black text-heading">{value}</p>
        <p className="mt-1 text-xs font-bold text-body/60">{sub}</p>
      </div>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-primary">
        <Icon size={21} />
      </div>
    </div>
  </Card>
);

export const ESSHome = () => {
  const { state, loading } = useLeaveViewState();
  const employee = getCurrentEmployee(state.employees);
  const balances = state.balances.filter(balance => balance.employeeId === employee?.id);
  const requests = state.requests.filter(request => request.employeeId === employee?.id);
  const availability = state.availability.find(row => row.employeeId === employee?.id);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Employee Self-Service"
        subtitle="Profile, availability, leave balance, and personal workforce actions."
        breadcrumb={['Workforce OS', 'ESS']}
      />
      {loading ? <Card>Loading employee self-service data...</Card> : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <SummaryTile label="Profile" value={employee?.employeeId || '-'} sub={employee?.designation || 'Employee'} icon={UserRound} />
            <SummaryTile label="Available Leave" value={balances.reduce((sum, balance) => sum + balance.availableDays, 0).toFixed(1)} sub="Days across active balances" icon={CalendarDays} />
            <SummaryTile label="Pending Requests" value={requests.filter(request => request.status === 'Submitted').length} sub="Awaiting decision" icon={Clock} />
            <SummaryTile label="Availability" value={availability ? formatHours(availability.availabilityHours) : '-'} sub="Leave and holiday adjusted" icon={ShieldCheck} />
          </div>
          <Card title="My Profile">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                ['Name', employee?.name],
                ['Email', employee?.email],
                ['Department', employee?.department],
                ['Country', employee?.country],
                ['Capacity Type', employee?.capacityType || 'Delivery'],
                ['Standard Weekly Hours', employee?.standardWeeklyHours || 40],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                  <p className="mt-1 text-sm font-bold text-heading">{value}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export const MyLeave = () => {
  const { state, loading, notice, setNotice, refresh } = useLeaveViewState();
  const employee = getCurrentEmployee(state.employees);
  const defaultType = state.types.find(type => type.active);
  const [form, setForm] = useState({
    leaveTypeId: '',
    startDate: todayIso(),
    endDate: todayIso(),
    reason: '',
  });

  useEffect(() => {
    if (!form.leaveTypeId && defaultType) {
      setForm(current => ({ ...current, leaveTypeId: defaultType.id }));
    }
  }, [defaultType, form.leaveTypeId]);

  const balances = state.balances.filter(balance => balance.employeeId === employee?.id);
  const requests = state.requests.filter(request => request.employeeId === employee?.id);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!employee || !form.leaveTypeId) return;
    await leaveService.submitRequest({
      id: '',
      employeeId: employee.id,
      leaveTypeId: form.leaveTypeId,
      startDate: form.startDate,
      endDate: form.endDate,
      totalDays: 0,
      status: 'Submitted',
      reason: form.reason,
    });
    setNotice('Leave request submitted for approval.');
    setForm(current => ({ ...current, reason: '' }));
    await refresh();
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="My Leave"
        subtitle="Request leave, check balances, and track approval status."
        breadcrumb={['Workforce OS', 'Leave', 'My Leave']}
      />
      {notice && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">{notice}</div>}
      {loading ? <Card>Loading leave data...</Card> : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <Card title="Leave Balance">
              <div className="space-y-3">
                {balances.map(balance => (
                  <div key={balance.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-heading">{balance.leaveTypeName}</p>
                      <Badge variant="info">{balance.year}</Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                      <div><p className="text-xl font-black text-heading">{balance.availableDays.toFixed(1)}</p><p className="text-[10px] font-bold uppercase text-slate-400">Available</p></div>
                      <div><p className="text-xl font-black text-heading">{balance.usedDays.toFixed(1)}</p><p className="text-[10px] font-bold uppercase text-slate-400">Used</p></div>
                      <div><p className="text-xl font-black text-heading">{balance.pendingDays.toFixed(1)}</p><p className="text-[10px] font-bold uppercase text-slate-400">Pending</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="New Leave Request">
              <form onSubmit={submit} className="space-y-4">
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Leave Type</span>
                  <select value={form.leaveTypeId} onChange={event => setForm({ ...form, leaveTypeId: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold">
                    {state.types.filter(type => type.active).map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start</span>
                    <input type="date" value={form.startDate} onChange={event => setForm({ ...form, startDate: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold" />
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">End</span>
                    <input type="date" value={form.endDate} onChange={event => setForm({ ...form, endDate: event.target.value })} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold" />
                  </label>
                </div>
                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reason</span>
                  <textarea value={form.reason} onChange={event => setForm({ ...form, reason: event.target.value })} className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium" />
                </label>
                <button className="btn-primary w-full py-2.5" type="submit">Submit Request</button>
              </form>
            </Card>
          </div>
          <LeaveRequestTable requests={requests} />
        </div>
      )}
    </div>
  );
};

const LeaveRequestTable = ({ requests, onApprove, onReject }: { requests: LeaveRequest[]; onApprove?: (request: LeaveRequest) => void; onReject?: (request: LeaveRequest) => void }) => (
  <Card title="Leave Requests">
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <th className="py-3 pr-4">Employee</th>
            <th className="py-3 pr-4">Type</th>
            <th className="py-3 pr-4">Dates</th>
            <th className="py-3 pr-4">Days</th>
            <th className="py-3 pr-4">Status</th>
            {(onApprove || onReject) && <th className="py-3 text-right">Action</th>}
          </tr>
        </thead>
        <tbody>
          {requests.map(request => (
            <tr key={request.id} className="border-b border-slate-50">
              <td className="py-3 pr-4 font-bold text-heading">{request.employeeName || request.employeeId}</td>
              <td className="py-3 pr-4 text-body">{request.leaveTypeName || request.leaveTypeId}</td>
              <td className="py-3 pr-4 text-body">{request.startDate} to {request.endDate}</td>
              <td className="py-3 pr-4 font-black text-heading">{request.totalDays.toFixed(1)}</td>
              <td className="py-3 pr-4"><Badge variant={statusVariant(request.status)}>{request.status}</Badge></td>
              {(onApprove || onReject) && (
                <td className="py-3 text-right">
                  {request.status === 'Submitted' && (
                    <div className="flex justify-end gap-2">
                      <button className="rounded-lg border border-green-200 bg-green-50 p-2 text-green-700" title="Approve" onClick={() => onApprove?.(request)}><CheckCircle2 size={16} /></button>
                      <button className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-700" title="Reject" onClick={() => onReject?.(request)}><XCircle size={16} /></button>
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
          {requests.length === 0 && (
            <tr><td className="py-8 text-center text-sm font-bold text-slate-400" colSpan={6}>No leave requests in this scope.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  </Card>
);

export const TeamLeaveCalendar = () => {
  const { state, loading, notice, setNotice, refresh } = useLeaveViewState();

  const decide = async (request: LeaveRequest, status: 'Approved' | 'Rejected') => {
    await leaveService.updateRequestStatus(request.id, status, status === 'Rejected' ? 'Rejected from team calendar.' : undefined);
    setNotice(`${status} leave request for ${request.employeeName || request.employeeId}.`);
    await refresh();
  };

  const approved = state.requests.filter(request => request.status === 'Approved');

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Team Leave Calendar"
        subtitle="Scoped leave requests, approved absences, and leave-adjusted availability."
        breadcrumb={['Workforce OS', 'Leave', 'Team Calendar']}
      />
      {notice && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">{notice}</div>}
      {loading ? <Card>Loading team leave calendar...</Card> : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <SummaryTile label="Pending Approval" value={state.requests.filter(request => request.status === 'Submitted').length} sub="Requests requiring decision" icon={Clock} />
            <SummaryTile label="Approved Leave" value={approved.length} sub="Approved requests in scope" icon={CheckCircle2} />
            <SummaryTile label="Availability Rows" value={state.availability.length} sub="Employees with capacity view" icon={CalendarDays} />
          </div>
          <LeaveRequestTable requests={state.requests} onApprove={request => decide(request, 'Approved')} onReject={request => decide(request, 'Rejected')} />
          <Card title="Availability Timeline">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {state.availability.slice(0, 12).map(row => (
                <div key={row.employeeId} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-heading">{row.employeeName}</p>
                    <Badge variant={row.approvedLeaveDays > 0 ? 'warning' : 'success'}>{formatHours(row.availabilityHours)}</Badge>
                  </div>
                  <p className="mt-2 text-xs font-bold text-body/60">{row.approvedLeaveDays} leave days, {row.holidayDays} holidays, {row.standardWeeklyHours}h standard week</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export const LeaveAdmin = () => {
  const { state, loading, notice, setNotice, refresh } = useLeaveViewState();
  const [policyName, setPolicyName] = useState('Regional Leave Policy');
  const [country, setCountry] = useState('Global');
  const [allowance, setAllowance] = useState(24);

  const savePolicy = async () => {
    await leaveService.savePolicy({
      id: `leave-policy-${country.toLowerCase().replace(/[^a-z0-9]+/g, '-') || crypto.randomUUID()}`,
      name: policyName,
      country,
      annualAllowanceDays: allowance,
      carryForwardDays: 5,
      accrualMethod: 'Annual',
      status: 'Active',
      leaveTypeIds: state.types.filter(type => type.active).map(type => type.id),
    });
    setNotice('Leave policy saved with audit coverage.');
    await refresh();
  };

  const balanceRows = useMemo(() => state.balances.slice(0, 20), [state.balances]);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Leave Administration"
        subtitle="Policies, leave types, balances, holiday calendars, and leave reporting."
        breadcrumb={['Workforce OS', 'Leave', 'Administration']}
      />
      {notice && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">{notice}</div>}
      {loading ? <Card>Loading leave administration...</Card> : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-6">
            <Card title="Policy Setup">
              <div className="space-y-4">
                <input value={policyName} onChange={event => setPolicyName(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold" />
                <div className="grid grid-cols-2 gap-3">
                  <input value={country} onChange={event => setCountry(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold" />
                  <input type="number" value={allowance} onChange={event => setAllowance(Number(event.target.value))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold" />
                </div>
                <button type="button" onClick={savePolicy} className="btn-primary w-full py-2.5">Save Policy</button>
              </div>
            </Card>
            <Card title="Holiday Calendars">
              <div className="space-y-3">
                {state.calendars.map(calendar => (
                  <div key={calendar.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-black text-heading">{calendar.name}</p>
                      <Badge variant={calendar.status === 'Active' ? 'success' : 'neutral'}>{calendar.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs font-bold text-body/60">{calendar.country} | {calendar.year} | {calendar.holidays.length} holidays</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div className="space-y-6">
            <Card title="Leave Policies">
              <div className="space-y-3">
                {state.policies.map(policy => (
                  <div key={policy.id} className="rounded-lg border border-slate-100 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-heading">{policy.name}</p>
                      <Badge variant={policy.status === 'Active' ? 'success' : 'neutral'}>{policy.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs font-bold text-body/60">{policy.country} | {policy.annualAllowanceDays} days | carry forward {policy.carryForwardDays}</p>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Leave Reports">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="py-3 pr-4">Employee</th>
                      <th className="py-3 pr-4">Type</th>
                      <th className="py-3 pr-4">Available</th>
                      <th className="py-3 pr-4">Used</th>
                      <th className="py-3 pr-4">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balanceRows.map(balance => (
                      <tr key={balance.id} className="border-b border-slate-50">
                        <td className="py-3 pr-4 font-bold text-heading">{balance.employeeName || balance.employeeId}</td>
                        <td className="py-3 pr-4">{balance.leaveTypeName || balance.leaveTypeId}</td>
                        <td className="py-3 pr-4 font-black">{balance.availableDays.toFixed(1)}</td>
                        <td className="py-3 pr-4">{balance.usedDays.toFixed(1)}</td>
                        <td className="py-3 pr-4">{balance.pendingDays.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
