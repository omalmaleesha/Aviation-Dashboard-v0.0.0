import { useCallback, useEffect, useState } from 'react';
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
import { SettingsPage } from './components/SettingsPage';
import { AircraftDetailsPage } from './components/AircraftDetailsPage';
import { FlightTypeExplorerPage } from './components/FlightTypeExplorerPage';
import { useFlightData } from './hooks/useFlightData';
import { useMetar } from './hooks/useMetar';
import { useAlerts } from './hooks/useAlerts';
import { useTurnaround } from './hooks/useTurnaround';
import { useReplay } from './hooks/useReplay';
import { useAppDispatch, useAppSelector } from './store';
import { setActiveView, setAircraftDetailsContext, setTurnaroundFlight } from './store/slices/uiSlice';
import type { Flight } from './types/flight';
import {
  COCKPIT_THEME_QUERY_KEY,
  COCKPIT_THEME_STORAGE_KEY,
  DEFAULT_COCKPIT_THEME,
  resolveCockpitTheme,
} from './theme/cockpitThemes';

function getInitialCockpitTheme(): string {
  if (typeof window === 'undefined') return DEFAULT_COCKPIT_THEME;
  const fromQuery = new URLSearchParams(window.location.search).get(COCKPIT_THEME_QUERY_KEY);
  const fromStorage = window.localStorage.getItem(COCKPIT_THEME_STORAGE_KEY);
  return resolveCockpitTheme(fromQuery ?? fromStorage);
}

const viewTransition = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: { duration: 0.2, ease: 'easeInOut' as const },
};

interface DashboardProps {
  onLogout: () => void;
}

export function Dashboard({ onLogout }: DashboardProps) {
  const dispatch = useAppDispatch();
  const [focusFlightId, setFocusFlightId] = useState<string | null>(null);
  const [activeTheme, setActiveTheme] = useState<string>(getInitialCockpitTheme);

  // ── Redux-backed state (read from store) ────────────────────
  const activeView = useAppSelector((s) => s.ui.activeView);
  const turnaroundFlight = useAppSelector((s) => s.ui.turnaroundFlight);
  const aircraftDetails = useAppSelector((s) => s.ui.aircraftDetails);

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

  const handleFlightDoubleClick = useCallback(
    (flightId: string) => {
      setFocusFlightId(flightId);
      dispatch(setActiveView('map'));
    },
    [dispatch],
  );

  const handleAircraftTypeClick = useCallback(
    (flight: Flight) => {
      dispatch(
        setAircraftDetailsContext({
          flightId: flight.flightId,
          aircraftTypeId: flight.aircraftType ?? null,
        }),
      );
      dispatch(setActiveView('aircraft-details'));
    },
    [dispatch],
  );

  const handleBackToTable = useCallback(() => {
    dispatch(setActiveView('flights-table'));
  }, [dispatch]);

  const handleThemeChange = useCallback((themeId: string) => {
    const resolved = resolveCockpitTheme(themeId);
    setActiveTheme(resolved);
    window.localStorage.setItem(COCKPIT_THEME_STORAGE_KEY, resolved);

    const url = new URL(window.location.href);
    url.searchParams.set(COCKPIT_THEME_QUERY_KEY, resolved);
    window.history.replaceState({}, '', url);
  }, []);

  const handleShareSnapshot = useCallback(async () => {
    const captureNode = document.getElementById('cockpit-capture');
    if (!captureNode) return;

    const { toPng } = await import('html-to-image');
    const dataUrl = await toPng(captureNode, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#020617',
    });

    const link = document.createElement('a');
    link.download = `skyops-${activeTheme}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    link.href = dataUrl;
    link.click();
  }, [activeTheme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-cockpit-theme', activeTheme);
  }, [activeTheme]);

  return (
  <div id="cockpit-capture" className="cockpit-shell flex flex-col h-screen w-screen bg-slate-950 text-white overflow-hidden">
      {/* Real-time alert toast */}
      <AlertToast alert={latestAlert} onDismiss={dismissLatest} />

      {/* Navigation Header */}
      <NavigationHeader
        connectionStatus={connectionStatus}
        activeTheme={activeTheme}
        onThemeChange={handleThemeChange}
        onShareSnapshot={handleShareSnapshot}
      />

      {/* Main Content — Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Sidebar */}
  <Sidebar activeView={activeView} onViewChange={handleViewChange} onLogout={onLogout} />

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
                    focusFlightId={focusFlightId}
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
                  onFlightDoubleClick={handleFlightDoubleClick}
                  onAircraftTypeClick={handleAircraftTypeClick}
                />
              </motion.div>
            ) : activeView === 'aircraft-details' ? (
              <motion.div
                key="aircraft-details-view"
                className="absolute inset-0 overflow-hidden"
                {...viewTransition}
              >
                <AircraftDetailsPage
                  flightId={aircraftDetails.flightId}
                  aircraftTypeId={aircraftDetails.aircraftTypeId}
                  onBack={handleBackToTable}
                />
              </motion.div>
            ) : activeView === 'flighttype-explorer' ? (
              <motion.div
                key="flighttype-explorer-view"
                className="absolute inset-0 overflow-hidden"
                {...viewTransition}
              >
                <FlightTypeExplorerPage flights={flights} />
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
            ) : activeView === 'settings' ? (
              <motion.div
                key="settings-view"
                className="absolute inset-0 overflow-hidden"
                {...viewTransition}
              >
                <SettingsPage />
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
