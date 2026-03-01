import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { MetarResponse } from '../../types/flight';
import { API_BASE } from '../../config';

interface MetarState {
  metar: MetarResponse | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: MetarState = {
  metar: null,
  isLoading: true,
  error: null,
};

// ── Async thunk ──────────────────────────────────────────────────
export const fetchMetar = createAsyncThunk(
  'metar/fetch',
  async (icao: string) => {
    const res = await fetch(`${API_BASE}/api/metar/${icao}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as MetarResponse;
  },
);

// ── Slice ────────────────────────────────────────────────────────
const metarSlice = createSlice({
  name: 'metar',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMetar.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMetar.fulfilled, (state, action) => {
        state.metar = action.payload;
        state.isLoading = false;
        state.error = null;
      })
      .addCase(fetchMetar.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message ?? 'Failed to fetch METAR';
      });
  },
});

export default metarSlice.reducer;
