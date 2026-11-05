import {
  type ComponentRef,
  type ComponentType,
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { FullWindowOverlay } from 'react-native-screens';

import { type AppearancePreference, useTheme } from '@/theme';

import { hasSkia } from './skia';

type Origin = { x: number; y: number };
type ViewRef = RefObject<ComponentRef<typeof View> | null>;
type Img = unknown;
type SkiaReveal = {
  capture: (ref: ViewRef) => Promise<Img | null>;
  default: ComponentType<{
    layers: Img[];
    origin: Origin;
    onCovered: () => void;
    onDone: () => void;
  }>;
};

// Solo con Skia en el build (ver ./skia); si no, el tema cambia sin transición.
const skia: SkiaReveal | null = hasSkia
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./theme-reveal.skia')
  : null;

type RevealApi = {
  /** Cambia la apariencia; con `origin` el tema nuevo se revela en círculo desde ese punto. */
  reveal: (pref: AppearancePreference, origin?: Origin) => void;
  /** Vistas a pantalla completa fuera de la raíz (modales en iOS) que entran en la foto. */
  register: (ref: ViewRef) => () => void;
};

const RevealContext = createContext<RevealApi | null>(null);

export function useThemeReveal(): RevealApi['reveal'] {
  const ctx = useContext(RevealContext);
  const { setPreference } = useTheme();
  return ctx?.reveal ?? setPreference;
}

/**
 * Registra una vista que se presenta por encima de la raíz (p. ej. una hoja en `transparentModal`):
 * en iOS va en otro view controller y la foto de la raíz no la incluye.
 */
export function useRevealSurface(ref: ViewRef) {
  const ctx = useContext(RevealContext);
  useEffect(() => ctx?.register(ref), [ctx, ref]);
}

/**
 * Transición de tema con revelado circular: se saca una foto de la pantalla, se la pone encima,
 * se cambia el tema por debajo y se abre un círculo que crece desde donde se tocó.
 */
export function ThemeReveal({ children }: { children: ReactNode }) {
  const { colors, setPreference } = useTheme();
  const system = useColorScheme();
  const reduceMotion = useReducedMotion();
  const root = useRef<ComponentRef<typeof View>>(null);
  const surfaces = useRef(new Set<ViewRef>());
  const busy = useRef(false);
  const [shot, setShot] = useState<{ layers: Img[]; origin: Origin; pref: AppearancePreference } | null>(
    null,
  );

  const register = useCallback((ref: ViewRef) => {
    surfaces.current.add(ref);
    return () => {
      surfaces.current.delete(ref);
    };
  }, []);

  const reveal = useCallback(
    async (pref: AppearancePreference, origin?: Origin) => {
      const next = pref === 'system' ? (system ?? 'light') : pref;
      if (!skia || reduceMotion || !origin || next === colors.scheme || busy.current) {
        setPreference(pref);
        return;
      }
      busy.current = true;
      const base = await skia.capture(root);
      // En Android los modales viven dentro de la raíz: ya salen en la primera foto.
      const extra =
        Platform.OS === 'ios'
          ? await Promise.all([...surfaces.current].map((ref) => skia.capture(ref)))
          : [];
      const layers = [base, ...extra].filter((img): img is NonNullable<typeof img> => img != null);
      if (!base) {
        busy.current = false;
        setPreference(pref);
        return;
      }
      setShot({ layers, origin, pref });
    },
    [system, reduceMotion, colors.scheme, setPreference],
  );

  const api = useMemo(() => ({ reveal, register }), [reveal, register]);
  const Overlay = skia?.default;

  const overlay =
    shot && Overlay ? (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Overlay
          layers={shot.layers}
          origin={shot.origin}
          onCovered={() => setPreference(shot.pref)}
          onDone={() => {
            busy.current = false;
            setShot(null);
          }}
        />
      </View>
    ) : null;

  return (
    <RevealContext.Provider value={api}>
      <View ref={root} collapsable={false} style={styles.fill}>
        {children}
      </View>
      {overlay && Platform.OS === 'ios' ? <FullWindowOverlay>{overlay}</FullWindowOverlay> : overlay}
    </RevealContext.Provider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
