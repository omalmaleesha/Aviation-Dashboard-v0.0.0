import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Flight } from '../../types/flight';

export type SidebarView = 'map' | 'flights-table' | 'alerts' | 'turnarounds' | 'fuel-analytics' | 'aircraft-details';

interface UiState {
  activeView: SidebarView;
  turnaroundFlight: Flight | null;
  aircraftDetails: {
    flightId: string | null;
    aircraftTypeId: string | null;
  };
}

const initialState: UiState = {
  activeView: 'map',
  turnaroundFlight: null,
  aircraftDetails: {
    flightId: null,
    aircraftTypeId: null,
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActiveView(state, action: PayloadAction<SidebarView>) {
      state.activeView = action.payload;
    },
    setTurnaroundFlight(state, action: PayloadAction<Flight | null>) {
      state.turnaroundFlight = action.payload;
    },
    setAircraftDetailsContext(
      state,
      action: PayloadAction<{ flightId: string | null; aircraftTypeId: string | null }>,
    ) {
      state.aircraftDetails = action.payload;
    },
  },
});

export const { setActiveView, setTurnaroundFlight, setAircraftDetailsContext } = uiSlice.actions;
export default uiSlice.reducer;
