// ── Turnaround Management Types ─────────────────────────────────

export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE';

/** Status strings returned by the backend API */
export type ApiTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface TurnaroundTaskDef {
  id: string;
  label: string;
  /** lucide-react icon name key */
  icon: 'fuel' | 'brush' | 'utensils' | 'briefcase';
  /** Duration in minutes */
  durationMin: number;
  /** Start offset from T-0 in minutes */
  startOffsetMin: number;
  /** Colour theme */
  color: string;       // tailwind colour stem e.g. "amber"
  colorHex: string;    // for Framer Motion
}

export interface TurnaroundTask extends TurnaroundTaskDef {
  status: TaskStatus;
}

export interface TurnaroundState {
  flightId: string;
  /** Epoch ms when the turnaround clock started (T-0 = landing) */
  t0: number;
  /** Total turnaround window in minutes */
  windowMin: number;
  tasks: TurnaroundTask[];
  /** Delay prediction from the backend (null when no API data) */
  delayPrediction: DelayPrediction | null;
}

// ── Backend API shapes ──────────────────────────────────────────

/** GET /api/turnaround/{flight_id}  &  GET /api/turnarounds */
export interface TurnaroundApiResponse {
  flight_id: string;
  landing_time: string;            // ISO-8601
  target_departure_time: string;   // ISO-8601
  is_completed: boolean;
  tasks: TurnaroundApiTask[];
  delay_prediction: DelayPrediction | null;
  elapsed_minutes: number;
  remaining_minutes: number;
  progress_percent: number;
}

export interface TurnaroundApiTask {
  task_name: string;               // "refueling" | "cleaning" | "catering" | "baggage"
  status: ApiTaskStatus;
  estimated_duration_min: number;
  started_at: string | null;       // ISO-8601 or null
  completed_at: string | null;
}

export interface DelayPrediction {
  at_risk: boolean;
  estimated_delay_minutes: number;
  bottleneck_task: string;
  message: string;
}

/** POST /api/turnaround/{flight_id}/update  —  request body */
export interface TurnaroundUpdateRequest {
  task_name: string;
  status: ApiTaskStatus;
}

// ── 45-minute standard turnaround ───────────────────────────────
export const TURNAROUND_WINDOW_MIN = 45;

export const TASK_DEFINITIONS: TurnaroundTaskDef[] = [
  {
    id: 'refueling',
    label: 'Refueling',
    icon: 'fuel',
    durationMin: 20,
    startOffsetMin: 5,
    color: 'amber',
    colorHex: '#f59e0b',
  },
  {
    id: 'cleaning',
    label: 'Cleaning',
    icon: 'brush',
    durationMin: 15,
    startOffsetMin: 0,
    color: 'cyan',
    colorHex: '#06b6d4',
  },
  {
    id: 'catering',
    label: 'Catering',
    icon: 'utensils',
    durationMin: 15,
    startOffsetMin: 5,
    color: 'purple',
    colorHex: '#a855f7',
  },
  {
    id: 'baggage',
    label: 'Baggage',
    icon: 'briefcase',
    durationMin: 25,
    startOffsetMin: 0,
    color: 'emerald',
    colorHex: '#10b981',
  },
];
