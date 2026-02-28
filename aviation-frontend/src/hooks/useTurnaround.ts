import { useEffect, useCallback, useRef } from 'react';
import type { TurnaroundTask, DelayPrediction } from '../types/turnaround';
import { useAppDispatch, useAppSelector } from '../store';
import {
  startTurnaround as startTurnaroundAction,
  closeTurnaround as closeTurnaroundAction,
  cycleTaskStatus as cycleTaskAction,
  tickElapsed,
  fetchTurnaround,
  postTaskUpdate,
  LOCAL_TO_API,
} from '../store/slices/turnaroundSlice';

const POLL_INTERVAL = 5_000;

/**
 * Hook that manages the full turnaround lifecycle for one flight.
 *
 * Dispatches actions to the Redux `turnaround` slice and runs
 * side-effects (polling, tick timer) locally.
 */
export function useTurnaround() {
  const dispatch = useAppDispatch();
  const state = useAppSelector((s) => s.turnaround.turnaround);
  const elapsedSec = useAppSelector((s) => s.turnaround.elapsedSec);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeIdRef = useRef<string | null>(null);

  // ── Start turnaround ──────────────────────────────────────────
  const startTurnaround = useCallback(
    (flightId: string) => {
      if (pollRef.current) clearInterval(pollRef.current);

      activeIdRef.current = flightId;

      // Optimistic local state
      dispatch(startTurnaroundAction(flightId));

      // Immediately try to fetch real data, then poll
      dispatch(fetchTurnaround(flightId));
      pollRef.current = setInterval(() => dispatch(fetchTurnaround(flightId)), POLL_INTERVAL);
    },
    [dispatch],
  );

  // ── Local clock tick (smooth between polls) ───────────────────
  useEffect(() => {
    if (!state) return;

    tickRef.current = setInterval(() => {
      dispatch(tickElapsed());
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [state, dispatch]);

  // ── Cycle task status ─────────────────────────────────────────
  const cycleTaskStatus = useCallback(
    (taskId: string) => {
      if (!state) return;

      // Find the task to determine the next status for the API call
      const task = state.tasks.find((t: TurnaroundTask) => t.id === taskId);
      if (!task) return;

      const NEXT: Record<string, string> = {
        NOT_STARTED: 'IN_PROGRESS',
        IN_PROGRESS: 'COMPLETE',
        COMPLETE: 'NOT_STARTED',
      };
      const nextStatus = NEXT[task.status] as keyof typeof LOCAL_TO_API;

      // Optimistic local update
      dispatch(cycleTaskAction(taskId));

      // Fire POST to backend (non-blocking)
      if (activeIdRef.current) {
        dispatch(
          postTaskUpdate({
            flightId: activeIdRef.current,
            taskName: taskId,
            status: LOCAL_TO_API[nextStatus],
          }),
        );
      }
    },
    [dispatch, state],
  );

  // ── Close / clear ─────────────────────────────────────────────
  const closeTurnaround = useCallback(() => {
    activeIdRef.current = null;
    dispatch(closeTurnaroundAction());
    if (tickRef.current) clearInterval(tickRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
  }, [dispatch]);

  // Clean up intervals on unmount
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Derived values ────────────────────────────────────────────
  const elapsedMin = elapsedSec / 60;
  const allComplete = state ? state.tasks.every((t: TurnaroundTask) => t.status === 'COMPLETE') : false;
  const remainingSec = state ? state.windowMin * 60 - elapsedSec : 0;

  const delayPrediction: DelayPrediction | null = state?.delayPrediction ?? null;

  const isTaskCritical = useCallback(
    (task: TurnaroundTask) => {
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
    isTaskCritical,
  };
}
