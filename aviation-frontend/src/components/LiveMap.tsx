import { Suspense } from 'react';
import { FlightMap } from './MapContent';
import type { Flight } from '../types/flight';

function MapLoadingFallback() {
  return (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="relative inline-block p-6 bg-slate-800/60 backdrop-blur rounded-xl border border-gray-700/50">
          <div className="w-10 h-10 mx-auto border-2 border-aviation-blue border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm mt-4 font-mono tracking-wide">LOADING MAP…</p>
        </div>
      </div>
    </div>
  );
}

interface LiveMapProps {
  flights: Flight[];
}

export function LiveMap({ flights }: LiveMapProps) {
  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-gray-700/50">
      <Suspense fallback={<MapLoadingFallback />}>
        <FlightMap flights={flights} />
      </Suspense>
    </div>
  );
}
