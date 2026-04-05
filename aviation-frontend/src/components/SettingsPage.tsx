import { useMemo, useState } from 'react';
import {
  Save,
  Settings2,
  Bell,
  Clock3,
  LayoutDashboard,
  PlaneTakeoff,
  UserRound,
  Gauge,
  RotateCcw,
  RefreshCcw,
} from 'lucide-react';
import type { SidebarView } from '../store/slices/uiSlice';
import { getStoredAuthSession } from '../auth/session';

const SETTINGS_STORAGE_KEY = 'aviation_dashboard_settings';

interface AppSettings {
  profileFullName: string;
  profileRole: string;
  profileTimezone: string;
  profileContactNumber: string;
  enableCriticalAlertSound: boolean;
  enableEmailAlerts: boolean;
  showOfflineWarning: boolean;
  highlightHighRiskTurnarounds: boolean;
  autoRefreshSeconds: number;
  defaultLandingView: Exclude<SidebarView, 'aircraft-details'>;
  defaultAirportIcao: string;
  preferredUnits: 'metric' | 'imperial';
  mapAutoFocusSelectedFlight: boolean;
  defaultReplayOffsetSeconds: number;
  replayAutoplayEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  profileFullName: '',
  profileRole: 'Operations Controller',
  profileTimezone: 'UTC',
  profileContactNumber: '',
  enableCriticalAlertSound: true,
  enableEmailAlerts: false,
  showOfflineWarning: true,
  highlightHighRiskTurnarounds: true,
  autoRefreshSeconds: 5,
  defaultLandingView: 'map',
  defaultAirportIcao: 'KJFK',
  preferredUnits: 'metric',
  mapAutoFocusSelectedFlight: true,
  defaultReplayOffsetSeconds: 0,
  replayAutoplayEnabled: false,
};

function loadInitialSettings(): AppSettings {
  const session = getStoredAuthSession();
  const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  const base: AppSettings = {
    ...DEFAULT_SETTINGS,
    profileFullName: session?.user.email.split('@')[0] ?? DEFAULT_SETTINGS.profileFullName,
  };

  if (!raw) return base;

  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...base,
      ...parsed,
      defaultAirportIcao: (parsed.defaultAirportIcao ?? base.defaultAirportIcao)
        .toUpperCase()
        .slice(0, 4),
      preferredUnits:
        parsed.preferredUnits === 'imperial' ? 'imperial' : 'metric',
      defaultReplayOffsetSeconds:
        parsed.defaultReplayOffsetSeconds === -900 ||
        parsed.defaultReplayOffsetSeconds === -600 ||
        parsed.defaultReplayOffsetSeconds === -300 ||
        parsed.defaultReplayOffsetSeconds === 0
          ? parsed.defaultReplayOffsetSeconds
          : base.defaultReplayOffsetSeconds,
    };
  } catch {
    return base;
  }
}

