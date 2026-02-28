import { memo } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, TrendingUp, Plane, Timer } from 'lucide-react';
import type { Flight, FuelAnalyticsResponse } from '../types/flight';
import { STATUS_STYLES } from '../types/flight';
import { FinancialInsights } from './FinancialInsights';

interface FlightCardProps {
  flight: Flight;
  onSelectTurnaround?: (flight: Flight) => void;
  /** Real-time analytics from GET /api/analytics (optional) */
  analyticsData?: FuelAnalyticsResponse | null;
}

export const FlightCard = memo(function FlightCard({ flight, onSelectTurnaround, analyticsData }: FlightCardProps) {
  const { flightId, origin, destination, status, progress, altitude, speed, heading } = flight;
  const style = STATUS_STYLES[status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="group bg-slate-900/60 backdrop-blur-md border border-gray-700/40 rounded-xl p-4 hover:border-aviation-blue/30 transition-all duration-200"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-aviation-blue/10 rounded-lg">
            <Plane className="w-4 h-4 text-aviation-blue" style={{ transform: `rotate(${heading - 90}deg)` }} />
          </div>
          <div>
            <div className="font-mono font-bold text-white text-base leading-tight">{flightId}</div>
            <div className="text-[11px] text-gray-500 font-mono">{origin} → {destination}</div>
          </div>
        </div>
        <motion.span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${style.bg} ${style.text} ${style.border}`}
          animate={
            status === 'DELAYED'
              ? { opacity: [1, 0.5, 1] }
              : {}
          }
          transition={
            status === 'DELAYED'
              ? { duration: 1.2, repeat: Infinity }
              : {}
          }
        >
          {status}
        </motion.span>
      </div>

      {/* Data Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-slate-800/40 rounded-lg px-3 py-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">ALT</div>
          <div className="font-mono font-bold text-sm text-gray-100">{altitude.toLocaleString()} <span className="text-gray-500 text-[10px]">ft</span></div>
        </div>
        <div className="bg-slate-800/40 rounded-lg px-3 py-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">SPD</div>
          <div className="font-mono font-bold text-sm text-gray-100">{speed} <span className="text-gray-500 text-[10px]">kts</span></div>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Progress</span>
          <span className="text-[11px] font-mono font-bold text-aviation-blue">{progress}%</span>
        </div>
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-aviation-blue to-aviation-amber"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 text-[10px] text-gray-500">
        <div className="flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          <span className="font-mono">HDG {heading}°</span>
        </div>
        <div className="flex items-center gap-2">
          {(status === 'LANDING' || status === 'LANDED') && onSelectTurnaround && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectTurnaround(flight);
              }}
              className="flex items-center gap-1 px-2 py-0.5 bg-aviation-blue/10 border border-aviation-blue/30 rounded-full hover:bg-aviation-blue/20 transition-colors text-aviation-blue"
            >
              <Timer className="w-3 h-3" />
              <span className="font-mono font-bold uppercase">Turnaround</span>
            </button>
          )}
          {status === 'DELAYED' && (
            <div className="flex items-center gap-1 text-red-400">
              <AlertCircle className="w-3 h-3" />
              <span className="font-mono">ATTN</span>
            </div>
          )}
        </div>
      </div>

      {/* Financial Insights — live ticker, sustainability badge, dollar cost */}
      <FinancialInsights flight={flight} analyticsData={analyticsData} />
    </motion.div>
  );
});
