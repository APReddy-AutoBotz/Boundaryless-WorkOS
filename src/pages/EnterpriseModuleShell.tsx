import { CalendarDays, CheckCircle2, ClipboardList, MailCheck, Route, ShieldCheck, UsersRound } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

interface EnterpriseModuleShellProps {
  module: 'ESS' | 'Leave' | 'Approvals' | 'Notifications' | 'Identity' | 'Teams' | 'Planning' | 'Command Center';
  subtitle: string;
  phase: string;
  capabilities: string[];
  nextMilestone: string;
}

const moduleIcon = {
  ESS: UsersRound,
  Leave: CalendarDays,
  Approvals: CheckCircle2,
  Notifications: MailCheck,
  Identity: ShieldCheck,
  Teams: Route,
  Planning: ClipboardList,
  'Command Center': ShieldCheck,
} satisfies Record<EnterpriseModuleShellProps['module'], typeof UsersRound>;

export const EnterpriseModuleShell = ({
  module,
  subtitle,
  phase,
  capabilities,
  nextMilestone,
}: EnterpriseModuleShellProps) => {
  const Icon = moduleIcon[module];
  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title={module}
        subtitle={subtitle}
        breadcrumb={['Workforce OS', module]}
      />

      <Card className="p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-primary">
              <Icon size={24} />
            </div>
            <div>
              <Badge variant="info">{phase}</Badge>
              <h2 className="mt-4 text-xl font-black text-heading">Enterprise module foundation is enabled</h2>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-body/70">
                This route is intentionally feature-flagged. Production Core remains stable while the Workforce OS module is built behind controlled rollout flags.
              </p>
            </div>
          </div>
          <Badge variant="neutral">Adapter-first</Badge>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {capabilities.map(capability => (
          <div key={capability}>
            <Card className="p-5">
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-primary">
                <CheckCircle2 size={18} />
              </div>
              <p className="text-sm font-black text-heading">{capability}</p>
            </Card>
          </div>
        ))}
      </div>

      <Card className="border-primary/20 bg-orange-50 p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-primary">Next Milestone</p>
        <p className="mt-2 text-sm font-bold leading-relaxed text-heading">{nextMilestone}</p>
      </Card>
    </div>
  );
};
