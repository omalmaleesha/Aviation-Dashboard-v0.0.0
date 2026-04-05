import { Suspense, memo } from 'react';
import { FlightMap } from './MapContent';
import { ReplayController } from './ReplayController';
import type { Flight } from '../types/flight';
import type { ReplayMode, ReplayKeyframe } from '../types/replay';

function MapLoadingFallback() {
  return (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="relative inline-block p-6 bg-slate-800/60 backdrop-blur rounded-xl border border-gray-700/50">
          <div className="w-10 h-10 mx-auto border-2 border-aviation-blue border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm mt-4 font-mono tracking-wide">LOADING MAP…</p>
        </div>
      </div>
    </div>
  );
}

interface LiveMapProps {
  flights: Flight[];
  focusFlightId?: string | null;
  /** Replay state — when provided, the map switches between live/historical data. */
  replayMode?: ReplayMode;
  replayFlights?: Flight[];
  replayOffsetSeconds?: number;
  replayTimestamp?: string;
  replayIsFetching?: boolean;
  replayKeyframes?: ReplayKeyframe[];
  replaySnapshotFlightCount?: number;
  replaySnapshotDeltaSeconds?: number;
  onReplayModeChange?: (mode: ReplayMode) => void;
  onReplayOffsetChange?: (offset: number) => void;
}

export const LiveMap = memo(function LiveMap({
  flights,
  focusFlightId = null,
  replayMode = 'LIVE',
  replayFlights = [],
  replayOffsetSeconds = 0,
  replayTimestamp = new Date().toISOString(),
  replayIsFetching = false,
  replayKeyframes = [],
  replaySnapshotFlightCount = 0,
  replaySnapshotDeltaSeconds = 0,
  onReplayModeChange,
  onReplayOffsetChange,
}: LiveMapProps) {
  const isReplay = replayMode === 'REPLAY';
  const displayFlights = isReplay ? replayFlights : flights;

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-gray-700/50 relative">
      {/* Map Layer */}
      <Suspense fallback={<MapLoadingFallback />}>
        <FlightMap flights={displayFlights} isHistorical={isReplay} focusFlightId={focusFlightId} />
      </Suspense>

      {/* Replay Controller Overlay — sits at the bottom of the map */}
      {onReplayModeChange && onReplayOffsetChange && (
        <ReplayController
          mode={replayMode}
          offsetSeconds={replayOffsetSeconds}
          replayTimestamp={replayTimestamp}
          isFetching={replayIsFetching}
          keyframes={replayKeyframes}
          snapshotFlightCount={replaySnapshotFlightCount}
          snapshotDeltaSeconds={replaySnapshotDeltaSeconds}
          onModeChange={onReplayModeChange}
          onOffsetChange={onReplayOffsetChange}
        />
      )}
    </div>
  );
});
