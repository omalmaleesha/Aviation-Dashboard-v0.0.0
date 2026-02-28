import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NavigationHeader } from './components/NavigationHeader';
import { LiveMap } from './components/LiveMap';
import { FlightIntelligence } from './components/FlightIntelligence';
import { BottomStatsBar } from './components/BottomStatsBar';
import { Sidebar } from './components/Sidebar';
import { FlightsTable } from './components/FlightsTable';
import { AlertsTable } from './components/AlertsTable';
import { AlertToast } from './components/AlertToast';
import { TurnaroundDashboard } from './components/TurnaroundDashboard';
import { TurnaroundsPage } from './components/TurnaroundsPage';
import { FuelAnalyticsPage } from './components/FuelAnalyticsPage';
import { useFlightData } from './hooks/useFlightData';
import { useMetar } from './hooks/useMetar';
import { useAlerts } from './hooks/useAlerts';
import { useTurnaround } from './hooks/useTurnaround';
import { useReplay } from './hooks/useReplay';
import { useAppDispatch, useAppSelector } from './store';
import { setActiveView, setTurnaroundFlight } from './store/slices/uiSlice';
import type { Flight } from './types/flight';

const viewTransition = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: { duration: 0.2, ease: 'easeInOut' as const },
};

export function Dashboard() {
  const dispatch = useAppDispatch();

  // ── Redux-backed state (read from store) ────────────────────
  const activeView = useAppSelector((s) => s.ui.activeView);
  const turnaroundFlight = useAppSelector((s) => s.ui.turnaroundFlight);

  // ── Side-effect hooks (now dispatch into Redux internally) ──
  const { flights, connectionStatus } = useFlightData();
  const { metar, isLoading: metarLoading } = useMetar('KJFK');
  const { alerts, alertCount, latestAlert, dismissLatest } = useAlerts();

  // ── Temporal Replay Controller ──────────────────────────────
  const {
    mode: replayMode,
    offsetSeconds: replayOffsetSeconds,
    replayTimestamp,
    isFetching: replayIsFetching,
    replayFlights,
    keyframes: replayKeyframes,
    snapshotFlightCount: replaySnapshotFlightCount,
    snapshotDeltaSeconds: replaySnapshotDeltaSeconds,
    setMode: setReplayMode,
    setOffset: setReplayOffset,
  } = useReplay();

  const {
    state: turnaroundState,
    elapsedSec,
    elapsedMin,
    remainingSec,
    allComplete,
    isTaskCritical,
    startTurnaround,
    closeTurnaround,
    cycleTaskStatus,
  } = useTurnaround();

  const handleSelectTurnaround = useCallback(
    (flight: Flight) => {
      dispatch(setTurnaroundFlight(flight));
      startTurnaround(flight.flightId);
    },
    [dispatch, startTurnaround],
  );

  const handleCloseTurnaround = useCallback(() => {
    closeTurnaround();
    dispatch(setTurnaroundFlight(null));
  }, [dispatch, closeTurnaround]);

  const handleViewChange = useCallback(
    (view: typeof activeView) => dispatch(setActiveView(view)),
    [dispatch],
  );

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-white overflow-hidden">
      {/* Real-time alert toast */}
      <AlertToast alert={latestAlert} onDismiss={dismissLatest} />

      {/* Navigation Header */}
      <NavigationHeader connectionStatus={connectionStatus} />

      {/* Main Content — Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar activeView={activeView} onViewChange={handleViewChange} />

        {/* Center Content — switches between Map and Table */}
        <div className="flex-1 flex overflow-hidden relative">
          <AnimatePresence mode="wait">
            {activeView === 'map' ? (
              <motion.div
                key="map-view"
                className="absolute inset-0 flex overflow-hidden"
                {...viewTransition}
              >
                {/* Map */}
                <div className="flex-1 p-4 bg-slate-900/10">
                  <LiveMap
                    flights={flights}
                    replayMode={replayMode}
                    replayFlights={replayFlights}
                    replayOffsetSeconds={replayOffsetSeconds}
                    replayTimestamp={replayTimestamp}
                    replayIsFetching={replayIsFetching}
                    replayKeyframes={replayKeyframes}
                    replaySnapshotFlightCount={replaySnapshotFlightCount}
                    replaySnapshotDeltaSeconds={replaySnapshotDeltaSeconds}
                    onReplayModeChange={setReplayMode}
                    onReplayOffsetChange={setReplayOffset}
                  />
                </div>

                {/* Right Sidebar — Flight Intelligence */}
                <div className="w-[380px] border-l border-gray-800/50">
                  <FlightIntelligence
                    flights={flights}
                    connectionStatus={connectionStatus}
                    onSelectTurnaround={handleSelectTurnaround}
                  />
                </div>
              </motion.div>
            ) : activeView === 'flights-table' ? (
              <motion.div
                key="table-view"
                className="absolute inset-0 overflow-hidden"
                {...viewTransition}
              >
                <FlightsTable
                  flights={flights}
                  connectionStatus={connectionStatus}
                />
              </motion.div>
            ) : activeView === 'alerts' ? (
              <motion.div
                key="alerts-view"
                className="absolute inset-0 overflow-hidden"
                {...viewTransition}
              >
                <AlertsTable alerts={alerts} />
              </motion.div>
            ) : activeView === 'turnarounds' ? (
              <motion.div
                key="turnarounds-view"
                className="absolute inset-0 overflow-hidden"
                {...viewTransition}
              >
                <TurnaroundsPage />
              </motion.div>
            ) : activeView === 'fuel-analytics' ? (
              <motion.div
                key="fuel-analytics-view"
                className="absolute inset-0 overflow-hidden"
                {...viewTransition}
              >
                <FuelAnalyticsPage />
              </motion.div>
            ) : (
              <motion.div
                key="alerts-view"
                className="absolute inset-0 overflow-hidden"
                {...viewTransition}
              >
                <AlertsTable alerts={alerts} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Stats Bar */}
      <BottomStatsBar flights={flights} alerts={alertCount} metar={metar} metarLoading={metarLoading} />

      {/* Turnaround Management Dashboard Modal */}
      <TurnaroundDashboard
        flight={turnaroundFlight}
        state={turnaroundState}
        elapsedSec={elapsedSec}
        elapsedMin={elapsedMin}
        remainingSec={remainingSec}
        allComplete={allComplete}
        isTaskCritical={isTaskCritical}
        onCycleTask={cycleTaskStatus}
        onClose={handleCloseTurnaround}
      />
    </div>
  );
}
