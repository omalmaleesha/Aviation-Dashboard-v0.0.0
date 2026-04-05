import { AlertTriangle, Radio, RefreshCw, Signal, TriangleAlert } from 'lucide-react';
import { useComms } from '../hooks/useComms';
import type { CommsChannelHealth, CommsPriority } from '../types/comms';

function priorityClasses(priority: CommsPriority): string {
  if (priority === 'CRITICAL') return 'bg-red-500/15 text-red-300 border-red-500/35';
  if (priority === 'HIGH') return 'bg-amber-500/15 text-amber-300 border-amber-500/35';
  if (priority === 'MEDIUM') return 'bg-blue-500/15 text-blue-300 border-blue-500/35';
  return 'bg-gray-500/15 text-gray-300 border-gray-500/35';
}

function channelHealthClasses(health: CommsChannelHealth): string {
  if (health === 'ONLINE') return 'text-emerald-300 bg-emerald-500/15 border-emerald-500/35';
  if (health === 'DEGRADED') return 'text-amber-300 bg-amber-500/15 border-amber-500/35';
  return 'text-red-300 bg-red-500/15 border-red-500/35';
}

export function CommsPage() {
  const { overview, isLoading, error, refetch } = useComms();

  return (
    <div className="h-full overflow-y-auto bg-slate-950/80 px-6 py-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="rounded-xl border border-gray-800/60 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg border border-cyan-400/30 bg-cyan-500/10 flex items-center justify-center">
                <Radio className="w-5 h-5 text-cyan-300" />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">Communications</h2>
                <p className="text-[11px] font-mono text-gray-400 mt-0.5">
                  ATC, ground operations, and critical message stream.
                </p>
              </div>
            </div>

            <button
              onClick={refetch}
              className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:bg-slate-800/70"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-gray-800/60 bg-slate-900/60 p-4">
            <p className="text-[10px] text-gray-500 font-mono uppercase">Channels</p>
            <p className="text-2xl font-semibold text-white mt-1">{overview.channels.length}</p>
          </div>
          <div className="rounded-xl border border-gray-800/60 bg-slate-900/60 p-4">
            <p className="text-[10px] text-gray-500 font-mono uppercase">Unread messages</p>
            <p className="text-2xl font-semibold text-amber-300 mt-1">{overview.unread_count}</p>
          </div>
          <div className="rounded-xl border border-gray-800/60 bg-slate-900/60 p-4">
            <p className="text-[10px] text-gray-500 font-mono uppercase">Active incidents</p>
            <p className="text-2xl font-semibold text-red-300 mt-1">{overview.active_incidents}</p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 inline-flex items-center gap-2">
            <TriangleAlert className="w-4 h-4" />
            Comms API unavailable ({error}). Showing latest/fallback data.
          </div>
        )}

        <section className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-800/60 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Signal className="w-4 h-4 text-cyan-300" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Channel Health</h3>
            </div>

            <div className="space-y-2">
              {overview.channels.map((channel) => (
                <div
                  key={channel.channel_id}
                  className="rounded-lg border border-gray-800/70 bg-slate-950/50 p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="text-sm text-gray-100 font-semibold">{channel.label}</div>
                    <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                      {channel.frequency_mhz.toFixed(1)} MHz · Last heartbeat{' '}
                      {new Date(channel.last_heartbeat_at).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-flex text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${channelHealthClasses(channel.health)}`}
                    >
                      {channel.health}
                    </span>
                    <div className="text-[10px] mt-1 text-gray-400 font-mono">
                      Incidents: {channel.active_incidents}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-800/60 bg-slate-900/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-300" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">Recent Messages</h3>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {overview.messages.map((message) => (
                <div key={message.id} className="rounded-lg border border-gray-800/70 bg-slate-950/50 p-3">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="text-xs font-semibold text-gray-100">{message.source}</p>
                    <span
                      className={`inline-flex text-[10px] font-mono px-2 py-0.5 rounded-full border ${priorityClasses(message.priority)}`}
                    >
                      {message.priority}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">{message.message}</p>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-gray-500">
                    <span>{new Date(message.created_at).toLocaleString()}</span>
                    <span>
                      {message.requires_ack ? (message.acknowledged ? 'ACKNOWLEDGED' : 'ACK PENDING') : 'INFO'}
                    </span>
                  </div>
                </div>
              ))}

              {!isLoading && overview.messages.length === 0 && (
                <div className="rounded-lg border border-gray-800/70 bg-slate-950/50 p-4 text-center text-xs text-gray-500">
                  No comms messages available.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
