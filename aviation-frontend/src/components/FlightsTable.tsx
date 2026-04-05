import { useState, useMemo, useRef, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { List } from 'react-window';
import {
  Plane,
  ArrowUpDown,
  Search,
  AlertTriangle,
  Loader2,
  ChevronUp,
  ChevronDown,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { Flight, FlightStatus } from '../types/flight';
import { STATUS_STYLES } from '../types/flight';
import type { ConnectionStatus } from '../hooks/useFlightData';
import type { CSSProperties } from 'react';

type SortKey = keyof Flight;
type SortDir = 'asc' | 'desc';

interface FlightsTableProps {
  flights: Flight[];
  connectionStatus: ConnectionStatus;
  onFlightDoubleClick?: (flightId: string) => void;
  onAircraftTypeClick?: (flight: Flight) => void;
}

// ── Status Badge ──────────────────────────────────────
function StatusBadge({ status }: { status: FlightStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${style.bg} ${style.text} ${style.border}`}
    >
      {status === 'DELAYED' && <AlertTriangle className="w-3 h-3 mr-1" />}
      {status}
    </span>
  );
}

// ── Progress Bar ──────────────────────────────────────
function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-aviation-blue to-cyan-400"
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[10px] font-mono text-gray-400 w-8 text-right">{value}%</span>
    </div>
  );
}

// ── Skeleton Table ────────────────────────────────────
function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-gray-800/30">
          {Array.from({ length: 8 }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 bg-slate-800 rounded animate-pulse" style={{ width: `${50 + Math.random() * 40}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Virtualized Flight Row (react-window v2) ─────────
const ROW_HEIGHT = 44; // px per row

interface FlightRowProps {
  flights: Flight[];
  onFlightDoubleClick?: (flightId: string) => void;
  onAircraftTypeClick?: (flight: Flight) => void;
}

function FlightRowComponent({
  index,
  style,
  flights,
  onFlightDoubleClick,
  onAircraftTypeClick,
}: {
  ariaAttributes: Record<string, unknown>;
  index: number;
  style: CSSProperties;
  flights: Flight[];
  onFlightDoubleClick?: (flightId: string) => void;
  onAircraftTypeClick?: (flight: Flight) => void;
}) {
  const flight = flights[index];
  if (!flight) return null;

  return (
    <div
      style={style}
      className="flex items-center border-b border-gray-800/20 hover:bg-slate-800/30 transition-colors group cursor-pointer"
      onDoubleClick={() => onFlightDoubleClick?.(flight.flightId)}
      title="Double-click to show this flight on map"
    >
      {/* Flight ID */}
      <div className="px-4 py-2 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Plane
            className="w-3.5 h-3.5 text-aviation-blue opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0"
            style={{ transform: `rotate(${flight.heading}deg)` }}
          />
          <span className="text-sm font-mono font-bold text-white truncate">{flight.flightId}</span>
        </div>
      </div>
      {/* Aircraft */}
      <div className="px-4 py-2 flex-1 min-w-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAircraftTypeClick?.(flight);
          }}
          className="text-xs font-mono font-semibold text-violet-400 hover:text-violet-300 underline-offset-2 hover:underline"
          title="View aircraft details"
        >
          {flight.aircraftType ?? 'UNKNOWN'}
        </button>
      </div>
      {/* Origin */}
      <div className="px-4 py-2 flex-1 min-w-0">
        <span className="text-xs font-mono font-semibold text-cyan-400">{flight.origin}</span>
      </div>
      {/* Destination */}
      <div className="px-4 py-2 flex-1 min-w-0">
        <span className="text-xs font-mono font-semibold text-emerald-400">{flight.destination}</span>
      </div>
      {/* Altitude */}
      <div className="px-4 py-2 flex-1 min-w-0 text-right">
        <span className="text-xs font-mono text-gray-300">{flight.altitude.toLocaleString()}</span>
      </div>
      {/* Speed */}
      <div className="px-4 py-2 flex-1 min-w-0 text-right">
        <span className="text-xs font-mono text-gray-300">{Math.round(flight.speed)}</span>
      </div>
      {/* Heading */}
      <div className="px-4 py-2 flex-1 min-w-0 text-right">
        <span className="text-xs font-mono text-gray-300">{Math.round(flight.heading)}°</span>
      </div>
      {/* Status */}
      <div className="px-4 py-2 flex-1 min-w-0">
        <StatusBadge status={flight.status} />
      </div>
      {/* Progress */}
      <div className="px-4 py-2 flex-1 min-w-[140px]">
        <ProgressBar value={flight.progress} />
      </div>
    </div>
  );
}

// ── Virtualized rows wrapper (auto-measures height) ───
function VirtualizedFlightRows({
  flights,
  isConnecting,
  search,
  onFlightDoubleClick,
  onAircraftTypeClick,
}: {
  flights: Flight[];
  isConnecting: boolean;
  search: string;
  columnCount: number;
  onFlightDoubleClick?: (flightId: string) => void;
  onAircraftTypeClick?: (flight: Flight) => void;
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

  if (isConnecting && flights.length === 0) {
    return (
      <div className="flex-1 overflow-auto scrollbar-thin">
        <table className="w-full text-left">
          <tbody>
            <TableSkeleton />
          </tbody>
        </table>
      </div>
    );
  }

  if (flights.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500 font-mono text-sm">
          {search ? 'No flights match your search' : 'No flight data available'}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden">
      <List<FlightRowProps>
        rowComponent={FlightRowComponent}
        rowCount={flights.length}
        rowHeight={ROW_HEIGHT}
  rowProps={{ flights, onFlightDoubleClick, onAircraftTypeClick }}
        overscanCount={20}
        style={{ height, width: '100%' }}
        className="scrollbar-thin"
      />
    </div>
  );
}

// ── Main Component ────────────────────────────────────
export const FlightsTable = memo(function FlightsTable({ flights, connectionStatus, onFlightDoubleClick, onAircraftTypeClick }: FlightsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('callsign');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [search, setSearch] = useState('');

  const isLive = connectionStatus === 'connected';
  const isConnecting = connectionStatus === 'connecting';

  // Sorting
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Filtered + sorted flights
  const displayFlights = useMemo(() => {
    let filtered = flights;

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = flights.filter(
        (f) =>
          f.callsign.toLowerCase().includes(q) ||
          f.flightId.toLowerCase().includes(q) ||
          (f.aircraftType ?? '').toLowerCase().includes(q) ||
          f.origin.toLowerCase().includes(q) ||
          f.destination.toLowerCase().includes(q) ||
          f.status.toLowerCase().includes(q)
      );
    }

    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [flights, search, sortKey, sortDir]);

  // Column definitions
  const columns: { key: SortKey; label: string; align?: string }[] = [
    { key: 'flightId', label: 'Flight' },
  { key: 'aircraftType', label: 'Aircraft' },
    { key: 'origin', label: 'Origin' },
    { key: 'destination', label: 'Destination' },
    { key: 'altitude', label: 'Altitude (ft)', align: 'right' },
    { key: 'speed', label: 'Speed (kts)', align: 'right' },
    { key: 'heading', label: 'Heading (°)', align: 'right' },
    { key: 'status', label: 'Status' },
    { key: 'progress', label: 'Progress' },
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
          <div className="p-2 bg-aviation-blue/10 rounded-lg border border-aviation-blue/20">
            <Plane className="w-4 h-4 text-aviation-blue" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Flight Data Table</h2>
            <p className="text-[10px] text-gray-500 font-mono">
              {isConnecting ? 'Connecting to data feed…' : `${displayFlights.length} of ${flights.length} flights`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/60 border border-gray-700/40 rounded-lg">
            {isLive ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-mono text-emerald-400 uppercase">Live</span>
              </>
            ) : connectionStatus === 'connecting' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span className="text-[10px] font-mono text-amber-400 uppercase">Connecting</span>
              </>
            ) : connectionStatus === 'using-mock' ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[10px] font-mono text-purple-400 uppercase">Demo</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-red-400" />
                <span className="text-[10px] font-mono text-red-400 uppercase">Offline</span>
              </>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search flights…"
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
        <VirtualizedFlightRows
          flights={displayFlights}
          isConnecting={isConnecting}
          search={search}
          columnCount={columns.length}
          onFlightDoubleClick={onFlightDoubleClick}
          onAircraftTypeClick={onAircraftTypeClick}
        />
      </div>

      {/* Footer summary */}
      {flights.length > 0 && (
        <div className="flex-shrink-0 px-6 py-2.5 border-t border-gray-800/50 bg-slate-900/40">
          <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 uppercase tracking-wider">
            <span>
              Showing {displayFlights.length} of {flights.length} flights
            </span>
            <div className="flex items-center gap-4">
              <span>
                <Loader2 className="w-3 h-3 inline mr-1" />
                Server push: 5s
              </span>
              <span>
                Source: <span className="text-aviation-blue">WebSocket</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
});
