/**
 * Paletas claro / oscuro. Los colores de series están validados contra `surface` de cada modo
 * (banda de luminosidad, croma, separación CVD y contraste): identidad categórica en orden fijo.
 */
export type Palette = {
  scheme: 'light' | 'dark';
  canvas: string;
  canvasTranslucent: string;
  surface: string;
  raised: string;
  border: string;
  borderSubtle: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  accent: string;
  /** Lima de marca (fondos, puntos). Sobre claro no sirve como texto: usar `brandText`. */
  brand: string;
  brandText: string;
  brandMuted: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  danger: string;
  dangerMuted: string;
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  chart: {
    series: readonly [string, string, string];
    /** Escala secuencial del azul de marca (fuerte → suave): partes de un total, sin sumar tonos. */
    ramp: readonly [string, string, string];
    previous: string;
    grid: string;
    /** Cursor del gráfico y minuto actual: el dato protagonista. */
    highlight: string;
    highlightRing: string;
  };
};

export const dark: Palette = {
  scheme: 'dark',
  canvas: '#080b11',
  canvasTranslucent: 'rgba(8, 11, 17, 0.94)',
  surface: '#0e1219',
  raised: '#161b25',
  border: '#232a36',
  borderSubtle: '#1a2029',
  primary: '#0069ff',
  primaryPressed: '#0057d6',
  onPrimary: '#ffffff',
  accent: '#6cb0ff',
  brand: '#c6ff00',
  brandText: '#c6ff00',
  brandMuted: 'rgba(198, 255, 0, 0.14)',
  text: '#f5f7fa',
  textSecondary: '#9aa3b2',
  textMuted: '#636c7c',
  danger: '#ff5c5c',
  dangerMuted: 'rgba(255, 92, 92, 0.12)',
  success: '#3ddc84',
  successMuted: 'rgba(61, 220, 132, 0.12)',
  warning: '#ffb020',
  warningMuted: 'rgba(255, 176, 32, 0.12)',
  chart: {
    series: ['#3d8bff', '#78a600', '#9466ff'],
    ramp: ['#4d94ff', '#2e63b8', '#1f3d6e'],
    previous: '#4a5262',
    grid: '#1c222c',
    highlight: '#c6ff00',
    highlightRing: '#080b11',
  },
};

export const light: Palette = {
  scheme: 'light',
  canvas: '#f5f6f8',
  canvasTranslucent: 'rgba(245, 246, 248, 0.94)',
  surface: '#ffffff',
  raised: '#eef0f4',
  border: '#e2e5ea',
  borderSubtle: '#eceef2',
  primary: '#0069ff',
  primaryPressed: '#0057d6',
  onPrimary: '#ffffff',
  accent: '#0057d6',
  brand: '#9ad400',
  brandText: '#3f6a00',
  brandMuted: 'rgba(132, 196, 0, 0.16)',
  text: '#0b0f17',
  textSecondary: '#545d6b',
  textMuted: '#8a93a2',
  danger: '#d92d2d',
  dangerMuted: 'rgba(217, 45, 45, 0.1)',
  success: '#12884a',
  successMuted: 'rgba(18, 136, 74, 0.1)',
  warning: '#b86e00',
  warningMuted: 'rgba(230, 150, 0, 0.14)',
  chart: {
    series: ['#1f6fff', '#5a8500', '#8a4dff'],
    ramp: ['#0069ff', '#6aa5ff', '#bcd6ff'],
    previous: '#c3c8d0',
    grid: '#eef0f3',
    highlight: '#0069ff',
    highlightRing: '#ffffff',
  },
};
