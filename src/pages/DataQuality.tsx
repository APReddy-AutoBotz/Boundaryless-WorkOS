import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Database, RefreshCcw, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { NoticeBanner } from '../components/ui/NoticeBanner';
import { adminService } from '../services/api';
import type { DataQualityReport } from '../types';

const scoreVariant = (score: number): 'success' | 'warning' | 'danger' => {
  if (score >= 95) return 'success';
  if (score >= 85) return 'warning';
  return 'danger';
};

export const DataQuality = () => {
  const [report, setReport] = useState<DataQualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
      setReport(await adminService.getDataQualityReport());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Data quality report failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const topIssueTypes = useMemo(() => {
    if (!report) return [];
    return (Object.entries(report.byType) as Array<[string, number]>)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [report]);

  if (loading) {
    return (
      <div className="flex h-[55vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Data Quality"
          subtitle="Production handover checks for employee master, identity, capacity, and allocation integrity."
          breadcrumb={['Reports', 'Data Quality']}
        />
        <NoticeBanner type="danger" title="Report unavailable" message={error || 'No report payload was returned.'} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Quality"
        subtitle="Production handover checks for employee master, identity, capacity, and allocation integrity."
        breadcrumb={['Reports', 'Data Quality']}
        actions={
          <button onClick={loadReport} className="btn-secondary flex items-center gap-2 px-4 py-2.5">
            <RefreshCcw size={14} /> Refresh
          </button>
        }
      />

      <NoticeBanner
        type={report.issueCount === 0 ? 'success' : report.score >= 85 ? 'warning' : 'danger'}
        title={report.issueCount === 0 ? 'Ready for production data review' : 'Data issues need owner assignment'}
        message={`${report.issueCount} issue${report.issueCount === 1 ? '' : 's'} found across ${report.totalRecords} scoped employee records. Generated ${new Date(report.generatedAt).toLocaleString()}.`}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-body/50">Confidence Score</p>
              <p className="mt-3 text-4xl font-black text-heading">{report.score}%</p>
            </div>
            <div className="rounded-2xl bg-orange-50 p-3 text-primary">
              <ShieldCheck size={22} />
            </div>
          </div>
          <Badge variant={scoreVariant(report.score)} className="mt-4">{report.score >= 95 ? 'Strong' : report.score >= 85 ? 'Review' : 'Blocked'}</Badge>
        </Card>
        <Card className="p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-body/50">Issue Count</p>
          <p className="mt-3 text-4xl font-black text-heading">{report.issueCount}</p>
          <p className="mt-2 text-xs font-medium text-body/60">Open data-quality exceptions</p>
        </Card>
        <Card className="p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-body/50">Scoped Records</p>
          <p className="mt-3 text-4xl font-black text-heading">{report.totalRecords}</p>
          <p className="mt-2 text-xs font-medium text-body/60">Employees visible to active role</p>
        </Card>
        <Card className="p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-body/50">Top Issue Type</p>
          <p className="mt-3 text-xl font-black text-heading">{topIssueTypes[0]?.[0] || 'None'}</p>
          <p className="mt-2 text-xs font-medium text-body/60">{topIssueTypes[0]?.[1] || 0} matching records</p>
        </Card>
      </div>

      {topIssueTypes.length > 0 && (
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Database size={16} className="text-primary" />
            <h2 className="text-sm font-black uppercase tracking-widest text-heading">Issue Mix</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {topIssueTypes.map(([type, count]) => (
              <div key={type} className="rounded-xl border border-border-light p-4">
                <p className="text-xs font-black text-heading">{type}</p>
                <p className="mt-2 text-2xl font-black text-primary">{count}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border-light p-5">
          <div className="flex items-center gap-2">
            {report.issueCount === 0 ? <CheckCircle2 size={17} className="text-success" /> : <AlertTriangle size={17} className="text-primary" />}
            <h2 className="text-sm font-black uppercase tracking-widest text-heading">Open Exceptions</h2>
          </div>
          <Badge variant="neutral">{report.issues.length} rows</Badge>
        </div>
        {report.issues.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-bold text-heading">No data-quality exceptions found.</p>
            <p className="mt-2 text-xs text-body/60">Keep this report in the UAT evidence pack before production handover.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-body/50">
                <tr>
                  <th className="px-5 py-3">Issue</th>
                  <th className="px-5 py-3">Entity</th>
                  <th className="px-5 py-3">Owner</th>
                  <th className="px-5 py-3">Impact</th>
                  <th className="px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {report.issues.slice(0, 200).map(issue => (
                  <tr key={`${issue.entityType}-${issue.entityId}-${issue.issueType}`} className="align-top hover:bg-orange-50/40">
                    <td className="px-5 py-4">
                      <Badge variant="warning">{issue.issueType}</Badge>
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-body/40">{issue.entityType}</p>
                    </td>
                    <td className="px-5 py-4 text-xs font-bold text-heading">
                      {issue.entityType === 'Employee' ? (
                        <Link to={`/employees/${issue.entityId}`} className="hover:text-primary">{issue.entity}</Link>
                      ) : issue.entity}
                    </td>
                    <td className="px-5 py-4 text-xs font-medium text-body/70">{issue.owner}</td>
                    <td className="max-w-xs px-5 py-4 text-xs font-medium leading-relaxed text-body/70">{issue.impact}</td>
                    <td className="max-w-xs px-5 py-4 text-xs font-bold leading-relaxed text-heading">{issue.suggestedAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.issues.length > 200 && (
              <div className="border-t border-border-light bg-slate-50 px-5 py-3 text-xs font-bold text-body/60">
                Showing first 200 exceptions. Export from backend report API for the full list.
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};
