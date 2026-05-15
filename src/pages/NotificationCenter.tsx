import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, MailCheck, Settings2, ShieldAlert } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { notificationService } from '../services/api';
import type { NotificationDeliveryAttempt, NotificationEvent, NotificationPreference, NotificationTemplate } from '../types';

const severityVariant = (severity: string) => {
  if (severity === 'Critical') return 'danger';
  if (severity === 'Warning') return 'warning';
  return 'info';
};

const Metric = ({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub: string; icon: typeof MailCheck }) => (
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

export const NotificationCenter = () => {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [attempts, setAttempts] = useState<NotificationDeliveryAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    setLoading(true);
    const [eventRows, templateRows, preferenceRows, attemptRows] = await Promise.all([
      notificationService.getAll(),
      notificationService.getTemplates().catch(() => []),
      notificationService.getPreferences().catch(() => []),
      notificationService.getDeliveryAttempts().catch(() => []),
    ]);
    setEvents(eventRows);
    setTemplates(templateRows);
    setPreferences(preferenceRows);
    setAttempts(attemptRows);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const unread = useMemo(() => events.filter(event => !event.readAt), [events]);
  const failedAttempts = useMemo(() => attempts.filter(attempt => attempt.status === 'Failed'), [attempts]);

  const markRead = async (event: NotificationEvent) => {
    await notificationService.markRead(event.id);
    setNotice(`Marked "${event.title}" as read.`);
    await refresh();
  };

  const toggleTemplate = async (template: NotificationTemplate) => {
    await notificationService.saveTemplate({ ...template, active: !template.active });
    setNotice(`${template.eventType} template ${template.active ? 'disabled' : 'enabled'}.`);
    await refresh();
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Notifications"
        subtitle="In-app notification inbox, preferences, templates, and delivery monitoring."
        breadcrumb={['Workforce OS', 'Notifications']}
      />
      {notice && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">{notice}</div>}
      {loading ? <Card>Loading notification center...</Card> : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <Metric label="Unread" value={unread.length} sub="Open in-app events" icon={MailCheck} />
            <Metric label="Templates" value={templates.length} sub="Configured event templates" icon={Settings2} />
            <Metric label="Delivery Risk" value={failedAttempts.length} sub="Failed delivery attempts" icon={ShieldAlert} />
            <Metric label="Preferences" value={preferences.length} sub="User preference rows" icon={CheckCircle2} />
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card title="Notification Inbox">
              <div className="space-y-3">
                {events.map(event => (
                  <div key={event.id} className="rounded-lg border border-slate-100 bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-black text-heading">{event.title}</p>
                          <Badge variant={severityVariant(event.severity)}>{event.severity}</Badge>
                          {!event.readAt && <Badge variant="warning">Unread</Badge>}
                        </div>
                        <p className="mt-2 text-sm font-medium leading-relaxed text-body/70">{event.body}</p>
                        <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{event.eventType} | {new Date(event.createdAt).toLocaleString()}</p>
                      </div>
                      {!event.readAt && <button type="button" onClick={() => markRead(event)} className="btn-secondary whitespace-nowrap px-3 py-2 text-xs">Mark read</button>}
                    </div>
                  </div>
                ))}
                {events.length === 0 && <p className="py-8 text-center text-sm font-bold text-slate-400">No notifications in this scope.</p>}
              </div>
            </Card>
            <div className="space-y-6">
              <Card title="Notification Preferences">
                <div className="space-y-3">
                  {preferences.map(preference => (
                    <div key={preference.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                      <p className="text-sm font-black text-heading">{preference.employeeName || preference.employeeId}</p>
                      <p className="mt-1 text-xs font-bold text-body/60">{preference.eventType}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant={preference.inApp ? 'success' : 'neutral'}>In-app</Badge>
                        <Badge variant={preference.email ? 'success' : 'neutral'}>Email</Badge>
                        <Badge variant={preference.teams ? 'success' : 'neutral'}>Teams</Badge>
                      </div>
                    </div>
                  ))}
                  {preferences.length === 0 && <p className="py-8 text-center text-sm font-bold text-slate-400">Default in-app preferences are active.</p>}
                </div>
              </Card>
              <Card title="Admin Notification Templates">
                <div className="space-y-3">
                  {templates.map(template => (
                    <div key={template.id} className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-heading">{template.eventType}</p>
                        <button type="button" onClick={() => toggleTemplate(template)} className="btn-secondary px-3 py-2 text-xs">{template.active ? 'Disable' : 'Enable'}</button>
                      </div>
                      <p className="mt-1 text-xs font-bold text-body/60">{template.channel} | {template.subject}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
          <Card title="Delivery Monitoring">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="py-3 pr-4">Channel</th>
                    <th className="py-3 pr-4">Provider</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Attempted</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map(attempt => (
                    <tr key={attempt.id} className="border-b border-slate-50">
                      <td className="py-3 pr-4 font-bold text-heading">{attempt.channel}</td>
                      <td className="py-3 pr-4">{attempt.provider}</td>
                      <td className="py-3 pr-4"><Badge variant={attempt.status === 'Delivered' ? 'success' : attempt.status === 'Failed' ? 'danger' : 'warning'}>{attempt.status}</Badge></td>
                      <td className="py-3 pr-4">{new Date(attempt.attemptedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {attempts.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-sm font-bold text-slate-400">No delivery attempts recorded.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};
