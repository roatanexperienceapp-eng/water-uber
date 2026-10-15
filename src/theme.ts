import { useColorScheme } from 'react-native';

/** Uber-style system: black/white/gray with one orange-red brand accent used sparingly. */
export const brand = {
  flame: '#FF4A1C',
  lagoon: '#0B8F9C',
  fishing: '#3B4A9C',
  sos: '#D92D20',
  whatsapp: '#25D366',
};

const light = {
  bg: '#FFFFFF',
  ink: '#000000',
  muted: '#6B6B6B',
  tile: '#F3F3F3',
  tile2: '#EAEAEA',
  line: '#E9E9E9',
  onInk: '#FFFFFF',
};
const dark: typeof light = {
  bg: '#000000',
  ink: '#FFFFFF',
  muted: '#A6A6A6',
  tile: '#1C1C1C',
  tile2: '#2A2A2A',
  line: '#262626',
  onInk: '#000000',
};

export type Palette = typeof light & typeof brand;

export function useTheme(): Palette {
  return { ...(useColorScheme() === 'dark' ? dark : light), ...brand };
}

export const radius = { sm: 10, md: 14, lg: 18, pill: 999 };
export const space = (n: number) => n * 4;
export const type = {
  hero: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -1 },
  h1: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.8 },
  h2: { fontSize: 20, fontWeight: '800' as const, letterSpacing: -0.5 },
  body: { fontSize: 16, fontWeight: '500' as const },
  bodyStrong: { fontSize: 16, fontWeight: '700' as const },
  small: { fontSize: 13, fontWeight: '500' as const },
  label: { fontSize: 12, fontWeight: '600' as const },
};
