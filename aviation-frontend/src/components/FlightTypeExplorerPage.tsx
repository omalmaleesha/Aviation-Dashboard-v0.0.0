import { useMemo } from 'react';
import { Plane, Layers3, Users, Gauge, Ruler } from 'lucide-react';
import type { Flight } from '../types/flight';

interface FlightTypeExplorerPageProps {
  flights: Flight[];
}

interface TypeAggregate {
  typeId: string;
  activeFlights: number;
  avgSpeed: number;
  avgAltitude: number;
}

function fmtNumber(value: number): string {
  return Number.isFinite(value) ? Math.round(value).toLocaleString() : '0';
}

export function FlightTypeExplorerPage({ flights }: FlightTypeExplorerPageProps) {
  const aggregates = useMemo<TypeAggregate[]>(() => {
    const map = new Map<string, { count: number; speedSum: number; altitudeSum: number }>();

    for (const flight of flights) {
      const typeId = (flight.aircraftType?.trim() || 'UNKNOWN').toUpperCase();
      const row = map.get(typeId) ?? { count: 0, speedSum: 0, altitudeSum: 0 };
      row.count += 1;
      row.speedSum += flight.speed;
      row.altitudeSum += flight.altitude;
      map.set(typeId, row);
    }

    return [...map.entries()]
      .map(([typeId, row]) => ({
        typeId,
        activeFlights: row.count,
        avgSpeed: row.count ? row.speedSum / row.count : 0,
        avgAltitude: row.count ? row.altitudeSum / row.count : 0,
      }))
      .sort((a, b) => b.activeFlights - a.activeFlights);
  }, [flights]);

  const totalTypes = aggregates.length;
  const topType = aggregates[0];

  return (
    <div className="h-full flex flex-col bg-slate-950/80 backdrop-blur-sm">
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-800/50">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-violet-500/10 rounded-lg border border-violet-500/20">
            <Layers3 className="w-5 h-5 text-violet-300" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Flight Type Explorer</h2>
            <p className="text-[11px] text-gray-500 font-mono mt-0.5">Explore active aircraft types and live performance profile</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <div className="bg-slate-900/40 rounded-lg px-3 py-2 border border-gray-800/30 text-center">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider font-mono">Unique Types</div>
            <div className="text-lg font-mono font-bold text-violet-300">{fmtNumber(totalTypes)}</div>
          </div>
          <div className="bg-slate-900/40 rounded-lg px-3 py-2 border border-gray-800/30 text-center">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider font-mono">Top Type</div>
            <div className="text-lg font-mono font-bold text-cyan-300">{topType?.typeId ?? '—'}</div>
          </div>
          <div className="bg-slate-900/40 rounded-lg px-3 py-2 border border-gray-800/30 text-center">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider font-mono">Top Count</div>
            <div className="text-lg font-mono font-bold text-emerald-300">{fmtNumber(topType?.activeFlights ?? 0)}</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 scrollbar-thin">
        {aggregates.length === 0 ? (
          <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-gray-500">
            <Plane className="w-10 h-10 mb-3 text-gray-600" />
            <p className="text-sm font-mono">No aircraft type data available yet</p>
          </div>
        ) : (
          aggregates.map((row) => (
            <div
              key={row.typeId}
              className="bg-slate-900/60 backdrop-blur border border-gray-700/40 rounded-xl p-4 hover:border-violet-400/30 transition-all duration-200"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="font-mono font-bold text-white text-base">{row.typeId}</div>
                  <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">Live Fleet Profile</div>
                </div>
                <div className="px-3 py-1.5 bg-violet-500/10 border border-violet-500/30 rounded-lg text-right">
                  <div className="text-[9px] text-gray-500 uppercase font-mono">Active Flights</div>
                  <div className="font-mono font-bold text-violet-300">{fmtNumber(row.activeFlights)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="bg-slate-800/40 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider font-mono flex items-center gap-1">
                    <Users className="w-3 h-3 text-cyan-300" /> Density
                  </div>
                  <div className="font-mono font-bold text-sm text-gray-100">{fmtNumber(row.activeFlights)} active</div>
                </div>
                <div className="bg-slate-800/40 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider font-mono flex items-center gap-1">
                    <Gauge className="w-3 h-3 text-amber-300" /> Avg Speed
                  </div>
                  <div className="font-mono font-bold text-sm text-gray-100">{fmtNumber(row.avgSpeed)} kts</div>
                </div>
                <div className="bg-slate-800/40 rounded-lg px-3 py-2">
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider font-mono flex items-center gap-1">
                    <Ruler className="w-3 h-3 text-emerald-300" /> Avg Altitude
                  </div>
                  <div className="font-mono font-bold text-sm text-gray-100">{fmtNumber(row.avgAltitude)} ft</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
