import { useState, useCallback, useRef } from 'react';
import type { FuelAnalyticsResponse, PaginatedAnalyticsResponse } from '../types/flight';
import { API_BASE } from '../config';
import { authFetch } from '../auth/authFetch';

/**
 * On-demand analytics fetcher.
 *
 * ✅ fetchOne(flightId)    — GET /api/analytics/{flight_id}   (detail panel)
 * ✅ fetchPage(limit, off)  — GET /api/analytics?limit=&offset= (table view)
 *
 * ❌ No automatic polling — callers decide when to fetch.
 */
export function useFuelAnalyticsAPI() {
  // Single-flight cache (most recent detail fetch)
  const [detail, setDetail] = useState<FuelAnalyticsResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Paginated table cache
  const [page, setPage] = useState<PaginatedAnalyticsResponse | null>(null);
  const [pageLoading, setPageLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // ── Fetch single flight detail ─────────────────────────────────
  const fetchOne = useCallback(async (flightId: string): Promise<FuelAnalyticsResponse | null> => {
    setDetailLoading(true);
    try {
  const res = await authFetch(`${API_BASE}/api/analytics/${encodeURIComponent(flightId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: FuelAnalyticsResponse = await res.json();
      if (mountedRef.current) {
        setDetail(data);
        setError(null);
      }
      return data;
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch flight analytics');
      }
      return null;
    } finally {
      if (mountedRef.current) setDetailLoading(false);
    }
  }, []);

  // ── Fetch paginated table ──────────────────────────────────────
  const fetchPage = useCallback(async (limit = 50, offset = 0): Promise<PaginatedAnalyticsResponse | null> => {
    setPageLoading(true);
    try {
  const res = await authFetch(`${API_BASE}/api/analytics?limit=${limit}&offset=${offset}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Backend may return a flat array (old format) or paginated object
      const normalised: PaginatedAnalyticsResponse = Array.isArray(data)
        ? { items: data.slice(offset, offset + limit), total: data.length, limit, offset }
        : data;

      if (mountedRef.current) {
        setPage(normalised);
        setError(null);
      }
      return normalised;
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch analytics page');
      }
      return null;
    } finally {
      if (mountedRef.current) setPageLoading(false);
    }
  }, []);

  return { detail, detailLoading, page, pageLoading, error, fetchOne, fetchPage };
}

