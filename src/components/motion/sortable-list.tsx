import * as Haptics from 'expo-haptics';
import { type ReactNode, useEffect } from 'react';
import { View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const SETTLE = { duration: 200, easing: Easing.out(Easing.cubic) };
/** Cuánto hay que mantener apretado antes de poder arrastrar (así el scroll sigue funcionando). */
const HOLD_MS = 220;

type Positions = Record<string, number>;

const indexMap = (ids: string[]): Positions => Object.fromEntries(ids.map((id, i) => [id, i]));

/**
 * Lista que se ordena arrastrando: mantené apretada una fila, se levanta (escala y sombra) con un
 * háptico, y al moverla las demás se corren a su nuevo lugar con un toque por cada salto. Al soltar
 * encaja y avisa el nuevo orden con `onReorder`. Las filas tienen alto fijo (`rowHeight`).
 *
 * Con lector de pantalla no se arrastra: cada fila trae acciones "Subir" / "Bajar" (`onMove`).
 */
export function SortableList<T extends { id: string }>({
  items,
  rowHeight,
  gap = 8,
  onReorder,
  onMove,
  label,
  renderItem,
}: {
  items: T[];
  rowHeight: number;
  gap?: number;
  onReorder: (ids: string[]) => void;
  /** Mover una posición (accesibilidad). */
  onMove: (index: number, dir: -1 | 1) => void;
  label: (item: T) => string;
  renderItem: (item: T, index: number) => ReactNode;
}) {
  const slot = rowHeight + gap;
  const ids = items.map((i) => i.id);
  const key = ids.join('|');
  const positions = useSharedValue<Positions>(indexMap(ids));
  const active = useSharedValue<string | null>(null);
  const dragY = useSharedValue(0);

  // Si el orden cambia desde afuera (acciones de accesibilidad, al guardar), se toma ese.
  useEffect(() => {
    positions.set(indexMap(key ? key.split('|') : []));
  }, [key, positions]);

  return (
    <View style={{ height: Math.max(0, items.length * slot - gap) }}>
      {items.map((item, index) => (
        <Row
          key={item.id}
          id={item.id}
          count={items.length}
          slot={slot}
          height={rowHeight}
          positions={positions}
          active={active}
          dragY={dragY}
          onDrop={onReorder}
          a11yLabel={label(item)}
          canUp={index > 0}
          canDown={index < items.length - 1}
          onA11yMove={(dir) => onMove(index, dir)}>
          {renderItem(item, index)}
        </Row>
      ))}
    </View>
  );
}

function Row({
  id,
  count,
  slot,
  height,
  positions,
  active,
  dragY,
  onDrop,
  a11yLabel,
  canUp,
  canDown,
  onA11yMove,
  children,
}: {
  id: string;
  count: number;
  slot: number;
  height: number;
  positions: SharedValue<Positions>;
  active: SharedValue<string | null>;
  dragY: SharedValue<number>;
  onDrop: (ids: string[]) => void;
  a11yLabel: string;
  canUp: boolean;
  canDown: boolean;
  onA11yMove: (dir: -1 | 1) => void;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const lift = useSharedValue(0);
  // Dónde estaba la fila al levantarla: translationY se mide desde ahí.
  const startTop = useSharedValue(0);

  const drop = (order: Positions) => {
    onDrop(Object.keys(order).sort((a, b) => order[a] - order[b]));
  };

  const pan = usePanGesture({
    activateAfterLongPress: HOLD_MS,
    onActivate: () => {
      'worklet';
      active.set(id);
      startTop.set(positions.get()[id] * slot);
      dragY.set(startTop.get());
      lift.set(withTiming(1, { duration: 160 }));
      scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Medium);
    },
    onUpdate: (e) => {
      'worklet';
      const pos = positions.get();
      const target = Math.min(Math.max(e.translationY + startTop.get(), 0), (count - 1) * slot);
      dragY.set(target);
      const to = Math.round(target / slot);
      const from = pos[id];
      if (to !== from) {
        const next: Positions = {};
        for (const k in pos) {
          const p = pos[k];
          if (k === id) next[k] = to;
          else if (from < to && p > from && p <= to) next[k] = p - 1;
          else if (from > to && p < from && p >= to) next[k] = p + 1;
          else next[k] = p;
        }
        positions.set(next);
        scheduleOnRN(Haptics.selectionAsync);
      }
    },
    onDeactivate: () => {
      'worklet';
      const order = positions.get();
      dragY.set(withTiming(order[id] * slot, SETTLE));
      lift.set(withTiming(0, { duration: 180 }));
      active.set(null);
      scheduleOnRN(drop, order);
    },
  });
  const style = useAnimatedStyle(() => {
    const dragging = active.value === id;
    const top = positions.value[id] * slot;
    return {
      top: dragging ? dragY.value : reduceMotion ? top : withTiming(top, SETTLE),
      zIndex: dragging || lift.value > 0 ? 10 : 0,
      transform: [{ scale: 1 + lift.value * 0.03 }],
      shadowOpacity: lift.value * 0.18,
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        accessible
        accessibilityLabel={a11yLabel}
        accessibilityHint="Mantené apretado y arrastrá para cambiar el orden"
        accessibilityActions={[
          ...(canUp ? [{ name: 'up', label: 'Subir' }] : []),
          ...(canDown ? [{ name: 'down', label: 'Bajar' }] : []),
        ]}
        onAccessibilityAction={(e) => onA11yMove(e.nativeEvent.actionName === 'up' ? -1 : 1)}
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            height,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowRadius: 16,
          },
          style,
        ]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
