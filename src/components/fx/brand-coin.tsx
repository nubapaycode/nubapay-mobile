import { requireOptionalNativeModule } from 'expo';
import * as Device from 'expo-device';
import type { ComponentType } from 'react';
import { Platform } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/theme';

type CoinProps = { primary: string; brand: string; ink: string; animate: boolean };

/**
 * three + expo-gl solo se cargan si el build trae el módulo nativo de GL (un build anterior no
 * lo tiene), fuera de web y en un dispositivo real: en el simulador de iOS, OpenGL ES se
 * renderiza por software, cada frame tarda segundos y traba el hilo de JS (expo-gl sincroniza
 * con él). Sin moneda, el login muestra solo el logotipo.
 */
const Coin: ComponentType<CoinProps> | null =
  Platform.OS !== 'web' && Device.isDevice && requireOptionalNativeModule('ExpoGL')
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./brand-coin.r3f').default
    : null;

export const hasBrandCoin = Coin != null;

/** Moneda de marca en 3D (gira, flota y se puede girar con el dedo). */
export function BrandCoin() {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  if (!Coin) return null;
  return (
    <Coin
      primary={colors.primary}
      brand={colors.brand}
      ink={colors.scheme === 'dark' ? '#ffffff' : '#0b1220'}
      animate={!reduceMotion}
    />
  );
}
