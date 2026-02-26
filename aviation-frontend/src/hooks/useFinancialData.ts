import { useState, useEffect, useRef } from 'react';
import type { Flight, FuelAnalyticsResponse } from '../types/flight';

// ── Default constants (fallback when API data is unavailable) ─────
const DEFAULT_FUEL_BURN_KG_HR = 2_500;
const DEFAULT_FUEL_PRICE_USD_KG = 0.82;
const DEFAULT_CO2_PER_KG_FUEL = 3.16;
const DEFAULT_TOTAL_DISTANCE_KM = 3_800;
const TICK_INTERVAL_MS = 80;

const FUEL_BURN_LOOKUP: Record<string, number> = {
  B738: 2_530, B739: 2_480, B77W: 7_500, B789: 5_800,
  A320: 2_500, A321: 2_700, A332: 5_600, A359: 5_200,
  E175: 1_350, CRJ9: 1_500, B777: 7_500,
};

export interface FinancialSnapshot {
  /** Current cumulative fuel burned (kg) — ticks up in real-time */
  fuelBurnKg: number;
  /** Current cumulative CO₂ emitted (kg) */
  co2Kg: number;
  /** Current cumulative dollar cost of fuel (USD) */
  dollarCost: number;
  /** Fuel burn rate being used (kg/hr) */
  burnRateKgHr: number;
  /** Whether this flight uses a Continuous Descent Final Approach */
  usesCDFA: boolean;
  /** Estimated total fuel for the full route (kg) */
  estimatedTotalFuelKg: number;
  /** Estimated total cost for the full route (USD) */
  estimatedTotalCostUsd: number;
  /** Whether data comes from the real analytics API */
  isLive: boolean;
  /** Aircraft type string */
  aircraftType: string;
}

/**
 * Derives real-time financial / sustainability data for a flight.
 *
 * When `apiData` is provided (from GET /api/analytics/{flight_id}),
 * those server-computed numbers become the ticker target.
 * Otherwise the hook falls back to local estimation from flight fields.
 *
 * The live-ticker animation is always active.
 */
export function useFinancialData(
  flight: Flight,
  apiData?: FuelAnalyticsResponse | null,
): FinancialSnapshot {
  const hasApi = !!apiData;

  const aircraftType = apiData?.aircraft_type ?? flight.aircraftType ?? 'N/A';

  const burnRateKgHr =
    flight.fuelBurnRateKgPerHr ??
    (aircraftType !== 'N/A' ? FUEL_BURN_LOOKUP[aircraftType] : undefined) ??
    DEFAULT_FUEL_BURN_KG_HR;

  const fuelPricePerKg = flight.fuelPricePerKg ?? DEFAULT_FUEL_PRICE_USD_KG;
  const co2Factor = flight.co2PerKgFuel ?? DEFAULT_CO2_PER_KG_FUEL;
  const totalDistKm = flight.totalDistanceKm ?? DEFAULT_TOTAL_DISTANCE_KM;
  const speedKmH = Math.max((apiData?.current_velocity_kts ?? flight.speed) * 1.852, 1);
  const totalHrs = totalDistKm / speedKmH;

  // Target values — prefer API, fall back to local estimation
  const targetFuelKg = hasApi
    ? apiData.total_fuel_kg
    : (flight.progress / 100) * totalHrs * burnRateKgHr;

  const targetCostUsd = hasApi
    ? apiData.total_cost_usd
    : targetFuelKg * fuelPricePerKg;

  const targetCo2Kg = hasApi
    ? apiData.total_co2_kg
    : targetFuelKg * co2Factor;

  // Estimated totals for the full route
  const estimatedTotalFuelKg = totalHrs * burnRateKgHr;
  const estimatedTotalCostUsd = estimatedTotalFuelKg * fuelPricePerKg;

  const usesCDFA = flight.usesCDFA ?? (flight.status === 'DESCENDING' || flight.status === 'LANDING');

  // ── Animated ticker state ──────────────────────────────────────
  const [displayFuel, setDisplayFuel] = useState(targetFuelKg);
  const [displayCost, setDisplayCost] = useState(targetCostUsd);
  const [displayCo2, setDisplayCo2] = useState(targetCo2Kg);

  const targetFuelRef = useRef(targetFuelKg);
  const targetCostRef = useRef(targetCostUsd);
  const targetCo2Ref = useRef(targetCo2Kg);
  const burnRateRef = useRef(burnRateKgHr);

  useEffect(() => { targetFuelRef.current = targetFuelKg; }, [targetFuelKg]);
  useEffect(() => { targetCostRef.current = targetCostUsd; }, [targetCostUsd]);
  useEffect(() => { targetCo2Ref.current = targetCo2Kg; }, [targetCo2Kg]);
  useEffect(() => { burnRateRef.current = burnRateKgHr; }, [burnRateKgHr]);

  // Smooth ticker animation — lerps each value toward its target
  useEffect(() => {
    let lastTick = Date.now();
    let timerId: ReturnType<typeof setTimeout>;

    function lerp(prev: number, target: number, dtSec: number, rate: number): number {
      const inc = (rate / 3600) * dtSec;
      const gap = target - prev;
      if (Math.abs(gap) < 0.01) return target;
      const step = gap > 0
        ? Math.min(gap, Math.max(inc, gap * 0.08))
        : Math.max(gap, Math.min(-inc, gap * 0.08));
      return prev + step;
    }

    function tick() {
      const now = Date.now();
      const dtSec = (now - lastTick) / 1000;
      lastTick = now;

      const rate = burnRateRef.current;
      setDisplayFuel((prev) => lerp(prev, targetFuelRef.current, dtSec, rate));
      setDisplayCost((prev) => lerp(prev, targetCostRef.current, dtSec, rate * DEFAULT_FUEL_PRICE_USD_KG));
      setDisplayCo2((prev) => lerp(prev, targetCo2Ref.current, dtSec, rate * DEFAULT_CO2_PER_KG_FUEL));

      timerId = setTimeout(tick, TICK_INTERVAL_MS);
    }

    timerId = setTimeout(tick, TICK_INTERVAL_MS);
    return () => clearTimeout(timerId);
  }, []);

  return {
    fuelBurnKg: displayFuel,
    co2Kg: displayCo2,
    dollarCost: displayCost,
    burnRateKgHr,
    usesCDFA,
    estimatedTotalFuelKg,
    estimatedTotalCostUsd,
    isLive: hasApi,
    aircraftType,
  };
}
