import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { Flight } from '../../types/flight';
import type { ReplayMode, ReplayKeyframe, ReplaySnapshotResponse, KeyframesResponse } from '../../types/replay';
import { REPLAY_WINDOW_SEC, normalizeReplayFlight } from '../../types/replay';
import { API_BASE } from '../../config';

const REPLAY_API = `${API_BASE}/api/replay`;

// ── State ────────────────────────────────────────────────────────
interface ReplayState {
  mode: ReplayMode;
  offsetSeconds: number;
  replayTimestamp: string;
  isFetching: boolean;
  replayFlights: Flight[];
  error: string | null;
  keyframes: ReplayKeyframe[];
  snapshotFlightCount: number;
  snapshotDeltaSeconds: number;
}

const initialState: ReplayState = {
  mode: 'LIVE',
  offsetSeconds: 0,
  replayTimestamp: new Date().toISOString(),
  isFetching: false,
  replayFlights: [],
  error: null,
  keyframes: [],
  snapshotFlightCount: 0,
  snapshotDeltaSeconds: 0,
};

// ── Async thunks ─────────────────────────────────────────────────
export const fetchKeyframes = createAsyncThunk('replay/fetchKeyframes', async () => {
  const res = await fetch(REPLAY_API);
  if (!res.ok) throw new Error(`Keyframes API HTTP ${res.status}`);
  const data: KeyframesResponse = await res.json();
  return data.keyframes ?? [];
});

export const fetchSnapshot = createAsyncThunk(
  'replay/fetchSnapshot',
  async (timestamp: string) => {
    const url = `${REPLAY_API}?timestamp=${encodeURIComponent(timestamp)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Replay API HTTP ${res.status}`);
    return (await res.json()) as ReplaySnapshotResponse;
  },
);

// ── Slice ────────────────────────────────────────────────────────
const replaySlice = createSlice({
  name: 'replay',
  initialState,
  reducers: {
    setReplayMode(state, action: PayloadAction<ReplayMode>) {
      if (action.payload === 'LIVE') {
        // Reset everything when going back to LIVE
        return { ...initialState, replayTimestamp: new Date().toISOString() };
      }
      state.mode = 'REPLAY';
      state.offsetSeconds = 0;
      state.replayTimestamp = new Date().toISOString();
    },

    setReplayOffset(state, action: PayloadAction<number>) {
      const clamped = Math.max(-REPLAY_WINDOW_SEC, Math.min(0, action.payload));
      state.offsetSeconds = clamped;
      state.replayTimestamp = new Date(Date.now() + clamped * 1000).toISOString();
    },
  },
  extraReducers: (builder) => {
    builder
      // Keyframes
      .addCase(fetchKeyframes.fulfilled, (state, action) => {
        state.keyframes = action.payload;
      })
      .addCase(fetchKeyframes.rejected, (state) => {
        state.keyframes = [];
      })
      // Snapshot
      .addCase(fetchSnapshot.pending, (state) => {
        state.isFetching = true;
        state.error = null;
      })
      .addCase(fetchSnapshot.fulfilled, (state, action) => {
        const data = action.payload;
        state.replayFlights = (data.flights ?? []).map(normalizeReplayFlight);
        state.snapshotFlightCount = data.flight_count ?? data.flights?.length ?? 0;
        state.snapshotDeltaSeconds = data.delta_seconds ?? 0;
        state.isFetching = false;
      })
      .addCase(fetchSnapshot.rejected, (state, action) => {
        state.isFetching = false;
        state.error = action.error.message ?? 'Replay fetch failed';
      });
  },
});

export const { setReplayMode, setReplayOffset } = replaySlice.actions;
export default replaySlice.reducer;
