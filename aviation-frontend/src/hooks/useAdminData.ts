import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE } from '../config';
import { authFetch } from '../auth/authFetch';
import type {
  AdminAuditLog,
  AdminIncident,
  AdminManagedUser,
  AdminOverview,
  AdminSystemMetric,
  AdminUserRole,
} from '../types/admin';

const POLL_MS = 15_000;

const FALLBACK_OVERVIEW: AdminOverview = {
  total_users: 18,
  active_sessions: 5,
  open_incidents: 2,
  unresolved_alerts: 7,
  system_health_score: 93,
};

const FALLBACK_USERS: AdminManagedUser[] = [
  {
    id: 1,
    email: 'admin.test@skyops.com',
    role: 'ADMIN',
    is_admin: true,
    is_active: true,
    is_test_user: true,
    created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
    last_login_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: 2,
    email: 'ops.supervisor@skyops.com',
    role: 'DISPATCHER',
    is_admin: false,
    is_active: true,
    is_test_user: false,
    created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
    last_login_at: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
  },
];

const FALLBACK_INCIDENTS: AdminIncident[] = [
  {
    id: 'INC-2101',
    title: 'Ground comm latency spike',
    severity: 'HIGH',
    status: 'INVESTIGATING',
    affected_system: 'Comms Service',
    created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    owner: 'ops.supervisor@skyops.com',
  },
  {
    id: 'INC-2098',
    title: 'METAR upstream timeout bursts',
    severity: 'MEDIUM',
    status: 'OPEN',
    affected_system: 'Weather Ingestion',
    created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
];

const FALLBACK_AUDIT: AdminAuditLog[] = [
  {
    id: 'AUD-8802',
    actor_email: 'admin.test@skyops.com',
    action: 'ROLE_UPDATE',
    target: 'ops.supervisor@skyops.com',
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    metadata: { from: 'OPERATOR', to: 'DISPATCHER' },
  },
  {
    id: 'AUD-8801',
    actor_email: 'admin.test@skyops.com',
    action: 'INCIDENT_ACKNOWLEDGED',
    target: 'INC-2101',
    created_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
];

const FALLBACK_METRICS: AdminSystemMetric[] = [
  { id: 'latency', label: 'API Latency', value: 140, unit: 'ms', status: 'GOOD' },
  { id: 'error-rate', label: 'Error Rate', value: 1.2, unit: '%', status: 'WARN' },
  { id: 'queue-depth', label: 'Message Queue Depth', value: 38, unit: 'msg', status: 'GOOD' },
  { id: 'ws-clients', label: 'WebSocket Clients', value: 22, unit: 'conn', status: 'GOOD' },
];

export function useAdminData() {
  const [overview, setOverview] = useState<AdminOverview>(FALLBACK_OVERVIEW);
  const [users, setUsers] = useState<AdminManagedUser[]>(FALLBACK_USERS);
  const [incidents, setIncidents] = useState<AdminIncident[]>(FALLBACK_INCIDENTS);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>(FALLBACK_AUDIT);
  const [metrics, setMetrics] = useState<AdminSystemMetric[]>(FALLBACK_METRICS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [overviewRes, usersRes, incidentsRes, auditRes, metricsRes] = await Promise.all([
        authFetch(`${API_BASE}/api/admin/overview`),
        authFetch(`${API_BASE}/api/admin/users?limit=50`),
        authFetch(`${API_BASE}/api/admin/incidents?status=open,investigating&limit=20`),
        authFetch(`${API_BASE}/api/admin/audit-logs?limit=30`),
        authFetch(`${API_BASE}/api/admin/system/metrics`),
      ]);

      if (!overviewRes.ok || !usersRes.ok || !incidentsRes.ok || !auditRes.ok || !metricsRes.ok) {
        throw new Error('Admin API unavailable');
      }

      const [overviewData, usersData, incidentsData, auditData, metricsData] = await Promise.all([
        overviewRes.json(),
        usersRes.json(),
        incidentsRes.json(),
        auditRes.json(),
        metricsRes.json(),
      ]);

      if (!mountedRef.current) return;

      setOverview((overviewData as { overview?: AdminOverview }).overview ?? (overviewData as AdminOverview));
      setUsers((usersData as { items?: AdminManagedUser[] }).items ?? (usersData as AdminManagedUser[]));
      setIncidents((incidentsData as { items?: AdminIncident[] }).items ?? (incidentsData as AdminIncident[]));
      setAuditLogs((auditData as { items?: AdminAuditLog[] }).items ?? (auditData as AdminAuditLog[]));
      setMetrics((metricsData as { items?: AdminSystemMetric[] }).items ?? (metricsData as AdminSystemMetric[]));
      setError(null);
      setIsLoading(false);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load admin data');
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadAll();
    pollTimerRef.current = setInterval(loadAll, POLL_MS);

    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [loadAll]);

  const updateUserRole = useCallback(async (userId: number, role: AdminUserRole) => {
    await authFetch(`${API_BASE}/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, role } : user)));
  }, []);

  const toggleUserActive = useCallback(async (userId: number, isActive: boolean) => {
    await authFetch(`${API_BASE}/api/admin/users/${userId}/active`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive }),
    });
    setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, is_active: isActive } : user)));
  }, []);

  const resolveIncident = useCallback(async (incidentId: string) => {
    await authFetch(`${API_BASE}/api/admin/incidents/${encodeURIComponent(incidentId)}/resolve`, {
      method: 'POST',
    });
    setIncidents((prev) =>
      prev.map((incident) =>
        incident.id === incidentId ? { ...incident, status: 'RESOLVED' } : incident,
      ),
    );
  }, []);

  return {
    overview,
    users,
    incidents,
    auditLogs,
    metrics,
    isLoading,
    error,
    refresh: loadAll,
    updateUserRole,
    toggleUserActive,
    resolveIncident,
  };
}
