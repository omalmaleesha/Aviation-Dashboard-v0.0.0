import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Timer,
  Fuel,
  Brush,
  Utensils,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Plane,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { TurnaroundApiResponse, DelayPrediction } from '../types/turnaround';
import { API_BASE } from '../config';

const POLL_INTERVAL = 5_000;

// ── Icon map ────────────────────────────────────────────────────
const TASK_ICON: Record<string, React.ElementType> = {
  refueling: Fuel,
  cleaning: Brush,
  catering: Utensils,
  baggage: Briefcase,
};

const STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  PENDING:     { bg: 'bg-gray-500/15',    text: 'text-gray-400',    border: 'border-gray-500/30' },
  IN_PROGRESS: { bg: 'bg-blue-500/15',    text: 'text-blue-400',    border: 'border-blue-500/30' },
  COMPLETED:   { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
};

// ── Delay Badge ─────────────────────────────────────────────────
function DelayBadge({ prediction }: { prediction: DelayPrediction }) {
  if (!prediction.at_risk) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        <CheckCircle2 className="w-3 h-3" /> ON TIME
      </span>
    );
  }
  return (
    <motion.span
      animate={{ opacity: [1, 0.5, 1] }}
      transition={{ duration: 1, repeat: Infinity }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-500/15 text-red-400 border border-red-500/30"
    >
      <AlertTriangle className="w-3 h-3" />
      +{prediction.estimated_delay_minutes}m DELAY
    </motion.span>
  );
}

