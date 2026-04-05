export type CommsPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CommsChannelHealth = 'ONLINE' | 'DEGRADED' | 'OFFLINE';

export interface CommsChannelStatus {
  channel_id: string;
  label: string;
  frequency_mhz: number;
  health: CommsChannelHealth;
  last_heartbeat_at: string;
  active_incidents: number;
}

export interface CommsMessage {
  id: string;
  channel_id: string;
  source: string;
  message: string;
  priority: CommsPriority;
  created_at: string;
  requires_ack: boolean;
  acknowledged: boolean;
}

export interface CommsOverviewResponse {
  channels: CommsChannelStatus[];
  messages: CommsMessage[];
  unread_count: number;
  active_incidents: number;
}
