import type { AuthSession } from '../auth/session';

interface AdminConsolePageProps {
  session: AuthSession;
  onLogout: () => void;
  onSwitchToUserPortal: () => void;
}

export function AdminConsolePage({ session, onLogout, onSwitchToUserPortal }: AdminConsolePageProps) {
  return (
    <div className="min-h-screen w-screen bg-slate-950 p-6 text-white">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="rounded-2xl border border-red-500/30 bg-slate-900/70 p-6">
          <p className="text-[11px] font-mono uppercase tracking-wider text-red-300">Admin Portal</p>
          <h1 className="text-2xl font-semibold mt-1">SkyOps Administrative Console</h1>
          <p className="text-sm text-slate-400 mt-2">
            Authenticated as <span className="text-slate-200">{session.user.email}</span>
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Role</p>
            <p className="text-lg font-semibold mt-1">{session.user.role ?? 'ADMIN'}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Admin flag</p>
            <p className="text-lg font-semibold mt-1">{session.user.is_admin ? 'TRUE' : 'FALSE'}</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">Session</p>
            <p className="text-lg font-semibold mt-1">{session.expires_in}s TTL</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold mb-2">Next admin modules</h2>
          <ul className="text-sm text-slate-300 list-disc list-inside space-y-1">
            <li>User management and role assignment</li>
            <li>System health and incident command center</li>
            <li>Audit trail review and export</li>
            <li>Admin-only settings and safety controls</li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onSwitchToUserPortal}
            className="px-4 py-2 rounded-lg bg-aviation-blue text-slate-950 font-semibold hover:bg-aviation-blue/90"
          >
            Open operations dashboard
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="px-4 py-2 rounded-lg border border-red-500/40 text-red-300 font-semibold hover:bg-red-500/10"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
