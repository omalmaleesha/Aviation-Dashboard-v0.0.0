import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from './store';

// ── Flights selectors ────────────────────────────────────────────

/** Raw flights array — use as base for derived selectors. */
export const selectFlights = (state: RootState) => state.flights.flights;
export const selectConnectionStatus = (state: RootState) => state.flights.connectionStatus;

/** Total number of flights (avoids re-render if array ref changes but length doesn't). */
export const selectFlightCount = createSelector(
  selectFlights,
  (flights) => flights.length,
);

/** Count of delayed flights (used by BottomStatsBar). */
export const selectDelayedCount = createSelector(
  selectFlights,
  (flights) => flights.filter((f) => f.status === 'DELAYED').length,
);

/** Status breakdown: { EN_ROUTE: 5, DELAYED: 2, … } */
export const selectStatusCounts = createSelector(
  selectFlights,
  (flights) =>
    flights.reduce<Record<string, number>>((acc, f) => {
      acc[f.status] = (acc[f.status] || 0) + 1;
      return acc;
    }, {}),
);

// ── Alerts selectors ─────────────────────────────────────────────

export const selectAlerts = (state: RootState) => state.alerts.alerts;
export const selectLatestAlert = (state: RootState) => state.alerts.latestAlert;
export const selectAlertCount = createSelector(
  selectAlerts,
  (alerts) => alerts.length,
);
