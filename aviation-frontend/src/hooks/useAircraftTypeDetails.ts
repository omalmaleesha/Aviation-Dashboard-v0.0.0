import { useEffect, useState } from 'react';
import { API_BASE } from '../config';
import type { AircraftTypeDetail } from '../types/flight';

interface UseAircraftTypeDetailsArgs {
  flightId?: string | null;
  aircraftTypeId?: string | null;
}

function pickFirstString(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function toAbsoluteUrl(url: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${API_BASE}${url}`;
  return `${API_BASE}/${url}`;
}

function normalizeAircraftDetail(raw: unknown): AircraftTypeDetail {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const imagesRaw = (obj.images ?? {}) as Record<string, unknown>;

  return {
    typeId: pickFirstString(obj.typeId, obj.type_id),
    modelName: pickFirstString(obj.modelName, obj.model_name),
    manufacturer: pickFirstString(obj.manufacturer),
    category: pickFirstString(obj.category),
    length: String(obj.length ?? ''),
    wingspan: String(obj.wingspan ?? obj.wing_span ?? ''),
    height: String(obj.height ?? ''),
    maxTakeoffWeight: String(obj.maxTakeoffWeight ?? obj.max_takeoff_weight ?? ''),
    passengerCapacity: String(obj.passengerCapacity ?? obj.passenger_capacity ?? ''),
    crewCapacity: String(obj.crewCapacity ?? obj.crew_capacity ?? ''),
    cargoCapacity: String(obj.cargoCapacity ?? obj.cargo_capacity ?? ''),
    maxSpeed: String(obj.maxSpeed ?? obj.max_speed ?? ''),
    cruiseSpeed: String(obj.cruiseSpeed ?? obj.cruise_speed ?? ''),
    range: String(obj.range ?? ''),
    fuelCapacity: String(obj.fuelCapacity ?? obj.fuel_capacity ?? ''),
    engineType: pickFirstString(obj.engineType, obj.engine_type),
    numberOfEngines: String(obj.numberOfEngines ?? obj.number_of_engines ?? ''),
    fuelType: pickFirstString(obj.fuelType, obj.fuel_type),
    maintenanceInterval: String(obj.maintenanceInterval ?? obj.maintenance_interval ?? ''),
    requiredRunwayLength: String(obj.requiredRunwayLength ?? obj.required_runway_length ?? ''),
    serviceCeiling: String(obj.serviceCeiling ?? obj.service_ceiling ?? ''),
    images: {
      exteriorImage: toAbsoluteUrl(pickFirstString(imagesRaw.exteriorImage, imagesRaw.exterior_image)),
      interiorImage: toAbsoluteUrl(pickFirstString(imagesRaw.interiorImage, imagesRaw.interior_image)),
      sideViewImage: toAbsoluteUrl(pickFirstString(imagesRaw.sideViewImage, imagesRaw.side_view_image)),
      cockpitImage: toAbsoluteUrl(pickFirstString(imagesRaw.cockpitImage, imagesRaw.cockpit_image)),
    },
  };
}

export function useAircraftTypeDetails({ flightId, aircraftTypeId }: UseAircraftTypeDetailsArgs) {
  const [data, setData] = useState<AircraftTypeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const normalizedFlightId = flightId?.trim();
    const normalizedTypeId = aircraftTypeId?.trim();

    if (!normalizedFlightId && !normalizedTypeId) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchDetails = async () => {
      setIsLoading(true);
      setError(null);

      try {
        let response: Response | null = null;

        if (normalizedFlightId) {
          response = await fetch(
            `${API_BASE}/api/flights/${encodeURIComponent(normalizedFlightId)}/aircraft-type`,
            { signal: controller.signal, cache: 'no-store' },
          );
        }

        if ((!response || response.status === 404) && normalizedTypeId) {
          response = await fetch(
            `${API_BASE}/api/aircraft-types/${encodeURIComponent(normalizedTypeId)}`,
            { signal: controller.signal, cache: 'no-store' },
          );
        }

        if (!response) {
          throw new Error('No lookup input provided');
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

  const payload = await response.json();
  setData(normalizeAircraftDetail(payload));
      } catch (err) {
        if (controller.signal.aborted) return;
        setData(null);
        setError(err instanceof Error ? `Failed to load aircraft details: ${err.message}` : 'Failed to load aircraft details');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void fetchDetails();

    return () => controller.abort();
  }, [aircraftTypeId, flightId]);

  return {
    data,
    isLoading,
    error,
  };
}
