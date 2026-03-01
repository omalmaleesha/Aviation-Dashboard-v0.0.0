import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Flight } from '../../types/flight';

export type SidebarView = 'map' | 'flights-table' | 'alerts' | 'turnarounds' | 'fuel-analytics';

interface UiState {
  activeView: SidebarView;
  turnaroundFlight: Flight | null;
}

const initialState: UiState = {
  activeView: 'map',
  turnaroundFlight: null,
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
  },
});

export const { setActiveView, setTurnaroundFlight } = uiSlice.actions;
export default uiSlice.reducer;
