import { Suspense, memo, useMemo, useState } from 'react';
import { FlightMap } from './MapContent';
import { ReplayController } from './ReplayController';
import { WeatherMapOverlay, type WeatherLayer } from './WeatherMapOverlay';
import { Cloud, CloudRain, Info, Wind, Gauge, EyeOff } from 'lucide-react';
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
  const [weatherLayer, setWeatherLayer] = useState<WeatherLayer>('wind');
  const [isWeatherVisible, setIsWeatherVisible] = useState(false);
  const [selectedMapFlight, setSelectedMapFlight] = useState<Flight | null>(null);

  const isReplay = replayMode === 'REPLAY';
  const displayFlights = isReplay ? replayFlights : flights;

  const focusedFlight = useMemo(() => {
    if (!focusFlightId) return null;
    const normalized = focusFlightId.trim().toLowerCase();
    return displayFlights.find((flight) => flight.flightId.toLowerCase() === normalized) ?? null;
  }, [displayFlights, focusFlightId]);

  const weatherTarget = focusedFlight ?? selectedMapFlight ?? displayFlights[0] ?? null;
  const weatherZoom = weatherTarget ? 6 : 5;

  const weatherButtons: Array<{ layer: WeatherLayer; label: string; icon: React.ReactNode }> = [
    { layer: 'wind', label: 'Wind', icon: <Wind className="w-3.5 h-3.5" /> },
    { layer: 'rain', label: 'Rain', icon: <CloudRain className="w-3.5 h-3.5" /> },
    { layer: 'clouds', label: 'Clouds', icon: <Cloud className="w-3.5 h-3.5" /> },
    { layer: 'pressure', label: 'Pressure', icon: <Gauge className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-gray-700/50 relative">
      <div className="absolute top-3 right-3 z-[1200] rounded-lg border border-slate-700/80 bg-slate-950/80 backdrop-blur px-3 py-2 shadow-lg max-w-[420px]">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsWeatherVisible((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition ${
              isWeatherVisible
                ? 'border-cyan-400/35 bg-cyan-500/15 text-cyan-200'
                : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:bg-slate-800/70'
            }`}
          >
            {isWeatherVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Wind className="w-3.5 h-3.5" />}
            Weather Layer
          </button>

          <span
            className="text-slate-400"
            title="Weather Impact View overlays Wind, Rain, Clouds, or Pressure over flight tracking."
          >
            <Info className="w-3.5 h-3.5" />
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {weatherButtons.map((option) => (
            <button
              key={option.layer}
              type="button"
              onClick={() => {
                setWeatherLayer(option.layer);
                setIsWeatherVisible(true);
              }}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition ${
                weatherLayer === option.layer
                  ? 'border-cyan-400/35 bg-cyan-500/15 text-cyan-200'
                  : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:bg-slate-800/70'
              }`}
            >
              {option.icon}
              {option.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setIsWeatherVisible(false)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition ${
              !isWeatherVisible
                ? 'border-red-400/35 bg-red-500/15 text-red-200'
                : 'border-slate-700 bg-slate-900/70 text-slate-300 hover:bg-slate-800/70'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            OFF
          </button>
        </div>
      </div>

      {/* Map Layer */}
      <div className={`h-full transition-all duration-300 ${isWeatherVisible ? 'pr-[40%]' : 'pr-0'}`}>
      <Suspense fallback={<MapLoadingFallback />}>
        <FlightMap
          flights={displayFlights}
          isHistorical={isReplay}
          focusFlightId={focusFlightId}
          onSelectedFlightChange={setSelectedMapFlight}
        />
      </Suspense>
      </div>

      <div
        className={`absolute top-0 right-0 z-[1150] h-full w-[40%] min-w-[360px] border-l border-slate-700/70 bg-slate-950/70 p-3 backdrop-blur transition-transform duration-300 ${
          isWeatherVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {isWeatherVisible && weatherTarget && (
          <WeatherMapOverlay
            lat={weatherTarget.latitude}
            lon={weatherTarget.longitude}
            zoom={weatherZoom}
            selectedLayer={weatherLayer}
          />
        )}
      </div>

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
