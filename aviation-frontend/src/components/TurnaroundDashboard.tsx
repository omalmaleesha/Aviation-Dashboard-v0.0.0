import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Fuel,
  Brush,
  Utensils,
  Briefcase,
  Plane,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  ArrowRightFromLine,
} from 'lucide-react';
import type { TurnaroundState, TurnaroundTask, TaskStatus } from '../types/turnaround';
import type { Flight } from '../types/flight';
import { TURNAROUND_WINDOW_MIN } from '../types/turnaround';

// ── Icon map ────────────────────────────────────────────────────
const ICON_MAP = {
  fuel: Fuel,
  brush: Brush,
  utensils: Utensils,
  briefcase: Briefcase,
} as const;

// ── Helpers ─────────────────────────────────────────────────────
function fmtTime(totalSec: number) {
  const neg = totalSec < 0;
  const abs = Math.abs(Math.floor(totalSec));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${neg ? '-' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtMin(min: number) {
  return `${Math.floor(min)}m`;
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  NOT_STARTED: 'NOT STARTED',
  IN_PROGRESS: 'IN PROGRESS',
  COMPLETE: 'COMPLETE',
};

const STATUS_STYLES: Record<TaskStatus, { bg: string; text: string; border: string }> = {
  NOT_STARTED: { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' },
  IN_PROGRESS: { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  COMPLETE: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
};

// ── Color helpers ───────────────────────────────────────────────
function barBg(color: string) {
  const map: Record<string, string> = {
    amber: 'bg-amber-500',
    cyan: 'bg-cyan-500',
    purple: 'bg-purple-500',
    emerald: 'bg-emerald-500',
  };
  return map[color] ?? 'bg-blue-500';
}

function barBgDim(color: string) {
  const map: Record<string, string> = {
    amber: 'bg-amber-500/20',
    cyan: 'bg-cyan-500/20',
    purple: 'bg-purple-500/20',
    emerald: 'bg-emerald-500/20',
  };
  return map[color] ?? 'bg-blue-500/20';
}

function textColor(color: string) {
  const map: Record<string, string> = {
    amber: 'text-amber-400',
    cyan: 'text-cyan-400',
    purple: 'text-purple-400',
    emerald: 'text-emerald-400',
  };
  return map[color] ?? 'text-blue-400';
}

// ═══════════════════════════════════════════════════════════════
// ── Gantt Timeline ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

interface GanttProps {
  tasks: TurnaroundTask[];
  elapsedMin: number;
  windowMin: number;
  isTaskCritical: (t: TurnaroundTask) => boolean;
}

function GanttTimeline({ tasks, elapsedMin, windowMin, isTaskCritical }: GanttProps) {
  // 5-minute interval markers
  const markers = useMemo(() => {
    const m: number[] = [];
    for (let i = 0; i <= windowMin; i += 5) m.push(i);
    return m;
  }, [windowMin]);

  const cursorPct = Math.min((elapsedMin / windowMin) * 100, 100);

  return (
    <div className="relative">
      {/* Header labels */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <Plane className="w-3.5 h-3.5 text-aviation-blue" />
          <span className="text-[10px] font-mono font-bold text-aviation-blue uppercase tracking-wider">
            T-0 Landing
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
            T+{windowMin} Departure
          </span>
          <ArrowRightFromLine className="w-3.5 h-3.5 text-emerald-400" />
        </div>
      </div>

      {/* Timeline container */}
      <div className="relative bg-slate-800/60 rounded-xl border border-gray-700/40 p-4 overflow-hidden">
        {/* Time axis ticks */}
        <div className="relative h-6 mb-3">
          {markers.map((m) => {
            const pct = (m / windowMin) * 100;
            return (
              <div
                key={m}
                className="absolute top-0 flex flex-col items-center"
                style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
              >
                <div className="w-px h-3 bg-gray-600/60" />
                <span className="text-[9px] font-mono text-gray-500 mt-0.5">
                  {m === 0 ? 'T-0' : `+${m}`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Task bars */}
        <div className="space-y-2.5">
          {tasks.map((task) => {
            const Icon = ICON_MAP[task.icon];
            const leftPct = (task.startOffsetMin / windowMin) * 100;
            const widthPct = (task.durationMin / windowMin) * 100;
            const isCritical = isTaskCritical(task);

            // Progress fill within the bar
            let fillPct = 0;
            if (task.status === 'COMPLETE') {
              fillPct = 100;
            } else if (task.status === 'IN_PROGRESS') {
              const elapsed = elapsedMin - task.startOffsetMin;
              fillPct = Math.min(Math.max((elapsed / task.durationMin) * 100, 5), 95);
            }

            return (
              <div key={task.id} className="flex items-center gap-3">
                {/* Label */}
                <div className="w-24 flex-shrink-0 flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${textColor(task.color)}`} />
                  <span className={`text-[11px] font-mono font-semibold ${textColor(task.color)}`}>
                    {task.label}
                  </span>
                </div>

                {/* Bar track */}
                <div className="flex-1 relative h-7 rounded-md">
                  {/* Positioned bar */}
                  <div
                    className="absolute top-0 h-full rounded-md overflow-hidden"
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  >
                    {/* Background */}
                    <div className={`absolute inset-0 ${barBgDim(task.color)} rounded-md`} />

                    {/* Fill */}
                    <motion.div
                      className={`absolute inset-y-0 left-0 ${barBg(task.color)} rounded-md`}
                      initial={{ width: 0 }}
                      animate={{
                        width: `${fillPct}%`,
                        opacity: isCritical ? [1, 0.3, 1] : 1,
                      }}
                      transition={
                        isCritical
                          ? { opacity: { duration: 0.6, repeat: Infinity }, width: { duration: 0.5 } }
                          : { duration: 0.5 }
                      }
                      style={isCritical ? { backgroundColor: '#ef4444' } : undefined}
                    />

                    {/* Duration label inside bar */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[9px] font-mono font-bold text-white/80 drop-shadow">
                        {fmtMin(task.durationMin)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* NOW cursor */}
        <motion.div
          className="absolute top-0 bottom-0 w-px bg-red-500 z-10"
          style={{ left: `calc(${cursorPct}% + 0px)` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Cursor head */}
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-red-500 rounded-full shadow-lg shadow-red-500/40" />
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-red-500 rounded text-[8px] font-mono font-bold text-white whitespace-nowrap">
            NOW
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── Task Control Card ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

interface TaskControlProps {
  task: TurnaroundTask;
  elapsedMin: number;
  remainingSec: number;
  windowMin: number;
  isCritical: boolean;
  onCycle: () => void;
}

function TaskControl({ task, elapsedMin, isCritical, onCycle }: Omit<TaskControlProps, 'remainingSec' | 'windowMin'>) {
  const Icon = ICON_MAP[task.icon];
  const ss = STATUS_STYLES[task.status];

  // Time left for this task specifically
  const taskEndMin = task.startOffsetMin + task.durationMin;
  const taskRemainingSec = Math.max(0, (taskEndMin - elapsedMin) * 60);

  return (
    <motion.div
      layout
      className={`bg-slate-900/60 backdrop-blur border rounded-xl p-4 transition-all ${
        isCritical
          ? 'border-red-500/50 shadow-lg shadow-red-500/10'
          : task.status === 'COMPLETE'
          ? 'border-emerald-500/30'
          : 'border-gray-700/40'
      }`}
      animate={
        isCritical
          ? { borderColor: ['rgba(239,68,68,0.5)', 'rgba(239,68,68,0.15)', 'rgba(239,68,68,0.5)'] }
          : {}
      }
      transition={isCritical ? { duration: 1, repeat: Infinity } : {}}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg ${isCritical ? 'bg-red-500/15' : `bg-${task.color}-500/10`}`}>
            <Icon className={`w-5 h-5 ${isCritical ? 'text-red-400' : textColor(task.color)}`} />
          </div>
          <div>
            <div className={`font-mono font-bold text-sm ${isCritical ? 'text-red-400' : 'text-white'}`}>
              {task.label}
            </div>
            <div className="text-[10px] font-mono text-gray-500">
              T+{task.startOffsetMin}m → T+{taskEndMin}m · {task.durationMin}m window
            </div>
          </div>
        </div>

        {/* Critical badge */}
        {isCritical && (
          <motion.div
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="flex items-center gap-1 px-2 py-0.5 bg-red-500/15 border border-red-500/30 rounded-full"
          >
            <AlertTriangle className="w-3 h-3 text-red-400" />
            <span className="text-[9px] font-mono font-bold text-red-400 uppercase">Critical Delay</span>
          </motion.div>
        )}
      </div>

      {/* Status toggle + Countdown */}
      <div className="flex items-center gap-3">
        {/* Toggle Button */}
        <button
          onClick={onCycle}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border font-mono text-xs font-bold uppercase tracking-wider transition-all hover:brightness-125 ${ss.bg} ${ss.text} ${ss.border}`}
        >
          {task.status === 'NOT_STARTED' && <Play className="w-3.5 h-3.5" />}
          {task.status === 'IN_PROGRESS' && <CheckCircle2 className="w-3.5 h-3.5" />}
          {task.status === 'COMPLETE' && <RotateCcw className="w-3.5 h-3.5" />}
          {STATUS_LABEL[task.status]}
        </button>

        {/* Countdown */}
        <div className="flex-shrink-0 text-right">
          <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Task Timer</div>
          <div className={`text-lg font-mono font-bold tabular-nums ${
            task.status === 'COMPLETE'
              ? 'text-emerald-400'
              : taskRemainingSec < 120
              ? 'text-red-400'
              : 'text-white'
          }`}>
            {task.status === 'COMPLETE' ? '✓ DONE' : fmtTime(taskRemainingSec)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ── Main Modal ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

interface TurnaroundDashboardProps {
  flight: Flight | null;
  state: TurnaroundState | null;
  elapsedSec: number;
  elapsedMin: number;
  remainingSec: number;
  allComplete: boolean;
  isTaskCritical: (t: TurnaroundTask) => boolean;
  onCycleTask: (taskId: string) => void;
  onClose: () => void;
}

export function TurnaroundDashboard({
  flight,
  state,
  elapsedSec,
  elapsedMin,
  remainingSec,
  allComplete,
  isTaskCritical,
  onCycleTask,
  onClose,
}: TurnaroundDashboardProps) {
  const isOpen = !!state && !!flight;

  return (
    <AnimatePresence>
      {isOpen && state && flight && (
        <>
          {/* Backdrop */}
          <motion.div
            key="turnaround-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            key="turnaround-panel"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 top-[5%] bottom-[5%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[860px] z-[101] flex flex-col bg-slate-950 border border-gray-700/50 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* ── Header ─────────────────────────────────────── */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-800/50 bg-slate-900/50">
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-aviation-blue/10 rounded-xl border border-aviation-blue/20">
                  <Plane className="w-6 h-6 text-aviation-blue" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white uppercase tracking-wider">
                    Turnaround Management
                  </h2>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-sm font-mono font-bold text-aviation-blue">{flight.flightId}</span>
                    <span className="text-[10px] font-mono text-gray-500">
                      {flight.origin} → {flight.destination}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase border ${
                      flight.status === 'LANDED'
                        ? 'bg-gray-500/15 text-gray-400 border-gray-500/30'
                        : 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                    }`}>
                      {flight.status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Master countdown */}
                <div className="text-right">
                  <div className="text-[9px] font-mono text-gray-500 uppercase tracking-wider">Departure In</div>
                  <div className={`text-2xl font-mono font-bold tabular-nums ${
                    remainingSec < 300 ? 'text-red-400' : remainingSec < 600 ? 'text-amber-400' : 'text-white'
                  }`}>
                    {fmtTime(remainingSec)}
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-slate-800 transition-colors group"
                >
                  <X className="w-5 h-5 text-gray-500 group-hover:text-white" />
                </button>
              </div>
            </div>

            {/* ── Body (scrollable) ──────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 scrollbar-thin">
              {/* Elapsed bar */}
              <div className="flex items-center gap-4 px-4 py-3 bg-slate-900/40 rounded-xl border border-gray-800/30">
                <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] font-mono text-gray-500 uppercase">Elapsed</span>
                    <span className="text-[10px] font-mono text-gray-400">
                      {fmtTime(elapsedSec)} / {TURNAROUND_WINDOW_MIN}:00
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        elapsedMin > TURNAROUND_WINDOW_MIN
                          ? 'bg-red-500'
                          : elapsedMin > TURNAROUND_WINDOW_MIN * 0.8
                          ? 'bg-amber-500'
                          : 'bg-aviation-blue'
                      }`}
                      animate={{ width: `${Math.min((elapsedMin / TURNAROUND_WINDOW_MIN) * 100, 100)}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              </div>

              {/* Delay Prediction Banner */}
              {state.delayPrediction && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`rounded-xl border px-5 py-4 ${
                    state.delayPrediction.at_risk
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-emerald-500/10 border-emerald-500/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {state.delayPrediction.at_risk ? (
                      <motion.div
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        className="p-2 bg-red-500/20 rounded-lg flex-shrink-0"
                      >
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                      </motion.div>
                    ) : (
                      <div className="p-2 bg-emerald-500/20 rounded-lg flex-shrink-0">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-mono font-bold uppercase tracking-wider ${
                          state.delayPrediction.at_risk ? 'text-red-400' : 'text-emerald-400'
                        }`}>
                          {state.delayPrediction.at_risk ? 'Delay Predicted' : 'On Schedule'}
                        </span>
                        {state.delayPrediction.at_risk && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                            +{state.delayPrediction.estimated_delay_minutes}m
                          </span>
                        )}
                      </div>
                      {state.delayPrediction.at_risk && (
                        <div className="text-[11px] font-mono text-red-400/80 mb-1">
                          Bottleneck: <span className="font-bold capitalize">{state.delayPrediction.bottleneck_task}</span>
                        </div>
                      )}
                      <div className={`text-[10px] font-mono ${
                        state.delayPrediction.at_risk ? 'text-red-400/60' : 'text-emerald-400/60'
                      }`}>
                        {state.delayPrediction.message}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Gantt Timeline */}
              <GanttTimeline
                tasks={state.tasks}
                elapsedMin={elapsedMin}
                windowMin={state.windowMin}
                isTaskCritical={isTaskCritical}
              />

              {/* Ground Crew Dispatch */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 bg-aviation-blue rounded-full" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Ground Crew Dispatch</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {state.tasks.map((task) => (
                    <TaskControl
                      key={task.id}
                      task={task}
                      elapsedMin={elapsedMin}
                      isCritical={isTaskCritical(task)}
                      onCycle={() => onCycleTask(task.id)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* ── Footer — READY FOR PUSHBACK ─────────────────── */}
            <AnimatePresence>
              {allComplete ? (
                <motion.div
                  key="pushback-ready"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                  className="flex-shrink-0 overflow-hidden"
                >
                  <div className="px-6 py-5 bg-emerald-500/10 border-t border-emerald-500/30">
                    <motion.div
                      className="flex items-center justify-center gap-4"
                      animate={{ scale: [1, 1.02, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <div className="p-3 bg-emerald-500/20 rounded-full border border-emerald-500/30">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-mono font-black text-emerald-400 tracking-widest uppercase">
                          Ready for Pushback
                        </div>
                        <div className="text-[11px] font-mono text-emerald-400/60 mt-0.5">
                          All ground operations complete — {flight.flightId} cleared for departure
                        </div>
                      </div>
                      <div className="p-3 bg-emerald-500/20 rounded-full border border-emerald-500/30">
                        <ArrowRightFromLine className="w-8 h-8 text-emerald-400" />
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="pushback-pending"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-shrink-0 px-6 py-3 border-t border-gray-800/50 bg-slate-900/40"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                    <span>
                      {state.tasks.filter((t) => t.status === 'COMPLETE').length}/{state.tasks.length} tasks complete
                    </span>
                    <span>
                      {state.tasks.filter((t) => isTaskCritical(t)).length > 0 && (
                        <span className="text-red-400 mr-3">
                          ⚠ {state.tasks.filter((t) => isTaskCritical(t)).length} CRITICAL
                        </span>
                      )}
                      Turnaround Window: {TURNAROUND_WINDOW_MIN}min
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
