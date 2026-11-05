import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle, type StatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';

import { useTheme } from '@/theme';

/**
 * Fija el estilo de la barra de estado mientras la pantalla está en foco.
 * Sin argumento sigue al tema (íconos oscuros en claro, claros en oscuro); una pantalla con fondo
 * propio (la cámara del escáner, el hero del inicio) puede forzar el suyo.
 * Cada pantalla declara el suyo (sin limpiar al salir): gana la que entra en foco.
 */
export function useFocusStatusBar(style?: StatusBarStyle) {
  const { colors } = useTheme();
  const resolved: StatusBarStyle = style ?? (colors.scheme === 'dark' ? 'light' : 'dark');
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(resolved);
    }, [resolved]),
  );
}
