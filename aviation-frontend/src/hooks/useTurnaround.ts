import { useState, useEffect, useCallback, useRef } from 'react';
import type { TurnaroundState, TurnaroundTask, TaskStatus, ApiTaskStatus, TurnaroundApiResponse, DelayPrediction } from '../types/turnaround';
import { TASK_DEFINITIONS, TURNAROUND_WINDOW_MIN } from '../types/turnaround';
import { API_BASE } from '../config';

const POLL_INTERVAL = 5_000;

// ── Helpers: map between backend and frontend status strings ─────

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

/** Map an API response into our local TurnaroundState shape. */
function mapApiToState(apiData: TurnaroundApiResponse): TurnaroundState {
  const landingTime = new Date(apiData.landing_time).getTime();
  const windowMin = Math.round(
    (new Date(apiData.target_departure_time).getTime() - landingTime) / 60_000,
  );

  const tasks: TurnaroundTask[] = TASK_DEFINITIONS.map((def) => {
    const apiTask = apiData.tasks.find((t) => TASK_NAME_MAP[t.task_name] === def.id);
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

/**
 * Hook that manages the full turnaround lifecycle for one flight.
 *
 * When the backend is reachable the state is driven by
 * GET /api/turnaround/{flightId} (polled every 5 s) and task
 * status changes are sent via POST /api/turnaround/{flightId}/update.
 *
 * If the API is unreachable the hook falls back to fully-local
 * state management so the UI never breaks.
 */
export function useTurnaround() {
  const [state, setState] = useState<TurnaroundState | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const usingApiRef = useRef(false);

  // ── Fetch turnaround from backend and apply ───────────────────
  const fetchAndApply = useCallback(async (flightId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/turnaround/${encodeURIComponent(flightId)}`);
      if (!res.ok) return; // backend not available — keep local state
      const json: TurnaroundApiResponse = await res.json();

      usingApiRef.current = true;
      setState(mapApiToState(json));
      setElapsedSec(Math.round(json.elapsed_minutes * 60));
    } catch {
      // backend unreachable — local state continues
    }
  }, []);

  // ── POST task update and apply returned state ─────────────────
  const postTaskUpdate = useCallback(
    async (flightId: string, taskName: string, status: ApiTaskStatus) => {
      try {
        const res = await fetch(
          `${API_BASE}/api/turnaround/${encodeURIComponent(flightId)}/update`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task_name: taskName, status }),
          },
        );
        if (!res.ok) return;
        const json: TurnaroundApiResponse = await res.json();
        setState(mapApiToState(json));
        setElapsedSec(Math.round(json.elapsed_minutes * 60));
      } catch {
        // non-blocking — optimistic local update already applied
      }
    },
    [],
  );

  // ── Start turnaround ──────────────────────────────────────────
  const startTurnaround = useCallback(
    (flightId: string) => {
      // Clean up any previous poll
      if (pollRef.current) clearInterval(pollRef.current);

      activeIdRef.current = flightId;
      usingApiRef.current = false;

      // Optimistic local state so the UI opens immediately
      const now = Date.now();
      setState({
        flightId,
        t0: now,
        windowMin: TURNAROUND_WINDOW_MIN,
        tasks: TASK_DEFINITIONS.map((def) => ({ ...def, status: 'NOT_STARTED' as TaskStatus })),
        delayPrediction: null,
      });
      setElapsedSec(0);

      // Immediately try to fetch real data, then poll
      fetchAndApply(flightId);
      pollRef.current = setInterval(() => fetchAndApply(flightId), POLL_INTERVAL);
    },
    [fetchAndApply],
  );

  // ── Local clock tick (smooth between polls) ───────────────────
  useEffect(() => {
    if (!state) return;

    tickRef.current = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [state]);

  // ── Cycle task status ─────────────────────────────────────────
  const cycleTaskStatus = useCallback(
    (taskId: string) => {
      setState((prev) => {
        if (!prev) return prev;

        const updatedTasks = prev.tasks.map((t) => {
          if (t.id !== taskId) return t;
          const nextStatus = NEXT_STATUS[t.status];

          // Fire POST to backend (non-blocking)
          if (activeIdRef.current) {
            postTaskUpdate(activeIdRef.current, taskId, LOCAL_TO_API[nextStatus]);
          }

          return { ...t, status: nextStatus };
        });

        return { ...prev, tasks: updatedTasks };
      });
    },
    [postTaskUpdate],
  );

  // ── Set a specific status ─────────────────────────────────────
  const setTaskStatus = useCallback(
    (taskId: string, status: TaskStatus) => {
      setState((prev) => {
        if (!prev) return prev;

        if (activeIdRef.current) {
          postTaskUpdate(activeIdRef.current, taskId, LOCAL_TO_API[status]);
        }

        return {
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)),
        };
      });
    },
    [postTaskUpdate],
  );

  // ── Close / clear ─────────────────────────────────────────────
  const closeTurnaround = useCallback(() => {
    activeIdRef.current = null;
    setState(null);
    setElapsedSec(0);
    usingApiRef.current = false;
    if (tickRef.current) clearInterval(tickRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Derived values ────────────────────────────────────────────
  const elapsedMin = elapsedSec / 60;
  const allComplete = state ? state.tasks.every((t) => t.status === 'COMPLETE') : false;
  const remainingSec = state ? state.windowMin * 60 - elapsedSec : 0;

  const delayPrediction: DelayPrediction | null = state?.delayPrediction ?? null;

  const isTaskCritical = useCallback(
    (task: TurnaroundTask) => {
      // If the API tells us which task is the bottleneck, highlight it
      if (delayPrediction?.at_risk && delayPrediction.bottleneck_task === task.id) {
        return task.status !== 'COMPLETE';
      }
      return task.status === 'NOT_STARTED' && elapsedMin > task.startOffsetMin;
    },
    [elapsedMin, delayPrediction],
  );

  return {
    state,
    elapsedSec,
    elapsedMin,
    remainingSec,
    allComplete,
    startTurnaround,
    closeTurnaround,
    cycleTaskStatus,
    setTaskStatus,
    isTaskCritical,
  };
}
