import { requireOptionalNativeModule } from 'expo';
import type { ComponentType } from 'react';
import { Platform } from 'react-native';

export type BlurProps = { intensity: number; tint: 'light' | 'dark'; style: object };

/**
 * expo-blur tiene código nativo: solo se carga si el build lo trae. En Android el blur pide envolver
 * el contenido en un BlurTargetView, así que ahí (y sin el módulo) es null y cada uso cae a un
 * fondo translúcido.
 */
export const BlurView: ComponentType<BlurProps> | null =
  Platform.OS === 'ios' && requireOptionalNativeModule('ExpoBlur') != null
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('expo-blur').BlurView
    : null;
