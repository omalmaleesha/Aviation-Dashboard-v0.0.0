import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Flight, RawFlightData } from '../../types/flight';
import { normalizeRawFlight } from '../../types/flight';
import { MOCK_FLIGHTS } from '../../data/mockFlights';

// ── Types ────────────────────────────────────────────────────────
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'using-mock';

interface FlightsState {
  flights: Flight[];
  connectionStatus: ConnectionStatus;
}

const initialState: FlightsState = {
  flights: MOCK_FLIGHTS,
  connectionStatus: 'connecting',
};

// ── Slice ────────────────────────────────────────────────────────
const flightsSlice = createSlice({
  name: 'flights',
  initialState,
  reducers: {
    /** Replace the full flights array (called by the WS/REST flush). */
    setFlights(state, action: PayloadAction<Flight[]>) {
      state.flights = action.payload;
    },

    /** Accept raw API data, normalize, and replace flights. */
    setRawFlights(state, action: PayloadAction<RawFlightData[]>) {
      state.flights = action.payload.map(normalizeRawFlight);
    },

    setConnectionStatus(state, action: PayloadAction<ConnectionStatus>) {
      state.connectionStatus = action.payload;
    },

    /** Fall back to mock data when all data sources are exhausted. */
    fallbackToMock(state) {
      state.flights = MOCK_FLIGHTS;
      state.connectionStatus = 'using-mock';
    },
  },
});

export const { setFlights, setRawFlights, setConnectionStatus, fallbackToMock } =
  flightsSlice.actions;

export default flightsSlice.reducer;