// ── Turnaround Row ──────────────────────────────────────────────
function TurnaroundRow({ data }: { data: TurnaroundApiResponse }) {
  const dp = data.delay_prediction;
  const completedTasks = data.tasks.filter((t) => t.status === 'COMPLETED').length;
  const progressColor =
    data.progress_percent >= 100
      ? 'bg-emerald-500'
      : dp?.at_risk
      ? 'bg-red-500'
      : 'bg-aviation-blue';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className={`bg-slate-900/60 backdrop-blur border rounded-xl p-5 transition-all ${
        dp?.at_risk ? 'border-red-500/40 shadow-lg shadow-red-500/5' : 'border-gray-700/40'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${dp?.at_risk ? 'bg-red-500/15' : 'bg-aviation-blue/10'} border ${dp?.at_risk ? 'border-red-500/30' : 'border-aviation-blue/20'}`}>
            <Plane className={`w-5 h-5 ${dp?.at_risk ? 'text-red-400' : 'text-aviation-blue'}`} />
          </div>
          <div>
            <div className="font-mono font-bold text-base text-white">{data.flight_id}</div>
            <div className="text-[10px] font-mono text-gray-500">
              Landing: {new Date(data.landing_time).toLocaleTimeString()} → Departure: {new Date(data.target_departure_time).toLocaleTimeString()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {dp && <DelayBadge prediction={dp} />}
          {data.is_completed && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3" /> COMPLETE
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Progress</span>
          <span className="text-[11px] font-mono font-bold text-aviation-blue">{Math.round(data.progress_percent)}%</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${progressColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(data.progress_percent, 100)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Time stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-800/40 rounded-lg px-3 py-2">
          <div className="text-[9px] text-gray-500 uppercase tracking-wider font-mono">Elapsed</div>
          <div className="font-mono font-bold text-sm text-gray-100">{Math.round(data.elapsed_minutes)}m</div>
        </div>
        <div className="bg-slate-800/40 rounded-lg px-3 py-2">
          <div className="text-[9px] text-gray-500 uppercase tracking-wider font-mono">Remaining</div>
          <div className={`font-mono font-bold text-sm ${data.remaining_minutes < 5 ? 'text-red-400' : 'text-gray-100'}`}>
            {Math.round(data.remaining_minutes)}m
          </div>
        </div>
        <div className="bg-slate-800/40 rounded-lg px-3 py-2">
          <div className="text-[9px] text-gray-500 uppercase tracking-wider font-mono">Tasks</div>
          <div className="font-mono font-bold text-sm text-gray-100">
            {completedTasks}/{data.tasks.length}
          </div>
        </div>
      </div>

      {/* Tasks row */}
      <div className="flex flex-wrap gap-2">
        {data.tasks.map((task) => {
          const Icon = TASK_ICON[task.task_name] ?? Timer;
          const ss = STATUS_STYLE[task.status] ?? STATUS_STYLE.PENDING;
          return (
            <div
              key={task.task_name}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-mono font-semibold ${ss.bg} ${ss.text} ${ss.border}`}
            >
              <Icon className="w-3 h-3" />
              <span className="capitalize">{task.task_name}</span>
              <span className="text-[8px] opacity-60 ml-1">{task.estimated_duration_min}m</span>
            </div>
          );
        })}
      </div>

      {/* Delay prediction detail */}
      {dp?.at_risk && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[11px] font-mono font-bold text-red-400 uppercase">
                Bottleneck: {dp.bottleneck_task}
              </div>
              <div className="text-[10px] font-mono text-red-400/80 mt-0.5">{dp.message}</div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── Main Page ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

export function TurnaroundsPage() {
  const [turnarounds, setTurnarounds] = useState<TurnaroundApiResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/turnarounds`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: TurnaroundApiResponse[] = await res.json();
      if (mountedRef.current) {
        setTurnarounds(data);
        setError(null);
        setIsLive(true);
        setIsLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch turnarounds');
        setIsLive(false);
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchAll();
    timerRef.current = setInterval(fetchAll, POLL_INTERVAL);
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchAll]);

  // Stats
  const total = turnarounds.length;
  const atRisk = turnarounds.filter((t) => t.delay_prediction?.at_risk).length;
  const completed = turnarounds.filter((t) => t.is_completed).length;
  const inProgress = total - completed;

  return (
    <div className="h-full flex flex-col bg-slate-950/80 backdrop-blur-sm">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-800/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-aviation-blue/10 rounded-lg border border-aviation-blue/20">
              <Timer className="w-5 h-5 text-aviation-blue" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Turnaround Operations</h2>
              <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                Ground crew task management & delay prediction
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Live badge */}
            <div className="flex items-center gap-1.5">
              {isLive ? (
                <>
                  <div className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </div>
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] font-mono text-emerald-400 uppercase">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-gray-500" />
                  <span className="text-[10px] font-mono text-gray-500 uppercase">Offline</span>
                </>
              )}
            </div>
            {/* Refresh */}
            <button
              onClick={fetchAll}
              className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors text-gray-400 hover:text-white"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-3 mt-3">
          {[
            { label: 'Total', value: total, color: 'text-white' },
            { label: 'In Progress', value: inProgress, color: 'text-aviation-blue' },
            { label: 'At Risk', value: atRisk, color: 'text-red-400' },
            { label: 'Completed', value: completed, color: 'text-emerald-400' },
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-900/40 rounded-lg px-3 py-2 text-center border border-gray-800/30">
              <div className="text-[9px] text-gray-500 uppercase tracking-wider font-mono">{stat.label}</div>
              <div className={`text-lg font-mono font-bold ${stat.color}`}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 scrollbar-thin">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-slate-900/40 border border-gray-700/20 rounded-xl p-5"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 bg-slate-800 rounded-lg animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 bg-slate-800 rounded animate-pulse w-24" />
                    <div className="h-3 bg-slate-800 rounded animate-pulse w-48" />
                  </div>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full animate-pulse mb-4" />
                <div className="grid grid-cols-3 gap-3">
                  {[0, 1, 2].map((j) => (
                    <div key={j} className="h-12 bg-slate-800 rounded-lg animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <AlertTriangle className="w-10 h-10 mb-3 text-amber-500" />
            <p className="text-sm font-mono">{error}</p>
            <button
              onClick={fetchAll}
              className="mt-3 px-4 py-1.5 text-xs font-mono font-bold rounded-lg bg-aviation-blue/15 text-aviation-blue border border-aviation-blue/30 hover:bg-aviation-blue/25 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : turnarounds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Clock className="w-10 h-10 mb-3 text-gray-600" />
            <p className="text-sm font-mono">No active turnarounds</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {turnarounds.map((t) => (
              <TurnaroundRow key={t.flight_id} data={t} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
