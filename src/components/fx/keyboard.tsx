import type { ComponentProps, ComponentType, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TurboModuleRegistry, View } from 'react-native';

/**
 * `react-native-keyboard-controller` tiene código nativo: si el build instalado es anterior a
 * agregarlo, se usa lo de React Native (KeyboardAvoidingView + ScrollView) para no romper nada.
 */
type KC = typeof import('react-native-keyboard-controller');
const kc: KC | null = TurboModuleRegistry.get('KeyboardController')
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('react-native-keyboard-controller') as KC)
  : null;

export const hasKeyboardController = !!kc;

/** Va en la raíz: sin él, los componentes de abajo no siguen al teclado. */
export function KeyboardProvider({ children }: { children: ReactNode }) {
  if (!kc) return <>{children}</>;
  const P = kc.KeyboardProvider;
  return <P>{children}</P>;
}

type ScrollProps = ComponentProps<typeof ScrollView> & {
  /** Espacio que queda entre el campo enfocado y el teclado. */
  bottomOffset?: number;
  /** Solo para el fallback: lo que ocupa el header nativo encima. */
  fallbackOffset?: number;
};

/**
 * ScrollView de formulario: al enfocar un campo lo lleva justo arriba del teclado, siguiendo la
 * animación del teclado cuadro a cuadro (y al arrastrar para cerrarlo, interactivo).
 */
export function KeyboardScroll({ bottomOffset = 24, fallbackOffset = 100, children, ...rest }: ScrollProps) {
  if (kc) {
    const S = kc.KeyboardAwareScrollView as unknown as ComponentType<ScrollProps>;
    return (
      <S bottomOffset={bottomOffset} {...rest}>
        {children}
      </S>
    );
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? fallbackOffset : 0}>
      <ScrollView {...rest}>{children}</ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Lo que va pegado abajo (botón de guardar): sube junto con el teclado, en el mismo cuadro.
 * `opened` corrige el margen cuando está abierto (p. ej. restar el área segura de abajo).
 */
export function KeyboardSticky({ opened = 0, children }: { opened?: number; children: ReactNode }) {
  if (!kc) return <View>{children}</View>;
  const S = kc.KeyboardStickyView;
  return <S offset={{ closed: 0, opened }}>{children}</S>;
}
