import { useRef, useCallback, useEffect } from 'react';
import type { ReplayMode } from '../types/replay';
import { SLIDER_DEBOUNCE_MS } from '../types/replay';
import { useAppDispatch, useAppSelector } from '../store';
import {
  setReplayMode,
  setReplayOffset,
  fetchKeyframes,
  fetchSnapshot,
} from '../store/slices/replaySlice';

/**
 * `useReplay` — thin connector that dispatches to the Redux `replay` slice.
 *
 * • In **LIVE** mode nothing changes — the caller keeps using WS data.
 * • In **REPLAY** mode the hook triggers thunks for keyframes & snapshots.
 */
export function useReplay() {
  const dispatch = useAppDispatch();
  const state = useAppSelector((s) => s.replay);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // ── Mode toggle ─────────────────────────────────────────────
  const setMode = useCallback(
    (mode: ReplayMode) => {
      dispatch(setReplayMode(mode));

      if (mode === 'REPLAY') {
        const ts = new Date().toISOString();
        dispatch(fetchKeyframes());
        dispatch(fetchSnapshot(ts));
      } else {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
      }
    },
    [dispatch],
  );

  // ── Slider change (debounced) ───────────────────────────────
  const setOffset = useCallback(
    (offsetSeconds: number) => {
      dispatch(setReplayOffset(offsetSeconds));

      // Compute the timestamp for the API call
      const clamped = Math.max(-1800, Math.min(0, offsetSeconds));
      const ts = new Date(Date.now() + clamped * 1000).toISOString();

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        dispatch(fetchSnapshot(ts));
      }, SLIDER_DEBOUNCE_MS);
    },
    [dispatch],
  );

  return {
    ...state,
    setMode,
    setOffset,
  };
}
