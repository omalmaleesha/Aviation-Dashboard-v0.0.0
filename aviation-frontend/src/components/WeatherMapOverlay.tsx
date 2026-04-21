import { useMemo, useState } from 'react';
import { Cloud, CloudRain, Gauge, Loader2, Wind } from 'lucide-react';

export type WeatherLayer = 'wind' | 'rain' | 'clouds' | 'pressure';

interface WeatherMapOverlayProps {
  lat: number;
  lon: number;
  zoom: number;
  selectedLayer: WeatherLayer;
}

const layerIcon = {
  wind: Wind,
  rain: CloudRain,
  clouds: Cloud,
  pressure: Gauge,
} as const;

export function WeatherMapOverlay({ lat, lon, zoom, selectedLayer }: WeatherMapOverlayProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  const embedUrl = useMemo(() => {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lon),
      zoom: String(zoom),
      level: 'surface',
      overlay: selectedLayer,
    });
    return `https://embed.windy.com/embed2.html?${params.toString()}`;
  }, [lat, lon, zoom, selectedLayer]);

  const LayerIcon = layerIcon[selectedLayer];

  return (
    <div className="h-full w-full rounded-xl border border-slate-700/70 bg-slate-950/70 backdrop-blur overflow-hidden">
      <div className="h-10 px-3 border-b border-slate-700/70 flex items-center justify-between bg-slate-900/80">
        <div>
          <p className="text-[10px] uppercase tracking-wider font-mono text-slate-500">Weather Impact View</p>
        </div>
        <div className="inline-flex items-center gap-1.5 text-xs text-cyan-300 capitalize">
          <LayerIcon className="w-3.5 h-3.5" />
          {selectedLayer}
        </div>
      </div>

      <div className="relative h-[calc(100%-40px)]">
        {!isLoaded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/70">
            <div className="inline-flex items-center gap-2 text-xs text-slate-300 font-mono">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading weather layer…
            </div>
          </div>
        )}

        <iframe
          key={embedUrl}
          title="Windy Weather Layer"
          src={embedUrl}
          loading="lazy"
          className="h-full w-full"
          onLoad={() => setIsLoaded(true)}
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}