export function SettingsPage() {
  const session = getStoredAuthSession();
  const [settings, setSettings] = useState<AppSettings>(() => loadInitialSettings());
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const canSave = useMemo(
    () => settings.defaultAirportIcao.length === 4 && settings.profileFullName.trim().length >= 2,
    [settings.defaultAirportIcao, settings.profileFullName],
  );

  const saveSettings = () => {
    if (!canSave) return;
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    setSavedMessage('Settings saved locally. Backend sync can be enabled with /api/settings endpoints.');
    window.setTimeout(() => setSavedMessage(null), 2800);
  };

  const resetSettings = () => {
    const reset = {
      ...DEFAULT_SETTINGS,
      profileFullName: session?.user.email.split('@')[0] ?? DEFAULT_SETTINGS.profileFullName,
    };
    setSettings(reset);
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(reset));
    setSavedMessage('Settings reset to defaults.');
    window.setTimeout(() => setSavedMessage(null), 2400);
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-950/80 px-6 py-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="rounded-xl border border-gray-800/60 bg-slate-900/60 p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg border border-aviation-blue/30 bg-aviation-blue/10 flex items-center justify-center">
              <Settings2 className="w-5 h-5 text-aviation-blue" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">Settings</h2>
              <p className="text-[11px] font-mono text-gray-400 mt-0.5">
                Configure profile, cockpit behavior, operations preferences, and startup defaults.
              </p>
            </div>
          </div>
        </div>

        <section className="rounded-xl border border-gray-800/60 bg-slate-900/60 p-5">
          <div className="flex items-center gap-2 mb-4 text-white">
            <UserRound className="w-4 h-4 text-blue-300" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Profile Details</h3>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] font-mono text-gray-500 uppercase">Full name</span>
              <input
                type="text"
                value={settings.profileFullName}
                onChange={(e) => setSettings((prev) => ({ ...prev, profileFullName: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-slate-950/60 px-3 py-2 text-sm text-gray-100"
                placeholder="Aviation Operator"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-mono text-gray-500 uppercase">Role / team</span>
              <input
                type="text"
                value={settings.profileRole}
                onChange={(e) => setSettings((prev) => ({ ...prev, profileRole: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-slate-950/60 px-3 py-2 text-sm text-gray-100"
                placeholder="Operations Controller"
              />
            </label>

            <label className="block">
              <span className="text-[10px] font-mono text-gray-500 uppercase">Timezone</span>
              <select
                value={settings.profileTimezone}
                onChange={(e) => setSettings((prev) => ({ ...prev, profileTimezone: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-slate-950/60 px-3 py-2 text-sm text-gray-100"
              >
                <option value="UTC">UTC</option>
                <option value="Asia/Colombo">Asia/Colombo</option>
                <option value="Europe/London">Europe/London</option>
                <option value="America/New_York">America/New_York</option>
              </select>
            </label>

            <label className="block">
              <span className="text-[10px] font-mono text-gray-500 uppercase">Contact number</span>
              <input
                type="text"
                value={settings.profileContactNumber}
                onChange={(e) => setSettings((prev) => ({ ...prev, profileContactNumber: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-slate-950/60 px-3 py-2 text-sm text-gray-100"
                placeholder="+94 77 123 4567"
              />
            </label>
          </div>

          <div className="mt-3 rounded-lg border border-gray-800/70 bg-slate-950/40 p-3 text-[11px] font-mono text-gray-400">
            Signed in as <span className="text-gray-200">{session?.user.email ?? 'unknown user'}</span>
          </div>
        </section>

        <section className="rounded-xl border border-gray-800/60 bg-slate-900/60 p-5">
          <div className="flex items-center gap-2 mb-4 text-white">
            <Bell className="w-4 h-4 text-amber-300" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Alerts & Notifications</h3>
          </div>

          <div className="space-y-3">
            <label className="flex items-center justify-between rounded-lg border border-gray-800/70 bg-slate-950/40 p-3">
              <div>
                <div className="text-xs text-gray-200 font-semibold">Critical alert sound</div>
                <div className="text-[10px] font-mono text-gray-500">Play audio when critical events are received.</div>
              </div>
              <input
                type="checkbox"
                checked={settings.enableCriticalAlertSound}
                onChange={(e) => setSettings((prev) => ({ ...prev, enableCriticalAlertSound: e.target.checked }))}
                className="h-4 w-4 accent-aviation-blue"
              />
            </label>

            <label className="flex items-center justify-between rounded-lg border border-gray-800/70 bg-slate-950/40 p-3">
              <div>
                <div className="text-xs text-gray-200 font-semibold">Offline banner warnings</div>
                <div className="text-[10px] font-mono text-gray-500">Show warning UI when live feeds disconnect.</div>
              </div>
              <input
                type="checkbox"
                checked={settings.showOfflineWarning}
                onChange={(e) => setSettings((prev) => ({ ...prev, showOfflineWarning: e.target.checked }))}
                className="h-4 w-4 accent-aviation-blue"
              />
            </label>

            <label className="flex items-center justify-between rounded-lg border border-gray-800/70 bg-slate-950/40 p-3">
              <div>
                <div className="text-xs text-gray-200 font-semibold">Email alerts for critical incidents</div>
                <div className="text-[10px] font-mono text-gray-500">Send escalation emails to operator contacts.</div>
              </div>
              <input
                type="checkbox"
                checked={settings.enableEmailAlerts}
                onChange={(e) => setSettings((prev) => ({ ...prev, enableEmailAlerts: e.target.checked }))}
                className="h-4 w-4 accent-aviation-blue"
              />
            </label>

            <label className="flex items-center justify-between rounded-lg border border-gray-800/70 bg-slate-950/40 p-3">
              <div>
                <div className="text-xs text-gray-200 font-semibold">Highlight high-risk turnarounds</div>
                <div className="text-[10px] font-mono text-gray-500">Emphasize flights with delay-risk prediction.</div>
              </div>
              <input
                type="checkbox"
                checked={settings.highlightHighRiskTurnarounds}
                onChange={(e) => setSettings((prev) => ({ ...prev, highlightHighRiskTurnarounds: e.target.checked }))}
                className="h-4 w-4 accent-aviation-blue"
              />
            </label>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-800/60 bg-slate-900/60 p-5">
            <div className="flex items-center gap-2 mb-3 text-white">
              <Clock3 className="w-4 h-4 text-cyan-300" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Refresh</h3>
            </div>
            <label className="block">
              <span className="text-[10px] font-mono text-gray-500 uppercase">Auto refresh interval</span>
              <select
                value={settings.autoRefreshSeconds}
                onChange={(e) => setSettings((prev) => ({ ...prev, autoRefreshSeconds: Number(e.target.value) }))}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-slate-950/60 px-3 py-2 text-sm text-gray-100"
              >
                <option value={5}>5 seconds</option>
                <option value={10}>10 seconds</option>
                <option value={30}>30 seconds</option>
                <option value={60}>60 seconds</option>
              </select>
            </label>

            <label className="mt-3 flex items-center justify-between rounded-lg border border-gray-800/70 bg-slate-950/40 p-3">
              <div>
                <div className="text-xs text-gray-200 font-semibold">Auto-focus selected flight on map</div>
                <div className="text-[10px] font-mono text-gray-500">Center map when a flight is selected from table/intelligence.</div>
              </div>
              <input
                type="checkbox"
                checked={settings.mapAutoFocusSelectedFlight}
                onChange={(e) => setSettings((prev) => ({ ...prev, mapAutoFocusSelectedFlight: e.target.checked }))}
                className="h-4 w-4 accent-aviation-blue"
              />
            </label>
          </div>

          <div className="rounded-xl border border-gray-800/60 bg-slate-900/60 p-5">
            <div className="flex items-center gap-2 mb-3 text-white">
              <LayoutDashboard className="w-4 h-4 text-violet-300" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Default View</h3>
            </div>
            <label className="block">
              <span className="text-[10px] font-mono text-gray-500 uppercase">Landing page after login</span>
              <select
                value={settings.defaultLandingView}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    defaultLandingView: e.target.value as AppSettings['defaultLandingView'],
                  }))
                }
                className="mt-1 w-full rounded-lg border border-gray-700 bg-slate-950/60 px-3 py-2 text-sm text-gray-100"
              >
                <option value="map">Live Map</option>
                <option value="flights-table">Flights Table</option>
                <option value="alerts">Alerts</option>
                <option value="turnarounds">Turnarounds</option>
                <option value="fuel-analytics">Fuel & Cost</option>
                <option value="flighttype-explorer">Flight Types</option>
                <option value="settings">Settings</option>
              </select>
            </label>
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-800/60 bg-slate-900/60 p-5">
            <div className="flex items-center gap-2 mb-3 text-white">
              <PlaneTakeoff className="w-4 h-4 text-emerald-300" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Operations</h3>
            </div>
            <label className="block">
              <span className="text-[10px] font-mono text-gray-500 uppercase">Default METAR ICAO</span>
              <input
                type="text"
                value={settings.defaultAirportIcao}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    defaultAirportIcao: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4),
                  }))
                }
                className="mt-1 w-full rounded-lg border border-gray-700 bg-slate-950/60 px-3 py-2 text-sm text-gray-100"
                placeholder="KJFK"
              />
              <span className="mt-1 block text-[10px] font-mono text-gray-500">Must be a 4-letter ICAO code.</span>
            </label>

            <label className="block mt-3">
              <span className="text-[10px] font-mono text-gray-500 uppercase">Preferred units</span>
              <select
                value={settings.preferredUnits}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    preferredUnits: e.target.value === 'imperial' ? 'imperial' : 'metric',
                  }))
                }
                className="mt-1 w-full rounded-lg border border-gray-700 bg-slate-950/60 px-3 py-2 text-sm text-gray-100"
              >
                <option value="metric">Metric (kg, km, °C)</option>
                <option value="imperial">Imperial (lb, mi, °F)</option>
              </select>
            </label>
          </div>

          <div className="rounded-xl border border-gray-800/60 bg-slate-900/60 p-5">
            <div className="flex items-center gap-2 mb-3 text-white">
              <Gauge className="w-4 h-4 text-fuchsia-300" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Replay Defaults</h3>
            </div>
            <label className="block">
              <span className="text-[10px] font-mono text-gray-500 uppercase">Initial replay offset</span>
              <select
                value={settings.defaultReplayOffsetSeconds}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, defaultReplayOffsetSeconds: Number(e.target.value) }))
                }
                className="mt-1 w-full rounded-lg border border-gray-700 bg-slate-950/60 px-3 py-2 text-sm text-gray-100"
              >
                <option value={0}>Live (0s)</option>
                <option value={-300}>-5 minutes</option>
                <option value={-600}>-10 minutes</option>
                <option value={-900}>-15 minutes</option>
              </select>
            </label>

            <label className="mt-3 flex items-center justify-between rounded-lg border border-gray-800/70 bg-slate-950/40 p-3">
              <div>
                <div className="text-xs text-gray-200 font-semibold">Autoplay replay when opened</div>
                <div className="text-[10px] font-mono text-gray-500">Automatically step through snapshots in replay mode.</div>
              </div>
              <input
                type="checkbox"
                checked={settings.replayAutoplayEnabled}
                onChange={(e) => setSettings((prev) => ({ ...prev, replayAutoplayEnabled: e.target.checked }))}
                className="h-4 w-4 accent-aviation-blue"
              />
            </label>
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!canSave}
            onClick={saveSettings}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold bg-aviation-blue text-slate-950 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" /> Save settings
          </button>
          <button
            type="button"
            onClick={resetSettings}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold border border-gray-700 text-gray-200 hover:bg-slate-800/60"
          >
            <RefreshCcw className="w-4 h-4" /> Reset defaults
          </button>
          {savedMessage && <p className="text-[11px] font-mono text-emerald-300">{savedMessage}</p>}
          {!canSave && (
            <p className="text-[11px] font-mono text-amber-300">
              Enter valid profile name (2+ chars) and a 4-letter ICAO code.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-dashed border-gray-700/70 bg-slate-900/40 p-4">
          <div className="flex items-center gap-2 text-gray-200">
            <RotateCcw className="w-4 h-4 text-sky-300" />
            <h4 className="text-xs font-bold uppercase tracking-wider">Backend sync note</h4>
          </div>
          <p className="mt-1 text-[11px] font-mono text-gray-400">
            These settings are currently local. To share across devices, persist to backend using authenticated
            user-scoped settings endpoints.
          </p>
        </div>
      </div>
    </div>
  );
}
