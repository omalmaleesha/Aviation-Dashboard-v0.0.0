import { configureStore } from '@reduxjs/toolkit';
import flightsReducer from './slices/flightsSlice';
import alertsReducer from './slices/alertsSlice';
import metarReducer from './slices/metarSlice';
import replayReducer from './slices/replaySlice';
import turnaroundReducer from './slices/turnaroundSlice';
import uiReducer from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    flights: flightsReducer,
    alerts: alertsReducer,
    metar: metarReducer,
    replay: replayReducer,
    turnaround: turnaroundReducer,
    ui: uiReducer,
  },
});

// ── Exported types used by the typed hooks ───────────────────────
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
