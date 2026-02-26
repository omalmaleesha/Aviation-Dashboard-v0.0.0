import { useState, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { List } from 'react-window';
import {
  ShieldAlert,
  ArrowUpDown,
  Search,
  ChevronUp,
  ChevronDown,
  Plane,
  MapPin,
  AlertTriangle,
} from 'lucide-react';
import type { AlertData, AlertSeverity } from '../types/flight';
import type { CSSProperties } from 'react';

type SortKey = 'timestamp' | 'flightId' | 'severity' | 'distance_km' | 'altitude' | 'message';
type SortDir = 'asc' | 'desc';

interface AlertsTableProps {
  alerts: AlertData[];
}

// ── Severity Badge ────────────────────────────────────
const SEVERITY_STYLES: Record<AlertSeverity, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: 'bg-red-500/15',   text: 'text-red-400',   border: 'border-red-500/30' },
  WARNING:  { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  INFO:     { bg: 'bg-blue-500/15',  text: 'text-blue-400',  border: 'border-blue-500/30' },
};

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const style = SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.INFO;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${style.bg} ${style.text} ${style.border}`}
    >
      {severity === 'CRITICAL' && <AlertTriangle className="w-3 h-3" />}
      {severity}
    </span>
  );
}

// ── Format helpers ────────────────────────────────────
function formatUTC(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' }) + ' Z';
  } catch {
    return iso;
  }
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  } catch {
    return '';
  }
}

// ── Severity ordering for sorting ─────────────────────
const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };

// ── Virtualized Alert Row (react-window v2) ──────────
const ALERT_ROW_HEIGHT = 52; // px per row

interface AlertRowProps {
  alerts: AlertData[];
}

function AlertRowComponent({
  index,
  style,
  alerts,
}: {
  ariaAttributes: Record<string, unknown>;
  index: number;
  style: CSSProperties;
  alerts: AlertData[];
}) {
  const alert = alerts[index];
  if (!alert) return null;

  return (
    <div
      style={style}
      className="flex items-center border-b border-gray-800/20 hover:bg-slate-800/30 transition-colors group"
    >
      {/* Timestamp */}
      <div className="px-4 py-2 flex-1 min-w-0">
        <div className="text-xs font-mono text-gray-300">{formatUTC(alert.timestamp)}</div>
        <div className="text-[10px] font-mono text-gray-600">{formatDate(alert.timestamp)}</div>
      </div>
      {/* Severity */}
      <div className="px-4 py-2 flex-1 min-w-0">
        <SeverityBadge severity={alert.severity} />
      </div>
      {/* Flight */}
      <div className="px-4 py-2 flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Plane className="w-3.5 h-3.5 text-aviation-blue opacity-60 group-hover:opacity-100 transition-opacity" />
          <span className="text-sm font-mono font-bold text-white">{alert.flightId}</span>
        </div>
      </div>
      {/* Message */}
      <div className="px-4 py-2 flex-[2] min-w-0">
        <span className="text-xs text-gray-300 leading-snug line-clamp-2 truncate">
          {alert.message}
        </span>
      </div>
      {/* Distance */}
      <div className="px-4 py-2 flex-1 min-w-0 text-right">
        <div className="flex items-center justify-end gap-1">
          <MapPin className="w-3 h-3 text-gray-500" />
          <span className="text-xs font-mono text-gray-300">{alert.distance_km.toFixed(1)}</span>
        </div>
      </div>
      {/* Altitude */}
      <div className="px-4 py-2 flex-1 min-w-0 text-right">
        <span className="text-xs font-mono text-gray-300">{alert.altitude.toLocaleString()}</span>
      </div>
    </div>
  );
}

// ── Virtualized rows wrapper (auto-measures height) ───
function VirtualizedAlertRows({
  alerts,
  search,
}: {
  alerts: AlertData[];
  search: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(400);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (alerts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500 font-mono text-sm">
          {search ? 'No alerts match your search' : 'No alerts received'}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden">
      <List<AlertRowProps>
        rowComponent={AlertRowComponent}
        rowCount={alerts.length}
        rowHeight={ALERT_ROW_HEIGHT}
        rowProps={{ alerts }}
        overscanCount={20}
        style={{ height, width: '100%' }}
        className="scrollbar-thin"
      />
    </div>
  );
}

// ── Main Component ────────────────────────────────────
export function AlertsTable({ alerts }: AlertsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'timestamp' ? 'desc' : 'asc');
    }
  };

  const displayAlerts = useMemo(() => {
    let filtered = alerts;

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = alerts.filter(
        (a) =>
          a.flightId.toLowerCase().includes(q) ||
          a.message.toLowerCase().includes(q) ||
          a.severity.toLowerCase().includes(q)
      );
    }

    return [...filtered].sort((a, b) => {
      if (sortKey === 'severity') {
        const aOrd = SEVERITY_ORDER[a.severity] ?? 9;
        const bOrd = SEVERITY_ORDER[b.severity] ?? 9;
        return sortDir === 'asc' ? aOrd - bOrd : bOrd - aOrd;
      }
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [alerts, search, sortKey, sortDir]);

  // Column definitions
  const columns: { key: SortKey; label: string; align?: string }[] = [
    { key: 'timestamp', label: 'Time' },
    { key: 'severity', label: 'Severity' },
    { key: 'flightId', label: 'Flight' },
    { key: 'message', label: 'Message' },
    { key: 'distance_km', label: 'Distance (km)', align: 'right' },
    { key: 'altitude', label: 'Altitude (ft)', align: 'right' },
  ];

  const SortIcon = ({ colKey }: { colKey: SortKey }) => {
    if (sortKey !== colKey) return <ArrowUpDown className="w-3 h-3 text-gray-600" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-aviation-blue" />
    ) : (
      <ChevronDown className="w-3 h-3 text-aviation-blue" />
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-full bg-slate-950/95 backdrop-blur-sm"
    >
      {/* Header Bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-800/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
            <ShieldAlert className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Alert Log</h2>
            <p className="text-[10px] text-gray-500 font-mono">
              {displayAlerts.length} of {alerts.length} alerts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Live count badges */}
          <div className="flex items-center gap-2">
            {(['CRITICAL', 'WARNING', 'INFO'] as AlertSeverity[]).map((sev) => {
              const count = alerts.filter((a) => a.severity === sev).length;
              if (count === 0) return null;
              const style = SEVERITY_STYLES[sev];
              return (
                <span
                  key={sev}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${style.bg} ${style.text} ${style.border}`}
                >
                  {count} {sev}
                </span>
              );
            })}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search alerts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-900/60 border border-gray-700/40 rounded-lg text-xs font-mono text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-aviation-blue/50 focus:ring-1 focus:ring-aviation-blue/20 w-56 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Header row (fixed) */}
        <div className="flex-shrink-0">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-900/90 backdrop-blur-sm border-b border-gray-800/50">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-4 py-3 text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-200 transition-colors ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    <div className={`flex items-center gap-1.5 ${col.align === 'right' ? 'justify-end' : ''}`}>
                      {col.label}
                      <SortIcon colKey={col.key} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>

        {/* Virtualized rows */}
        <VirtualizedAlertRows alerts={displayAlerts} search={search} />
      </div>

      {/* Footer summary */}
      {alerts.length > 0 && (
        <div className="flex-shrink-0 px-6 py-2.5 border-t border-gray-800/50 bg-slate-900/40">
          <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 uppercase tracking-wider">
            <span>
              Showing {displayAlerts.length} of {alerts.length} alerts
            </span>
            <span>
              Source: <span className="text-red-400">REST + WebSocket</span>
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
