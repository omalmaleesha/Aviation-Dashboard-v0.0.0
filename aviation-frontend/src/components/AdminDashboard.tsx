import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Radio,
  RefreshCw,
  Shield,
  Users,
} from 'lucide-react';
import type { AuthSession } from '../auth/session';
import { useAdminData } from '../hooks/useAdminData';
import type { AdminIncident, AdminManagedUser, AdminSystemMetric, AdminUserRole } from '../types/admin';

type AdminView = 'overview' | 'users' | 'incidents' | 'audit' | 'system';
type ChartDatum = { label: string; value: number; colorClass: string };

interface AdminDashboardProps {
  session: AuthSession;
  onLogout: () => void;
  onSwitchToUserPortal: () => void;
}

const ADMIN_VIEWS: Array<{ id: AdminView; label: string; icon: React.ReactNode; description: string }> = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" />, description: 'Platform summary' },
  { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" />, description: 'Roles & access' },
  { id: 'incidents', label: 'Incidents', icon: <AlertTriangle className="w-4 h-4" />, description: 'Critical events' },
  { id: 'audit', label: 'Audit Logs', icon: <ClipboardList className="w-4 h-4" />, description: 'Trace actions' },
  { id: 'system', label: 'System Health', icon: <Activity className="w-4 h-4" />, description: 'Reliability' },
];

const ADMIN_DASHBOARD_BG_IMAGE_STACK = "url('/image%20(3).jpeg'), url('/image.jpeg'), url('/image%20(2).jpeg')";

function metricClasses(metric: AdminSystemMetric): string {
  if (metric.status === 'GOOD') return 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
  if (metric.status === 'WARN') return 'text-amber-300 border-amber-500/30 bg-amber-500/10';
  return 'text-red-300 border-red-500/30 bg-red-500/10';
}

function roleOptions(user: AdminManagedUser): AdminUserRole[] {
  if (user.is_admin) return ['ADMIN', 'ADMINISTRATOR'];
  return ['VIEWER', 'OPERATOR', 'DISPATCHER'];
}

