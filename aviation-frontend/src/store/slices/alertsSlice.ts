import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AlertData } from '../../types/flight';

const MAX_ALERTS = 100;

interface AlertsState {
  alerts: AlertData[];
  latestAlert: AlertData | null;
}

const initialState: AlertsState = {
  alerts: [],
  latestAlert: null,
};

const alertsSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    /** Bulk-set alerts (initial REST fetch). */
    setAlerts(state, action: PayloadAction<AlertData[]>) {
      state.alerts = action.payload.slice(0, MAX_ALERTS);
    },

    /** Push a single real-time alert (from WebSocket). */
    pushAlert(state, action: PayloadAction<AlertData>) {
      state.latestAlert = action.payload;
      state.alerts = [action.payload, ...state.alerts].slice(0, MAX_ALERTS);
    },

    /**
     * Push a batch of buffered alerts at once (from the batched flush).
     * The newest alert in the batch becomes the latestAlert for the toast.
     */
    pushAlertsBatch(state, action: PayloadAction<AlertData[]>) {
      if (action.payload.length === 0) return;
      state.latestAlert = action.payload[action.payload.length - 1];
      state.alerts = [...action.payload, ...state.alerts].slice(0, MAX_ALERTS);
    },

    /** Dismiss the toast. */
    dismissLatestAlert(state) {
      state.latestAlert = null;
    },
  },
});

export const { setAlerts, pushAlert, pushAlertsBatch, dismissLatestAlert } = alertsSlice.actions;
export default alertsSlice.reducer;
