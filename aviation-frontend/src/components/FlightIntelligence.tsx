import { useState, useEffect, memo } from 'react';
import { FlightCard } from './FlightCard';
import { AnimatePresence } from 'framer-motion';
import { Radar } from 'lucide-react';
import type { Flight } from '../types/flight';
import type { ConnectionStatus } from '../hooks/useFlightData';

// ── Skeleton Loader ──────────────────────────────────────────────
function SkeletonLoader() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-slate-900/40 backdrop-blur border border-gray-700/20 rounded-xl p-4"
          style={{ animationDelay: `${i * 150}ms` }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 bg-slate-800 rounded-lg animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 bg-slate-800 rounded animate-pulse w-20" />
              <div className="h-3 bg-slate-800 rounded animate-pulse w-28" />
            </div>
            <div className="h-5 w-16 bg-slate-800 rounded-full animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="h-12 bg-slate-800 rounded-lg animate-pulse" />
            <div className="h-12 bg-slate-800 rounded-lg animate-pulse" />
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ── Connection Badge ─────────────────────────────────────────────
function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const map: Record<ConnectionStatus, { color: string; label: string }> = {
    connected:    { color: 'bg-emerald-500', label: 'LIVE' },
    connecting:   { color: 'bg-amber-500',   label: 'CONNECTING' },
    disconnected: { color: 'bg-red-500',     label: 'OFFLINE' },
    'using-mock': { color: 'bg-purple-500',  label: 'DEMO' },
  };
  const { color, label } = map[status];

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative flex h-2 w-2">
        {status === 'connected' && (
          <span className={`absolute inline-flex h-full w-full rounded-full ${color} opacity-75 animate-ping`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
      </div>
      <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">{label}</span>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────
interface FlightIntelligenceProps {
  flights: Flight[];
  connectionStatus: ConnectionStatus;
  onSelectTurnaround?: (flight: Flight) => void;
}

export const FlightIntelligence = memo(function FlightIntelligence({ flights, connectionStatus, onSelectTurnaround }: FlightIntelligenceProps) {
  const [isLoading, setIsLoading] = useState(true);

  // Simulate initial skeleton load to mimic data fetching UX
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Limit the number of flight cards rendered to prevent Chrome from choking
  // on hundreds of FinancialInsights tickers + framer-motion animations.
  const MAX_VISIBLE_CARDS = 30;
  const visibleFlights = flights.slice(0, MAX_VISIBLE_CARDS);

  // Compute stats (from all flights, not just visible)
  const statusCounts = flights.reduce<Record<string, number>>((acc, f) => {
    acc[f.status] = (acc[f.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col bg-slate-950/80 backdrop-blur-sm">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-gray-800/50">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Radar className="w-4 h-4 text-aviation-blue" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Flight Intelligence</h2>
          </div>
          <ConnectionBadge status={connectionStatus} />
        </div>
        <p className="text-[11px] text-gray-500 font-mono">
          {isLoading ? 'Fetching active flights…' : `${flights.length} active targets`}
        </p>
      </div>

      {/* Scrollable Flight List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 scrollbar-thin">
        {isLoading ? (
          <SkeletonLoader />
        ) : (
          <AnimatePresence mode="popLayout">
            {visibleFlights.map((flight) => (
              <FlightCard
                key={flight.flightId}
                flight={flight}
                onSelectTurnaround={onSelectTurnaround}
              />
            ))}
            {flights.length > MAX_VISIBLE_CARDS && (
              <div className="text-center text-[10px] text-gray-500 font-mono py-2">
                + {flights.length - MAX_VISIBLE_CARDS} more flights
              </div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Footer Stats */}
      {!isLoading && (
        <div className="flex-shrink-0 px-5 py-3 border-t border-gray-800/50">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[10px] text-gray-500 uppercase font-mono">Route</div>
              <div className="text-sm font-mono font-bold text-aviation-blue">
                {(statusCounts['EN ROUTE'] || 0) + (statusCounts['CLIMBING'] || 0)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase font-mono">Landing</div>
              <div className="text-sm font-mono font-bold text-aviation-amber">
                {(statusCounts['DESCENDING'] || 0) + (statusCounts['LANDING'] || 0)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 uppercase font-mono">Alert</div>
              <div className="text-sm font-mono font-bold text-red-400">
                {statusCounts['DELAYED'] || 0}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
