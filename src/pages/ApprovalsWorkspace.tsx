import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, History, ShieldCheck, XCircle } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { approvalService } from '../services/api';
import type { ApprovalDelegation, ApprovalRecord, ApprovalSlaReport } from '../types';

const statusVariant = (status: ApprovalRecord['status']) => {
  if (status === 'Approved') return 'success';
  if (status === 'Rejected' || status === 'Cancelled') return 'danger';
  if (status === 'Pending') return 'warning';
  return 'neutral';
};

const formatDateTime = (value?: string) => value ? new Date(value).toLocaleString(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}) : '-';

const Metric = ({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub: string; icon: typeof Clock }) => (
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

const ApprovalTable = ({
  title,
  rows,
  onDecide,
}: {
  title: string;
  rows: ApprovalRecord[];
  onDecide?: (record: ApprovalRecord, status: 'Approved' | 'Rejected') => void;
}) => (
  <Card title={title}>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <th className="py-3 pr-4">Item</th>
            <th className="py-3 pr-4">Employee</th>
            <th className="py-3 pr-4">Submitted</th>
            <th className="py-3 pr-4">Due</th>
            <th className="py-3 pr-4">Status</th>
            {onDecide && <th className="py-3 text-right">Action</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(record => (
            <tr key={record.id} className="border-b border-slate-50">
              <td className="py-3 pr-4">
                <p className="font-black text-heading">{record.entityType}</p>
                <p className="mt-1 max-w-52 truncate text-[10px] font-bold text-slate-400">{record.entityId}</p>
              </td>
              <td className="py-3 pr-4 font-bold text-heading">{record.subjectEmployeeName || record.subjectEmployeeId || '-'}</td>
              <td className="py-3 pr-4 text-body">{formatDateTime(record.createdAt)}</td>
              <td className="py-3 pr-4 text-body">{formatDateTime(record.dueAt)}</td>
              <td className="py-3 pr-4"><Badge variant={statusVariant(record.status)}>{record.status}</Badge></td>
              {onDecide && (
                <td className="py-3 text-right">
                  {record.status === 'Pending' && (
                    <div className="flex justify-end gap-2">
                      <button className="rounded-lg border border-green-200 bg-green-50 p-2 text-green-700" title="Approve" onClick={() => onDecide(record, 'Approved')}>
                        <CheckCircle2 size={16} />
                      </button>
                      <button className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-700" title="Reject" onClick={() => onDecide(record, 'Rejected')}>
                        <XCircle size={16} />
                      </button>
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td className="py-8 text-center text-sm font-bold text-slate-400" colSpan={onDecide ? 6 : 5}>No approval records in this scope.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  </Card>
);

export const ApprovalsWorkspace = () => {
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [delegations, setDelegations] = useState<ApprovalDelegation[]>([]);
  const [sla, setSla] = useState<ApprovalSlaReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    setLoading(true);
    const [approvalRows, delegationRows, slaReport] = await Promise.all([
      approvalService.getAll(),
      approvalService.getDelegations(),
      approvalService.getSlaReport(),
    ]);
    setApprovals(approvalRows);
    setDelegations(delegationRows);
    setSla(slaReport);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const pending = useMemo(() => approvals.filter(record => record.status === 'Pending'), [approvals]);
  const history = useMemo(() => approvals.filter(record => record.status !== 'Pending'), [approvals]);

  const decide = async (record: ApprovalRecord, status: 'Approved' | 'Rejected') => {
    const comments = status === 'Rejected' ? 'Rejected from shared approval workspace.' : undefined;
    await approvalService.decide(record.id, status, comments);
    setNotice(`${status} ${record.entityType} approval.`);
    await refresh();
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="My Approvals"
        subtitle="Shared approval inbox, approval history, delegations, and SLA governance."
        breadcrumb={['Workforce OS', 'Approvals']}
      />
      {notice && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">{notice}</div>}
      {loading ? <Card>Loading approval workspace...</Card> : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <Metric label="Pending" value={pending.length} sub="Open approval records" icon={Clock} />
            <Metric label="Overdue" value={sla?.overdueCount || 0} sub="Past configured SLA" icon={ShieldCheck} />
            <Metric label="Avg Age" value={`${sla?.averageAgeHours || 0}h`} sub="Pending approval age" icon={History} />
            <Metric label="Delegations" value={delegations.filter(item => item.status === 'Active').length} sub="Active delegation rows" icon={CheckCircle2} />
          </div>
          <ApprovalTable title="Approval Inbox" rows={pending} onDecide={decide} />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <ApprovalTable title="Approval History" rows={history.slice(0, 20)} />
            <Card title="Approval Delegations">
              <div className="space-y-3">
                {delegations.map(delegation => (
                  <div key={delegation.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-heading">{delegation.delegatorName || delegation.delegatorId} to {delegation.delegateName || delegation.delegateId}</p>
                      <Badge variant={delegation.status === 'Active' ? 'success' : 'neutral'}>{delegation.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs font-bold text-body/60">{delegation.role} | {delegation.startDate} to {delegation.endDate}</p>
                  </div>
                ))}
                {delegations.length === 0 && <p className="py-8 text-center text-sm font-bold text-slate-400">No approval delegations configured.</p>}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
