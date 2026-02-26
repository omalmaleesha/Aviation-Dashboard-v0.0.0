import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DollarSign,
  Fuel,
  Leaf,
  Plane,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wifi,
  WifiOff,
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { FuelAnalyticsResponse } from '../types/flight';
import { useFuelSummary } from '../hooks/useFuelSummary';
import { useFuelAnalyticsAPI } from '../hooks/useFuelAnalyticsAPI';

const PAGE_SIZE = 50;

function fmtDollar(n: number) {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtKg(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}t`;
  return `${Math.round(n)} kg`;
}

function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  iconColor,
  valueColor,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: React.ElementType;
  iconColor: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-slate-800/40 rounded-lg px-3 py-2">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3 h-3 ${iconColor}`} />
        <span className="text-[9px] text-gray-500 uppercase tracking-wider font-mono">{label}</span>
      </div>
      <div className={`font-mono font-bold text-sm ${valueColor ?? 'text-gray-100'}`}>
        {value}
        {unit && <span className="text-gray-500 text-[10px] ml-0.5">{unit}</span>}
      </div>
    </div>
  );
}

function AnalyticsRow({ data }: { data: FuelAnalyticsResponse }) {
  return (
    <div className="bg-slate-900/60 backdrop-blur border border-gray-700/40 rounded-xl p-5 hover:border-aviation-blue/30 transition-all duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-aviation-blue/10 rounded-lg border border-aviation-blue/20">
            <Plane className="w-5 h-5 text-aviation-blue" />
          </div>
          <div>
            <div className="font-mono font-bold text-base text-white">{data.flight_id}</div>
            <div className="text-[10px] font-mono text-gray-500">
              {data.aircraft_type} &middot; Updated every {data.updated_every_seconds}s
            </div>
          </div>
        </div>
        <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/25 rounded-lg">
          <div className="text-[9px] text-gray-500 uppercase font-mono">Total Cost</div>
          <div className="font-mono font-black text-lg text-emerald-400">{fmtDollar(data.total_cost_usd)}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <MetricCard label="Fuel Burn" value={fmtKg(data.total_fuel_kg)} icon={Fuel} iconColor="text-amber-400" valueColor="text-amber-300" />
        <MetricCard label="CO2 Emissions" value={fmtKg(data.total_co2_kg)} icon={Leaf} iconColor="text-green-400" valueColor="text-green-300" />
        <MetricCard label="Altitude" value={data.current_altitude_ft.toLocaleString()} unit="ft" icon={TrendingUp} iconColor="text-aviation-blue" />
        <MetricCard label="Velocity" value={data.current_velocity_kts.toString()} unit="kts" icon={TrendingDown} iconColor="text-purple-400" />
      </div>
    </div>
  );
}

