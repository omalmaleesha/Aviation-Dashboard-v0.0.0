export interface CockpitTheme {
  id: string;
  label: string;
  description: string;
}

export const COCKPIT_THEME_QUERY_KEY = 'theme';
export const COCKPIT_THEME_STORAGE_KEY = 'skyops-cockpit-theme';

export const COCKPIT_THEMES: CockpitTheme[] = [
  {
    id: 'midnight-radar',
    label: 'Midnight Radar',
    description: 'Default deep-blue mission control glass',
  },
  {
    id: 'neon-atc',
    label: 'Neon ATC',
    description: 'High-energy neon cyan and purple cockpit vibe',
  },
  {
    id: 'amber-avionics',
    label: 'Amber Avionics',
    description: 'Warm amber instruments like classic avionics',
  },
  {
    id: 'stealth-mono',
    label: 'Stealth Monochrome',
    description: 'Minimal grayscale tactical display aesthetic',
  },
];

export const DEFAULT_COCKPIT_THEME = COCKPIT_THEMES[0].id;

export function resolveCockpitTheme(candidate?: string | null): string {
  if (!candidate) return DEFAULT_COCKPIT_THEME;
  const normalized = candidate.trim().toLowerCase();
  const found = COCKPIT_THEMES.find((theme) => theme.id === normalized);
  return found?.id ?? DEFAULT_COCKPIT_THEME;
}
