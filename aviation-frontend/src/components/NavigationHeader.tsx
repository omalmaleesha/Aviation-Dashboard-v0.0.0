import { UTCClock } from './UTCClock';
import { Plane, Radio, Palette, Camera } from 'lucide-react';
import type { ConnectionStatus } from '../hooks/useFlightData';
import { COCKPIT_THEMES } from '../theme/cockpitThemes';

interface NavigationHeaderProps {
  connectionStatus: ConnectionStatus;
  activeTheme: string;
  onThemeChange: (themeId: string) => void;
  onShareSnapshot: () => void;
}

export function NavigationHeader({ connectionStatus, activeTheme, onThemeChange, onShareSnapshot }: NavigationHeaderProps) {
  const isLive = connectionStatus === 'connected';

  return (
    <header className="flex-shrink-0 bg-slate-950/90 backdrop-blur border-b border-gray-800/60 px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-aviation-blue/10 rounded-lg border border-aviation-blue/20">
            <Plane className="w-5 h-5 text-aviation-blue" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight leading-tight">SkyOps Sentinel</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Mission Control</p>
          </div>
        </div>

        {/* Center — Data Feed indicator */}
        <div className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-slate-900/50 rounded-full border border-gray-800/40">
          <Radio className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
            {connectionStatus === 'connected' ? 'Live Feed Active' :
             connectionStatus === 'connecting' ? 'Connecting…' :
             connectionStatus === 'using-mock' ? 'Demo Mode' : 'Reconnecting…'}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 bg-slate-900/50 rounded-lg border border-gray-800/40">
            <Palette className="w-3.5 h-3.5 text-violet-300" />
            <select
              value={activeTheme}
              onChange={(e) => onThemeChange(e.target.value)}
              className="bg-transparent text-[10px] uppercase tracking-wider font-mono text-gray-200 outline-none"
              title="Cockpit Theme"
            >
              {COCKPIT_THEMES.map((theme) => (
                <option key={theme.id} value={theme.id} className="bg-slate-900 text-gray-200 normal-case">
                  {theme.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onShareSnapshot}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900/55 border border-gray-800/50 rounded-lg hover:border-violet-400/40 hover:bg-slate-800/70 transition-colors"
            title="Share Snapshot"
          >
            <Camera className="w-3.5 h-3.5 text-violet-300" />
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-200 hidden sm:inline">Snapshot</span>
          </button>

          {/* UTC Clock */}
          <UTCClock />

          {/* System Health Status */}
          <div className="pl-6 border-l border-gray-800/60">
            <div className="flex items-center gap-2.5">
              <div className="relative flex h-3 w-3">
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isLive ? 'bg-emerald-400 animate-ping' : 'bg-amber-400 animate-pulse'
                }`} />
                <span className={`relative inline-flex rounded-full h-3 w-3 ${
                  isLive ? 'bg-emerald-400' : 'bg-amber-400'
                }`} />
              </div>
              <div>
                <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">System</div>
                <div className={`text-xs font-bold font-mono ${isLive ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isLive ? 'OPERATIONAL' : 'STANDBY'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