export function FuelAnalyticsPage() {
  const { summary, isLoading: summaryLoading, error: summaryError, refetch: refetchSummary } = useFuelSummary();
  const { page, pageLoading, error: pageError, fetchPage } = useFuelAnalyticsAPI();
  const [offset, setOffset] = useState(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    fetchPage(PAGE_SIZE, offset);
    return () => { mountedRef.current = false; };
  }, [fetchPage, offset]);

  const analytics = page?.items ?? [];
  const totalItems = page?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const isLive = !!summary || analytics.length > 0;
  const isLoading = summaryLoading && pageLoading;
  const error = summaryError || pageError;

  const handlePrev = useCallback(() => {
    setOffset((prev) => Math.max(0, prev - PAGE_SIZE));
  }, []);

  const handleNext = useCallback(() => {
    if (offset + PAGE_SIZE < totalItems) {
      setOffset((prev) => prev + PAGE_SIZE);
    }
  }, [offset, totalItems]);

  const handleRefresh = useCallback(() => {
    refetchSummary();
    fetchPage(PAGE_SIZE, offset);
  }, [refetchSummary, fetchPage, offset]);

  const totalFuelKg = summary?.total_fuel_kg ?? 0;
  const totalCo2Kg = summary?.total_co2_kg ?? 0;
  const totalCostUsd = summary?.total_cost_usd ?? 0;
  const flightCount = summary?.total_flights ?? totalItems;

  return (
    <div className="h-full flex flex-col bg-slate-950/80 backdrop-blur-sm">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-800/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Fuel &amp; Cost Analytics</h2>
              <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                Real-time fuel burn, CO2 emissions &amp; cost tracking
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {isLive ? (
                <>
                  <div className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </div>
                  <Wifi className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] font-mono text-emerald-400 uppercase">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-gray-500" />
                  <span className="text-[10px] font-mono text-gray-500 uppercase">Offline</span>
                </>
              )}
            </div>
            <button
              onClick={handleRefresh}
              className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors text-gray-400 hover:text-white"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Aggregate stats — from /api/analytics/summary (60 s) */}
        <div className="grid grid-cols-4 gap-3 mt-3">
          <div className="bg-slate-900/40 rounded-lg px-3 py-2 text-center border border-gray-800/30">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider font-mono">Flights</div>
            <div className="text-lg font-mono font-bold text-white">{flightCount}</div>
          </div>
          <div className="bg-slate-900/40 rounded-lg px-3 py-2 text-center border border-gray-800/30">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider font-mono flex items-center justify-center gap-1">
              <Fuel className="w-3 h-3 text-amber-400" /> Total Fuel
            </div>
            <div className="text-lg font-mono font-bold text-amber-300">{fmtKg(totalFuelKg)}</div>
          </div>
          <div className="bg-slate-900/40 rounded-lg px-3 py-2 text-center border border-gray-800/30">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider font-mono flex items-center justify-center gap-1">
              <Leaf className="w-3 h-3 text-green-400" /> Total CO2
            </div>
            <div className="text-lg font-mono font-bold text-green-300">{fmtKg(totalCo2Kg)}</div>
          </div>
          <div className="bg-slate-900/40 rounded-lg px-3 py-2 text-center border border-gray-800/30">
            <div className="text-[9px] text-gray-500 uppercase tracking-wider font-mono flex items-center justify-center gap-1">
              <DollarSign className="w-3 h-3 text-emerald-400" /> Total Cost
            </div>
            <div className="text-lg font-mono font-bold text-emerald-400">{fmtDollar(totalCostUsd)}</div>
          </div>
        </div>
      </div>

      {/* Body — paginated flight rows */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 scrollbar-thin">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-slate-900/40 border border-gray-700/20 rounded-xl p-5"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 bg-slate-800 rounded-lg animate-pulse" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 bg-slate-800 rounded animate-pulse w-24" />
                    <div className="h-3 bg-slate-800 rounded animate-pulse w-40" />
                  </div>
                  <div className="h-14 w-28 bg-slate-800 rounded-lg animate-pulse" />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map((j) => (
                    <div key={j} className="h-12 bg-slate-800 rounded-lg animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <AlertTriangle className="w-10 h-10 mb-3 text-amber-500" />
            <p className="text-sm font-mono">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-3 px-4 py-1.5 text-xs font-mono font-bold rounded-lg bg-aviation-blue/15 text-aviation-blue border border-aviation-blue/30 hover:bg-aviation-blue/25 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : analytics.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <BarChart3 className="w-10 h-10 mb-3 text-gray-600" />
            <p className="text-sm font-mono">No analytics data available</p>
          </div>
        ) : (
          analytics.map((a) => (
            <AnalyticsRow key={a.flight_id} data={a} />
          ))
        )}
      </div>

      {/* Pagination Footer */}
      {!isLoading && !error && totalItems > 0 && (
        <div className="flex-shrink-0 px-6 py-3 border-t border-gray-800/50 flex items-center justify-between">
          <span className="text-[11px] font-mono text-gray-500">
            Showing {offset + 1} &ndash; {Math.min(offset + PAGE_SIZE, totalItems)} of {totalItems} flights
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={offset === 0}
              className="p-1.5 rounded-lg border border-gray-700/40 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-400"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-mono text-gray-400">
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={handleNext}
              disabled={offset + PAGE_SIZE >= totalItems}
              className="p-1.5 rounded-lg border border-gray-700/40 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-400"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
