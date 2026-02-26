import { AlertTriangle, Cloud, Plane, ShieldAlert, Loader2 } from 'lucide-react';
import type { Flight, MetarResponse } from '../types/flight';

interface BottomStatsBarProps {
  flights: Flight[];
  alerts: number;
  metar: MetarResponse | null;
  metarLoading: boolean;
}

export function BottomStatsBar({ flights, alerts, metar, metarLoading }: BottomStatsBarProps) {
  const delayedCount = flights.filter((f) => f.status === 'DELAYED').length;

  return (
    <div className="flex-shrink-0 bg-slate-950 border-t border-gray-800/60 px-6 py-3">
      <div className="grid grid-cols-4 gap-4">
        {/* Total Flights */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900/40 rounded-lg border border-gray-800/30">
          <Plane className="w-4 h-4 text-aviation-blue flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Total Flights</p>
            <p className="text-xl font-mono font-bold text-aviation-blue leading-tight">{flights.length}</p>
          </div>
        </div>

        {/* Geofence Alerts */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900/40 rounded-lg border border-gray-800/30">
          <ShieldAlert className="w-4 h-4 text-red-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Geofence Alerts</p>
            <p className="text-xl font-mono font-bold text-red-500 leading-tight">{alerts}</p>
          </div>
        </div>

        {/* Delayed */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900/40 rounded-lg border border-gray-800/30">
          <AlertTriangle className="w-4 h-4 text-aviation-amber flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Delayed</p>
            <p className="text-xl font-mono font-bold text-aviation-amber leading-tight">{delayedCount}</p>
          </div>
        </div>

        {/* METAR — live from API */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900/40 rounded-lg border border-gray-800/30">
          <Cloud className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
              METAR {metar?.icao ?? 'KJFK'}
            </p>
            {metarLoading ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Loader2 className="w-3 h-3 text-gray-500 animate-spin" />
                <span className="text-[11px] font-mono text-gray-500">Loading…</span>
              </div>
            ) : metar ? (
              <p className="text-[11px] font-mono text-gray-300 truncate leading-tight mt-0.5" title={metar.raw}>
                {metar.raw}
              </p>
            ) : (
              <p className="text-[11px] font-mono text-gray-500 truncate leading-tight mt-0.5">
                No data
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
