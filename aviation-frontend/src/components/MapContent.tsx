import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-rotatedmarker';
import type { Flight } from '../types/flight';

// ── Plane SVG Icon ──────────────────────────────────────────────
function createPlaneIcon(status: string) {
  const color = status === 'DELAYED' ? '#ef4444' : status === 'LANDING' ? '#a855f7' : '#3b82f6';
  return L.divIcon({
    html: `<svg viewBox="0 0 24 24" width="28" height="28" fill="${color}" stroke="#0f172a" stroke-width="0.5" xmlns="http://www.w3.org/2000/svg"><path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
    className: '',
  });
}

// ── Rotated Marker Component ────────────────────────────────────
function RotatedPlaneMarker({ flight }: { flight: Flight }) {
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    const marker = markerRef.current;
    if (marker) {
      marker.setRotationAngle(flight.heading);
      marker.setRotationOrigin('center center');
    }
  }, [flight.heading]);

  return (
    <Marker
      ref={markerRef}
      position={[flight.latitude, flight.longitude]}
      icon={createPlaneIcon(flight.status)}
    >
      <Popup className="flight-popup" offset={[0, -14]}>
        <div style={{
          background: '#0f172a',
          color: '#e2e8f0',
          borderRadius: 8,
          padding: '12px 16px',
          minWidth: 200,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          border: '1px solid #1e293b',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#3b82f6' }}>{flight.flightId}</span>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 9999,
              background: 'rgba(59,130,246,0.15)',
              color: '#60a5fa',
            }}>{flight.status}</span>
          </div>
          <div style={{ color: '#94a3b8', marginBottom: 8 }}>{flight.origin} → {flight.destination}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>ALT</div>
              <div style={{ color: '#f8fafc', fontWeight: 600 }}>{flight.altitude.toLocaleString()} ft</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>SPD</div>
              <div style={{ color: '#f8fafc', fontWeight: 600 }}>{flight.speed} kts</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>HDG</div>
              <div style={{ color: '#f8fafc', fontWeight: 600 }}>{flight.heading}°</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>PROG</div>
              <div style={{ color: '#f8fafc', fontWeight: 600 }}>{flight.progress}%</div>
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

// ── Invalidate map size on container resize ─────────────────────
function MapResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const timeout = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(timeout);
  }, [map]);
  return null;
}

// ── Main Export ──────────────────────────────────────────────────
interface FlightMapProps {
  flights: Flight[];
}

export function FlightMap({ flights }: FlightMapProps) {
  return (
    <MapContainer
      center={[7.8731, 80.7718]}
      zoom={5}
      style={{ width: '100%', height: '100%' }}
      zoomControl={true}
      preferCanvas={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxZoom={19}
      />
      <MapResizeHandler />
      {flights.map((flight) => (
        <RotatedPlaneMarker key={flight.flightId} flight={flight} />
      ))}
    </MapContainer>
  );
}
