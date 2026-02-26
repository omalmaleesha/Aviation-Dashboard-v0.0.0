import { motion } from 'framer-motion';
import { DollarSign, Flame, Leaf, TrendingUp, Wifi, WifiOff } from 'lucide-react';
import type { Flight, FuelAnalyticsResponse } from '../types/flight';
import { useFinancialData } from '../hooks/useFinancialData';

// ── Helpers ──────────────────────────────────────────────────────

/** Format a number as USD currency. */
function formatUsd(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format kg with commas and 1-decimal precision. */
function formatKg(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

// ── Live Ticker Digit ────────────────────────────────────────────
/** Renders an individual digit/character that slides in when it changes. */
function TickerChar({ char, index }: { char: string; index: number }) {
  return (
    <motion.span
      key={`${index}-${char}`}
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 12, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28, mass: 0.6 }}
      className="inline-block"
    >
      {char}
    </motion.span>
  );
}

/** Renders a string as individually-animated ticker characters. */
function LiveTicker({ value, className }: { value: string; className?: string }) {
  return (
    <span className={`inline-flex font-mono tabular-nums ${className ?? ''}`}>
      {value.split('').map((ch, i) => (
        <TickerChar key={`${i}-${ch}`} char={ch} index={i} />
      ))}
    </span>
  );
}

// ── Sustainability Badge ─────────────────────────────────────────
function SustainabilityBadge({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30"
    >
      <Leaf className="w-3 h-3 text-emerald-400" />
      <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
        CDFA Active
      </span>
    </motion.div>
  );
}

// ── Main Component ───────────────────────────────────────────────
interface FinancialInsightsProps {
  flight: Flight;
  /** Real-time analytics data from GET /api/analytics/{flight_id} */
  analyticsData?: FuelAnalyticsResponse | null;
}

export function FinancialInsights({ flight, analyticsData }: FinancialInsightsProps) {
  const {
    fuelBurnKg,
    co2Kg,
    dollarCost,
    burnRateKgHr,
    usesCDFA,
    estimatedTotalFuelKg,
    estimatedTotalCostUsd,
    isLive,
    aircraftType,
  } = useFinancialData(flight, analyticsData);

  const fuelText = formatKg(fuelBurnKg);
  const co2Text = formatKg(co2Kg);
  const costText = formatUsd(dollarCost);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.35, ease: 'easeInOut' }}
      className="mt-3 border-t border-gray-700/30 pt-3"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-aviation-amber" />
          <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider">
            Financial Insights
          </span>
          {isLive ? (
            <div className="flex items-center gap-1 ml-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/25 rounded-full">
              <Wifi className="w-2.5 h-2.5 text-emerald-400" />
              <span className="text-[8px] font-mono font-bold text-emerald-400 uppercase">Live</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 ml-1 px-1.5 py-0.5 bg-gray-500/10 border border-gray-500/25 rounded-full">
              <WifiOff className="w-2.5 h-2.5 text-gray-500" />
              <span className="text-[8px] font-mono font-bold text-gray-500 uppercase">Est.</span>
            </div>
          )}
        </div>
        <SustainabilityBadge active={usesCDFA} />
      </div>

      {/* Live Ticker Cards — Fuel & CO₂ */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {/* Fuel Burn */}
        <div className="relative overflow-hidden bg-slate-800/50 rounded-lg px-3 py-2 border border-gray-700/20">
          <div className="flex items-center gap-1 mb-1">
            <Flame className="w-3 h-3 text-orange-400" />
            <span className="text-[9px] text-gray-500 uppercase tracking-wider font-mono">Fuel Burn</span>
          </div>
          <LiveTicker value={fuelText} className="text-sm font-bold text-orange-300" />
          <span className="text-[9px] text-gray-500 font-mono ml-1">kg</span>

          {/* Subtle glow pulse */}
          <motion.div
            className="absolute inset-0 rounded-lg pointer-events-none"
            animate={{ opacity: [0, 0.06, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ background: 'radial-gradient(circle at 30% 50%, #f97316, transparent 70%)' }}
          />
        </div>

        {/* CO₂ Emissions */}
        <div className="relative overflow-hidden bg-slate-800/50 rounded-lg px-3 py-2 border border-gray-700/20">
          <div className="flex items-center gap-1 mb-1">
            <Leaf className="w-3 h-3 text-emerald-400" />
            <span className="text-[9px] text-gray-500 uppercase tracking-wider font-mono">CO₂</span>
          </div>
          <LiveTicker value={co2Text} className="text-sm font-bold text-emerald-300" />
          <span className="text-[9px] text-gray-500 font-mono ml-1">kg</span>

          <motion.div
            className="absolute inset-0 rounded-lg pointer-events-none"
            animate={{ opacity: [0, 0.06, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ background: 'radial-gradient(circle at 70% 50%, #10b981, transparent 70%)' }}
          />
        </div>
      </div>

      {/* Dollar Cost — full-width highlight */}
      <div className="relative overflow-hidden bg-gradient-to-r from-aviation-blue/10 to-aviation-amber/10 rounded-lg px-3 py-2.5 border border-aviation-blue/20">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <DollarSign className="w-3 h-3 text-aviation-blue" />
              <span className="text-[9px] text-gray-500 uppercase tracking-wider font-mono">
                Flight Cost (progress)
              </span>
            </div>
            <LiveTicker value={costText} className="text-base font-extrabold text-white" />
          </div>
          <div className="text-right">
            <div className="text-[9px] text-gray-500 font-mono uppercase">Est. Total</div>
            <div className="text-xs font-mono font-bold text-gray-400">
              {formatUsd(estimatedTotalCostUsd)}
            </div>
          </div>
        </div>

        {/* Cost progress bar */}
        <div className="mt-2 w-full bg-slate-800/60 rounded-full h-1 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-aviation-blue to-aviation-amber"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((dollarCost / estimatedTotalCostUsd) * 100, 100)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Fine print — aircraft type, burn rate & totals */}
      <div className="flex items-center justify-between mt-2 text-[9px] text-gray-600 font-mono">
        <span>{aircraftType !== 'N/A' ? aircraftType : ''} {burnRateKgHr.toLocaleString()} kg/hr</span>
        <span>Est. fuel: {formatKg(estimatedTotalFuelKg)} kg</span>
      </div>
    </motion.div>
  );
}