export function AdminDashboard({ session, onLogout, onSwitchToUserPortal }: AdminDashboardProps) {
  const [activeView, setActiveView] = useState<AdminView>('overview');
  const {
    overview,
    users,
    incidents,
    auditLogs,
    metrics,
    isLoading,
    error,
    refresh,
    updateUserRole,
    toggleUserActive,
    resolveIncident,
  } = useAdminData();

  const unresolvedIncidents = useMemo(
    () => incidents.filter((incident) => incident.status !== 'RESOLVED'),
    [incidents],
  );

  const roleDistribution = useMemo<ChartDatum[]>(() => {
    const counter = users.reduce<Record<string, number>>((acc, user) => {
      acc[user.role] = (acc[user.role] ?? 0) + 1;
      return acc;
    }, {});

    const palette: Record<string, string> = {
      ADMIN: 'bg-red-400',
      ADMINISTRATOR: 'bg-rose-400',
      DISPATCHER: 'bg-blue-400',
      OPERATOR: 'bg-cyan-400',
      VIEWER: 'bg-slate-400',
    };

    return Object.entries(counter)
      .map(([label, value]) => ({
        label,
        value,
        colorClass: palette[label] ?? 'bg-emerald-400',
      }))
      .sort((a, b) => b.value - a.value);
  }, [users]);

  const severityDistribution = useMemo<ChartDatum[]>(() => {
    const counter = incidents.reduce<Record<string, number>>((acc, incident) => {
      acc[incident.severity] = (acc[incident.severity] ?? 0) + 1;
      return acc;
    }, {});

    const palette: Record<string, string> = {
      CRITICAL: 'bg-red-500',
      HIGH: 'bg-amber-400',
      MEDIUM: 'bg-blue-400',
      LOW: 'bg-slate-400',
    };

    return ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
      .map((severity) => ({
        label: severity,
        value: counter[severity] ?? 0,
        colorClass: palette[severity],
      }))
      .filter((item) => item.value > 0);
  }, [incidents]);

  const auditTrend = useMemo(() => {
    const counter = new Map<number, number>();

    for (const log of auditLogs) {
      const date = new Date(log.created_at);
      date.setMinutes(0, 0, 0);
      const bucketTs = date.getTime();
      counter.set(bucketTs, (counter.get(bucketTs) ?? 0) + 1);
    }

    const last8Buckets = [...counter.entries()]
      .sort((a, b) => a[0] - b[0])
      .slice(-8)
      .map(([ts, value]) => ({
        label: `${new Date(ts).getHours().toString().padStart(2, '0')}:00`,
        value,
      }));

    if (last8Buckets.length > 0) return last8Buckets;

    return [
      { label: '00:00', value: 0 },
      { label: '04:00', value: 0 },
      { label: '08:00', value: 0 },
      { label: '12:00', value: 0 },
      { label: '16:00', value: 0 },
      { label: '20:00', value: 0 },
    ];
  }, [auditLogs]);

  const systemHealthGauge = useMemo(() => {
    const score = Math.max(0, Math.min(100, overview.system_health_score));
    const tone: 'emerald' | 'amber' | 'red' = score >= 90 ? 'emerald' : score >= 75 ? 'amber' : 'red';
    return { score, tone };
  }, [overview.system_health_score]);

  const renderMain = () => {
    if (activeView === 'overview') {
      return (
        <div className="space-y-4">
          <div className="grid md:grid-cols-5 gap-3">
            <StatCard label="Total Users" value={overview.total_users} accent="text-cyan-300" />
            <StatCard label="Active Sessions" value={overview.active_sessions} accent="text-blue-300" />
            <StatCard label="Open Incidents" value={overview.open_incidents} accent="text-red-300" />
            <StatCard label="Unresolved Alerts" value={overview.unresolved_alerts} accent="text-amber-300" />
            <StatCard label="Health Score" value={`${overview.system_health_score}%`} accent="text-emerald-300" />
          </div>

          <div className="grid xl:grid-cols-3 gap-4">
            <DistributionBarChart
              title="User Role Distribution"
              data={roleDistribution}
              emptyText="No user role data"
            />
            <DistributionBarChart
              title="Incident Severity Split"
              data={severityDistribution}
              emptyText="No incidents logged"
            />
            <GaugeCard score={systemHealthGauge.score} tone={systemHealthGauge.tone} />
          </div>

          <TrendLineCard title="Audit Activity (Last 8 Hours)" points={auditTrend} />

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Unresolved incidents snapshot</h3>
            <div className="space-y-2">
              {unresolvedIncidents.map((incident) => (
                <IncidentRow
                  key={incident.id}
                  incident={incident}
                  onResolve={resolveIncident}
                />
              ))}
              {unresolvedIncidents.length === 0 && (
                <p className="text-xs text-slate-500">No unresolved incidents.</p>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (activeView === 'users') {
      return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 overflow-auto">
          <h3 className="text-sm font-semibold text-white mb-3">User & role management</h3>
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-slate-500 font-mono">
              <tr>
                <th className="pb-2">Email</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Last Login</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="py-3 text-slate-200">{user.email}</td>
                  <td className="py-3">
                    <select
                      value={user.role}
                      onChange={(e) => updateUserRole(user.id, e.target.value as AdminUserRole)}
                      className="rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1 text-xs text-slate-100"
                    >
                      {roleOptions(user).map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        user.is_active
                          ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                          : 'text-red-300 bg-red-500/10 border-red-500/30'
                      }`}
                    >
                      {user.is_active ? 'ACTIVE' : 'DISABLED'}
                    </span>
                  </td>
                  <td className="py-3 text-slate-400 text-xs">
                    {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}
                  </td>
                  <td className="py-3">
                    {!user.is_admin && (
                      <button
                        onClick={() => toggleUserActive(user.id, !user.is_active)}
                        className="text-xs px-2 py-1 rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800/70"
                      >
                        {user.is_active ? 'Disable' : 'Enable'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (activeView === 'incidents') {
      return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-white">Incident command center</h3>
          {incidents.map((incident) => (
            <IncidentRow key={incident.id} incident={incident} onResolve={resolveIncident} detailed />
          ))}
          {incidents.length === 0 && <p className="text-xs text-slate-500">No incidents available.</p>}
        </div>
      );
    }

    if (activeView === 'audit') {
      return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Audit trail</h3>
          <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
            {auditLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-slate-800/80 bg-slate-950/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-200 font-semibold">{log.action}</p>
                  <span className="text-[10px] font-mono text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Actor: <span className="text-slate-300">{log.actor_email}</span> · Target:{' '}
                  <span className="text-slate-300">{log.target}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="text-sm font-semibold text-white mb-3">System health telemetry</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {metrics.map((metric) => (
            <div key={metric.id} className={`rounded-lg border p-3 ${metricClasses(metric)}`}>
              <p className="text-[10px] uppercase tracking-wider font-mono opacity-80">{metric.label}</p>
              <p className="text-xl font-semibold mt-1">
                {metric.value}
                <span className="text-sm ml-1 opacity-90">{metric.unit}</span>
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid lg:grid-cols-2 gap-4">
          <GaugeCard score={systemHealthGauge.score} tone={systemHealthGauge.tone} compact />
          <TrendLineCard title="Audit Throughput Trend" points={auditTrend} compact />
        </div>
      </div>
    );
  };

  return (
    <div className="relative isolate h-screen w-screen bg-slate-950 text-white flex overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: ADMIN_DASHBOARD_BG_IMAGE_STACK,
          backgroundSize: 'cover, 40% auto, 32% auto',
          backgroundPosition: 'center center, right top, left bottom',
          backgroundRepeat: 'no-repeat, no-repeat, no-repeat',
          opacity: 0.28,
        }}
      />
      <div className="absolute inset-0 pointer-events-none bg-slate-950/58" />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,_rgba(248,113,113,0.14),_transparent_45%),radial-gradient(circle_at_bottom_left,_rgba(56,189,248,0.12),_transparent_45%)]" />

      <aside className="relative z-10 w-72 border-r border-slate-800/70 bg-slate-900/72 p-4 flex flex-col">
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-red-300">Admin</p>
          <h1 className="text-lg font-semibold mt-1">SkyOps Control</h1>
          <p className="text-xs text-slate-400 mt-1 truncate">{session.user.email}</p>
        </div>

        <nav className="space-y-1 flex-1">
          {ADMIN_VIEWS.map((view) => (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id)}
              className={`w-full rounded-lg px-3 py-2.5 text-left transition border ${
                activeView === view.id
                  ? 'bg-aviation-blue/15 border-aviation-blue/30 text-aviation-blue'
                  : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-2">
                {view.icon}
                <span className="text-sm font-semibold">{view.label}</span>
              </div>
              <p className="text-[10px] font-mono mt-1 opacity-80">{view.description}</p>
            </button>
          ))}
        </nav>

        <div className="space-y-2 pt-3 border-t border-slate-800/70">
          <button
            onClick={onSwitchToUserPortal}
            className="w-full rounded-lg px-3 py-2 text-sm font-semibold bg-aviation-blue text-slate-950 hover:bg-aviation-blue/90 inline-flex items-center justify-center gap-2"
          >
            <Radio className="w-4 h-4" /> User portal
          </button>
          <button
            onClick={onLogout}
            className="w-full rounded-lg px-3 py-2 text-sm font-semibold border border-red-500/35 text-red-300 hover:bg-red-500/10 inline-flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

  <main className="relative z-10 flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Admin Dashboard</p>
            <h2 className="text-xl font-semibold mt-1">{ADMIN_VIEWS.find((v) => v.id === activeView)?.label}</h2>
          </div>
          <div className="flex items-center gap-2">
            {error && (
              <span className="text-[11px] text-amber-300 border border-amber-500/30 bg-amber-500/10 rounded px-2 py-1">
                API fallback mode: {error}
              </span>
            )}
            <button
              onClick={refresh}
              className="rounded-lg px-3 py-1.5 text-xs border border-slate-700 text-slate-300 hover:bg-slate-800/70 inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="mb-4 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
            Loading admin data…
          </div>
        )}

        {renderMain()}

        <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-[11px] font-mono text-slate-500">
          <Shield className="w-3.5 h-3.5 inline mr-1" />
          Admin actions (role updates, account status changes, incident resolution) should be audited server-side.
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${accent}`}>{value}</p>
    </div>
  );
}

function DistributionBarChart({
  title,
  data,
  emptyText,
}: {
  title: string;
  data: ChartDatum[];
  emptyText: string;
}) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
      {data.length === 0 ? (
        <p className="text-xs text-slate-500">{emptyText}</p>
      ) : (
        <div className="space-y-2.5">
          {data.map((item) => {
            const width = Math.max(6, Math.round((item.value / max) * 100));
            return (
              <div key={item.label}>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span className="font-mono tracking-wide">{item.label}</span>
                  <span className="font-semibold text-slate-200">{item.value}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className={`h-full ${item.colorClass}`} style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TrendLineCard({
  title,
  points,
  compact = false,
}: {
  title: string;
  points: Array<{ label: string; value: number }>;
  compact?: boolean;
}) {
  const width = 320;
  const height = compact ? 110 : 140;
  const max = Math.max(...points.map((p) => p.value), 1);
  const min = Math.min(...points.map((p) => p.value), 0);
  const range = Math.max(1, max - min);

  const polyline = points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * (width - 16) + 8;
      const y = height - 16 - ((point.value - min) / range) * (height - 28);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
      <div className="overflow-x-auto">
        <svg width={width} height={height} className="min-w-full">
          <polyline
            fill="none"
            stroke="#38bdf8"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={polyline}
          />
          {points.map((point, index) => {
            const x = (index / Math.max(points.length - 1, 1)) * (width - 16) + 8;
            const y = height - 16 - ((point.value - min) / range) * (height - 28);
            return <circle key={`${point.label}-${index}`} cx={x} cy={y} r="3" fill="#22d3ee" />;
          })}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500 font-mono">
        {points.map((point, index) => (
          <span key={`${point.label}-${index}`} className="px-2 py-0.5 rounded bg-slate-800/80">
            {point.label}: {point.value}
          </span>
        ))}
      </div>
    </div>
  );
}

function GaugeCard({
  score,
  tone,
  compact = false,
}: {
  score: number;
  tone: 'emerald' | 'amber' | 'red';
  compact?: boolean;
}) {
  const size = compact ? 132 : 160;
  const stroke = compact ? 10 : 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;
  const toneClass =
    tone === 'emerald' ? 'text-emerald-300' : tone === 'amber' ? 'text-amber-300' : 'text-red-300';
  const strokeColor = tone === 'emerald' ? '#34d399' : tone === 'amber' ? '#fbbf24' : '#f87171';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col items-center justify-center">
      <h3 className="text-sm font-semibold text-white mb-2">System Health Gauge</h3>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#1f2937"
            strokeWidth={stroke}
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            fill="transparent"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className={`text-2xl font-bold ${toneClass}`}>{score}%</div>
            <div className="text-[10px] font-mono text-slate-500 uppercase">Health</div>
          </div>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-400 text-center">
        Overall admin platform reliability indicator.
      </p>
    </div>
  );
}

function IncidentRow({
  incident,
  onResolve,
  detailed = false,
}: {
  incident: AdminIncident;
  onResolve: (incidentId: string) => Promise<void>;
  detailed?: boolean;
}) {
  const severityColor =
    incident.severity === 'CRITICAL'
      ? 'text-red-300 bg-red-500/15 border-red-500/35'
      : incident.severity === 'HIGH'
      ? 'text-amber-300 bg-amber-500/15 border-amber-500/35'
      : incident.severity === 'MEDIUM'
      ? 'text-blue-300 bg-blue-500/15 border-blue-500/35'
      : 'text-slate-300 bg-slate-500/15 border-slate-500/35';

  return (
    <div className="rounded-lg border border-slate-800/80 bg-slate-950/50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-200 font-semibold">{incident.title}</p>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
            {incident.id} · {incident.affected_system} · {new Date(incident.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${severityColor}`}>
            {incident.severity}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-slate-700 text-slate-300">
            {incident.status}
          </span>
          {incident.status !== 'RESOLVED' && (
            <button
              onClick={() => void onResolve(incident.id)}
              className="text-[11px] px-2 py-1 rounded border border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/10"
            >
              Resolve
            </button>
          )}
        </div>
      </div>
      {detailed && incident.owner && (
        <p className="text-[11px] text-slate-400 mt-1">Owner: {incident.owner}</p>
      )}
    </div>
  );
}
