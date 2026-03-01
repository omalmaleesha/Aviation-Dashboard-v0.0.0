import { useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, History, Play, Clock, Loader2, Plane } from 'lucide-react';
import type { ReplayControllerProps } from '../types/replay';
import { REPLAY_WINDOW_SEC } from '../types/replay';

/**
 * `ReplayController` — a sleek overlay bar at the bottom of the map
 * providing the LIVE / REPLAY mode toggle and a time-range slider
 * with keyframe tick marks from the backend's replay buffer.
 */
export function ReplayController({
  mode,
  offsetSeconds,
  replayTimestamp,
  isFetching,
  keyframes,
  snapshotFlightCount,
  snapshotDeltaSeconds,
  onModeChange,
  onOffsetChange,
}: ReplayControllerProps) {
  // ── Derived display values ──────────────────────────────────
  const sliderPercent = useMemo(
    () => ((offsetSeconds + REPLAY_WINDOW_SEC) / REPLAY_WINDOW_SEC) * 100,
    [offsetSeconds],
  );

  const formattedTime = useMemo(() => {
    const d = new Date(replayTimestamp);
    return d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'UTC',
    }) + 'Z';
  }, [replayTimestamp]);

  const offsetLabel = useMemo(() => {
    if (offsetSeconds === 0) return 'NOW';
    const totalSec = Math.abs(offsetSeconds);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `-${min}m ${sec.toString().padStart(2, '0')}s`;
  }, [offsetSeconds]);

  // ── Keyframe positions mapped onto the slider ───────────────
  const keyframeTicks = useMemo(() => {
    if (!keyframes.length) return [];
    // Use the replayTimestamp (already reactive) as "now" reference
    // When mode is LIVE, offsetSeconds=0, so referenceNow ≈ Date.now()
    const referenceNow = new Date(replayTimestamp).getTime() - offsetSeconds * 1000;
    return keyframes
      .map((kf) => {
        const kfTime = new Date(kf.timestamp).getTime();
        const offsetSec = (kfTime - referenceNow) / 1000; // negative = past
        if (offsetSec < -REPLAY_WINDOW_SEC || offsetSec > 0) return null;
        const pct = ((offsetSec + REPLAY_WINDOW_SEC) / REPLAY_WINDOW_SEC) * 100;
        return { pct, count: kf.flight_count, ts: kf.timestamp };
      })
      .filter(Boolean) as { pct: number; count: number; ts: string }[];
  }, [keyframes, replayTimestamp, offsetSeconds]);

  // ── Handlers ────────────────────────────────────────────────
  const handleSliderInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onOffsetChange(Number(e.target.value));
    },
    [onOffsetChange],
  );

  const isReplay = mode === 'REPLAY';

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[1000]">
      {/* ── Historical Time Overlay (visible in REPLAY mode) ── */}
      <AnimatePresence>
        {isReplay && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 pointer-events-none"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-950/90 backdrop-blur-md rounded-lg border border-red-500/30 shadow-lg shadow-red-500/10">
              {/* Blinking REC dot */}
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <span className="text-red-400 text-xs font-mono font-bold tracking-wider uppercase">
                REC
              </span>
              <span className="text-gray-500 mx-1">|</span>
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-200 text-sm font-mono font-semibold">
                {formattedTime}
              </span>
              <span className="text-gray-500 text-xs font-mono">
                ({offsetLabel})
              </span>

              {/* Flight count pill */}
              {snapshotFlightCount > 0 && (
                <>
                  <span className="text-gray-600 mx-1">|</span>
                  <Plane className="w-3 h-3 text-blue-400" />
                  <span className="text-blue-300 text-xs font-mono font-semibold">
                    {snapshotFlightCount}
                  </span>
                </>
              )}

              {/* Delta badge */}
              {snapshotDeltaSeconds > 0 && (
                <span className="text-gray-600 text-[10px] font-mono">
                  Δ{snapshotDeltaSeconds.toFixed(1)}s
                </span>
              )}

              {isFetching && (
                <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin ml-1" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Bar ──────────────────────────────────────────── */}
      <div className="bg-slate-950/95 backdrop-blur-md border-t border-gray-800/60 px-4 py-2.5">
        <div className="flex items-center gap-4">
          {/* Mode Toggle */}
          <div className="flex items-center bg-slate-900/80 rounded-lg border border-gray-700/40 p-0.5 flex-shrink-0">
            <button
              onClick={() => onModeChange('LIVE')}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-bold tracking-wide transition-all duration-200
                ${!isReplay
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10'
                  : 'text-gray-500 hover:text-gray-300'
                }
              `}
            >
              <Radio className="w-3.5 h-3.5" />
              LIVE
            </button>
            <button
              onClick={() => onModeChange('REPLAY')}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-bold tracking-wide transition-all duration-200
                ${isReplay
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30 shadow-sm shadow-red-500/10'
                  : 'text-gray-500 hover:text-gray-300'
                }
              `}
            >
              <History className="w-3.5 h-3.5" />
              REPLAY
            </button>
          </div>

          {/* Slider Track */}
          <div className="flex-1 flex items-center gap-3 min-w-0">
            {/* Min label */}
            <span className="text-[10px] font-mono text-gray-500 flex-shrink-0 w-10 text-right">
              -30m
            </span>

            {/* Custom Slider */}
            <div className="relative flex-1 h-8 flex items-center group">
              {/* Background track */}
              <div className="absolute inset-x-0 h-1.5 rounded-full bg-slate-800 border border-gray-700/30" />

              {/* Filled portion */}
              <div
                className={`absolute left-0 h-1.5 rounded-full transition-colors duration-300 ${
                  isReplay
                    ? 'bg-gradient-to-r from-red-500/60 to-red-400/80'
                    : 'bg-gradient-to-r from-slate-600/40 to-emerald-500/60'
                }`}
                style={{ width: `${sliderPercent}%` }}
              />

              {/* Tick marks: use keyframes if available, else fall back to 5-min intervals */}
              {keyframeTicks.length > 0
                ? keyframeTicks.map((kf, i) => (
                    <div
                      key={i}
                      className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-blue-500/50 rounded-full"
                      style={{ left: `${kf.pct}%` }}
                      title={`${new Date(kf.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' })}Z — ${kf.count} flights`}
                    />
                  ))
                : Array.from({ length: 7 }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-gray-700/50"
                      style={{ left: `${(i / 6) * 100}%` }}
                    />
                  ))
              }

              {/* Native range input (invisible but functional) */}
              <input
                type="range"
                min={-REPLAY_WINDOW_SEC}
                max={0}
                step={10}
                value={offsetSeconds}
                disabled={!isReplay}
                onChange={handleSliderInput}
                className={`
                  absolute inset-0 w-full h-full opacity-0 cursor-pointer
                  ${!isReplay ? 'cursor-not-allowed' : ''}
                `}
                style={{ zIndex: 10 }}
              />

              {/* Custom thumb indicator */}
              <motion.div
                className={`
                  absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2
                  transition-colors duration-300 shadow-lg
                  ${isReplay
                    ? 'bg-red-500 border-red-300 shadow-red-500/30'
                    : 'bg-emerald-500 border-emerald-300 shadow-emerald-500/30'
                  }
                `}
                style={{ left: `${sliderPercent}%` }}
                animate={{ scale: isReplay ? [1, 1.1, 1] : 1 }}
                transition={{ repeat: isReplay ? Infinity : 0, duration: 2 }}
              />
            </div>

            {/* Max / LIVE label */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <Play className="w-3 h-3 text-emerald-500 fill-emerald-500" />
              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                LIVE
              </span>
            </div>
          </div>

          {/* Timestamp readout */}
          <div className="flex-shrink-0 text-right min-w-[140px]">
            <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">
              {isReplay ? 'Historical' : 'Real-Time'}
            </div>
            <div className={`text-sm font-mono font-bold ${isReplay ? 'text-red-400' : 'text-emerald-400'}`}>
              {isReplay ? offsetLabel : 'NOW'}
            </div>
            {isReplay && snapshotFlightCount > 0 && (
              <div className="text-[10px] text-gray-500 font-mono">
                {snapshotFlightCount} flights
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
