export type AdminUserRole = 'ADMIN' | 'ADMINISTRATOR' | 'DISPATCHER' | 'OPERATOR' | 'VIEWER';
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED';

export interface AdminOverview {
  total_users: number;
  active_sessions: number;
  open_incidents: number;
  unresolved_alerts: number;
  system_health_score: number;
}

export interface AdminManagedUser {
  id: number;
  email: string;
  role: AdminUserRole;
  is_admin: boolean;
  is_active: boolean;
  is_test_user: boolean;
  created_at: string;
  last_login_at?: string | null;
}

export interface AdminIncident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  affected_system: string;
  created_at: string;
  owner?: string | null;
}

export interface AdminAuditLog {
  id: string;
  actor_email: string;
  action: string;
  target: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface AdminSystemMetric {
  id: string;
  label: string;
  value: number;
  unit: string;
  status: 'GOOD' | 'WARN' | 'BAD';
}
