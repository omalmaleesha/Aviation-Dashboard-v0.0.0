import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type {
  TurnaroundState,
  TurnaroundTask,
  TaskStatus,
  ApiTaskStatus,
  TurnaroundApiResponse,
  TurnaroundApiTask,
} from '../../types/turnaround';
import { TASK_DEFINITIONS, TURNAROUND_WINDOW_MIN } from '../../types/turnaround';
import { API_BASE } from '../../config';
import { authFetch } from '../../auth/authFetch';

// ── Helpers: status mapping ──────────────────────────────────────
const API_TO_LOCAL: Record<ApiTaskStatus, TaskStatus> = {
  PENDING: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETE',
};

const LOCAL_TO_API: Record<TaskStatus, ApiTaskStatus> = {
  NOT_STARTED: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETE: 'COMPLETED',
};

const NEXT_STATUS: Record<TaskStatus, TaskStatus> = {
  NOT_STARTED: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETE',
  COMPLETE: 'NOT_STARTED',
};

const TASK_NAME_MAP: Record<string, string> = {
  refueling: 'refueling',
  cleaning: 'cleaning',
  catering: 'catering',
  baggage: 'baggage',
};

function mapApiToState(apiData: TurnaroundApiResponse): TurnaroundState {
  const landingTime = new Date(apiData.landing_time).getTime();
  const windowMin = Math.round(
    (new Date(apiData.target_departure_time).getTime() - landingTime) / 60_000,
  );

  const tasks: TurnaroundTask[] = TASK_DEFINITIONS.map((def) => {
    const apiTask: TurnaroundApiTask | undefined = apiData.tasks.find(
      (t) => TASK_NAME_MAP[t.task_name] === def.id,
    );
    const status: TaskStatus = apiTask ? API_TO_LOCAL[apiTask.status] : 'NOT_STARTED';
    return { ...def, status };
  });

  return {
    flightId: apiData.flight_id,
    t0: landingTime,
    windowMin: windowMin > 0 ? windowMin : TURNAROUND_WINDOW_MIN,
    tasks,
    delayPrediction: apiData.delay_prediction,
  };
}

// ── Slice state ──────────────────────────────────────────────────
interface TurnaroundSliceState {
  turnaround: TurnaroundState | null;
  elapsedSec: number;
}

const initialState: TurnaroundSliceState = {
  turnaround: null,
  elapsedSec: 0,
};

// ── Async thunks ─────────────────────────────────────────────────
export const fetchTurnaround = createAsyncThunk(
  'turnaround/fetch',
  async (flightId: string) => {
    const res = await authFetch(`${API_BASE}/api/turnaround/${encodeURIComponent(flightId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as TurnaroundApiResponse;
  },
);

export const postTaskUpdate = createAsyncThunk(
  'turnaround/postTask',
  async ({ flightId, taskName, status }: { flightId: string; taskName: string; status: ApiTaskStatus }) => {
    const res = await authFetch(
      `${API_BASE}/api/turnaround/${encodeURIComponent(flightId)}/update`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_name: taskName, status }),
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as TurnaroundApiResponse;
  },
);

// ── Slice ────────────────────────────────────────────────────────
const turnaroundSlice = createSlice({
  name: 'turnaround',
  initialState,
  reducers: {
    /** Initialise a turnaround with optimistic local state. */
    startTurnaround(state, action: PayloadAction<string>) {
      const flightId = action.payload;
      state.turnaround = {
        flightId,
        t0: Date.now(),
        windowMin: TURNAROUND_WINDOW_MIN,
        tasks: TASK_DEFINITIONS.map((def) => ({ ...def, status: 'NOT_STARTED' as TaskStatus })),
        delayPrediction: null,
      };
      state.elapsedSec = 0;
    },

    closeTurnaround(state) {
      state.turnaround = null;
      state.elapsedSec = 0;
    },

    /** Increment elapsed timer by 1 second (called from interval middleware). */
    tickElapsed(state) {
      if (state.turnaround) {
        state.elapsedSec += 1;
      }
    },

    /** Optimistic cycle of task status. */
    cycleTaskStatus(state, action: PayloadAction<string>) {
      if (!state.turnaround) return;
      state.turnaround.tasks = state.turnaround.tasks.map((t) =>
        t.id === action.payload ? { ...t, status: NEXT_STATUS[t.status] } : t,
      );
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTurnaround.fulfilled, (state, action) => {
        state.turnaround = mapApiToState(action.payload);
        state.elapsedSec = Math.round(action.payload.elapsed_minutes * 60);
      })
      .addCase(postTaskUpdate.fulfilled, (state, action) => {
        state.turnaround = mapApiToState(action.payload);
        state.elapsedSec = Math.round(action.payload.elapsed_minutes * 60);
      });
  },
});

export const { startTurnaround, closeTurnaround, tickElapsed, cycleTaskStatus } =
  turnaroundSlice.actions;

// ── Selectors ────────────────────────────────────────────────────
export const selectTurnaround = (state: { turnaround: TurnaroundSliceState }) =>
  state.turnaround.turnaround;
export const selectElapsedSec = (state: { turnaround: TurnaroundSliceState }) =>
  state.turnaround.elapsedSec;

/** Helper — re-exported so components can use it. */
export { LOCAL_TO_API };

export default turnaroundSlice.reducer;
