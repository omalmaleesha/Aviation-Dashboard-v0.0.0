import { useState } from 'react';
import { Plane, ArrowLeft, AlertTriangle, Loader2, Info } from 'lucide-react';
import type { AircraftTypeDetail } from '../types/flight';
import { useAircraftTypeDetails } from '../hooks/useAircraftTypeDetails';

interface AircraftDetailsPageProps {
  flightId: string | null;
  aircraftTypeId?: string | null;
  onBack: () => void;
}

function DetailItem({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <div className="bg-slate-900/50 border border-gray-800/50 rounded-lg px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-mono">{label}</div>
      <div className="text-sm text-gray-100 font-mono font-semibold">{value ?? '—'}</div>
    </div>
  );
}

function getWikimediaPngFallback(url?: string): string | null {
  if (!url) return null;

  const match = url.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([^?]+\.svg)(\?.*)?$/i);
  if (!match) return null;

  const path = match[1];
  const fileName = path.split('/').pop();
  if (!fileName) return null;

  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${path}/1280px-${fileName}.png`;
}

function AircraftImages({ detail }: { detail: AircraftTypeDetail }) {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [resolvedSources, setResolvedSources] = useState<Record<string, string>>({});

  const imageItems = [
    { key: 'exteriorImage', label: 'Exterior', src: detail.images?.exteriorImage },
    { key: 'interiorImage', label: 'Interior', src: detail.images?.interiorImage },
    { key: 'sideViewImage', label: 'Side View', src: detail.images?.sideViewImage },
    { key: 'cockpitImage', label: 'Cockpit', src: detail.images?.cockpitImage },
  ] as const;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {imageItems.map((img) => {
        const effectiveSrc = resolvedSources[img.key] ?? img.src;

        return (
          <div key={img.key} className="bg-slate-900/60 border border-gray-800/50 rounded-xl overflow-hidden">
            {effectiveSrc && !failedImages[img.key] ? (
              <img
                src={effectiveSrc}
                alt={`${detail.modelName} ${img.label}`}
                className="w-full h-52 object-cover"
                onError={() => {
                  const wikimediaFallback = getWikimediaPngFallback(effectiveSrc);
                  if (wikimediaFallback && wikimediaFallback !== effectiveSrc) {
                    setResolvedSources((prev) => ({ ...prev, [img.key]: wikimediaFallback }));
                    return;
                  }
                  setFailedImages((prev) => ({ ...prev, [img.key]: true }));
                }}
              />
            ) : (
              <div className="w-full h-52 flex flex-col items-center justify-center gap-1 text-gray-500 text-xs font-mono px-4 text-center">
                <div>{effectiveSrc ? 'Image failed to load' : 'No image available'}</div>
                {effectiveSrc && <div className="text-[10px] break-all text-gray-600">{effectiveSrc}</div>}
              </div>
            )}
            <div className="px-3 py-2 border-t border-gray-800/60 text-[11px] font-mono text-gray-300">{img.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export function AircraftDetailsPage({ flightId, aircraftTypeId, onBack }: AircraftDetailsPageProps) {
  const { data, isLoading, error } = useAircraftTypeDetails({
    flightId,
    aircraftTypeId,
  });

  return (
    <div className="h-full flex flex-col bg-slate-950/80 backdrop-blur-sm">
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-slate-900/70 border border-gray-800/60 hover:bg-slate-800 transition-colors"
            title="Back to flights table"
          >
            <ArrowLeft className="w-4 h-4 text-gray-300" />
          </button>
          <div className="p-2 bg-violet-500/10 rounded-lg border border-violet-500/25">
            <Plane className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Aircraft Details</h2>
            <p className="text-[11px] text-gray-500 font-mono">
              Flight: {flightId ?? '—'} {aircraftTypeId ? `• Type: ${aircraftTypeId}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 scrollbar-thin">
        {isLoading ? (
          <div className="h-full min-h-[240px] flex items-center justify-center text-gray-400 font-mono text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading aircraft details...
          </div>
        ) : error ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-amber-300 text-sm font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        ) : !data ? (
          <div className="bg-slate-900/50 border border-gray-800/50 rounded-xl px-4 py-3 text-gray-400 text-sm font-mono flex items-center gap-2">
            <Info className="w-4 h-4" />
            No aircraft detail found for this flight.
          </div>
        ) : (
          <>
            <div className="bg-slate-900/60 border border-gray-800/50 rounded-xl p-4">
              <div className="text-xl font-bold text-white">{data.modelName}</div>
              <div className="text-sm text-violet-300 font-mono mt-1">{data.typeId}</div>
              <div className="text-xs text-gray-400 font-mono mt-2">
                {data.manufacturer} • {data.category}
              </div>
            </div>

            <AircraftImages detail={data} />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <DetailItem label="Length" value={data.length} />
              <DetailItem label="Wingspan" value={data.wingspan} />
              <DetailItem label="Height" value={data.height} />
              <DetailItem label="Max Takeoff Weight" value={data.maxTakeoffWeight} />
              <DetailItem label="Passenger Capacity" value={data.passengerCapacity} />
              <DetailItem label="Crew Capacity" value={data.crewCapacity} />
              <DetailItem label="Cargo Capacity" value={data.cargoCapacity} />
              <DetailItem label="Max Speed" value={data.maxSpeed} />
              <DetailItem label="Cruise Speed" value={data.cruiseSpeed} />
              <DetailItem label="Range" value={data.range} />
              <DetailItem label="Fuel Capacity" value={data.fuelCapacity} />
              <DetailItem label="Engine Type" value={data.engineType} />
              <DetailItem label="Number Of Engines" value={data.numberOfEngines} />
              <DetailItem label="Fuel Type" value={data.fuelType} />
              <DetailItem label="Maintenance Interval" value={data.maintenanceInterval} />
              <DetailItem label="Required Runway Length" value={data.requiredRunwayLength} />
              <DetailItem label="Service Ceiling" value={data.serviceCeiling} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
