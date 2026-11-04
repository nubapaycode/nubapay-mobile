import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle, type StatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';

/**
 * Fija el estilo de la barra de estado mientras la pantalla está en foco.
 * Cada pantalla declara el suyo (sin limpiar al salir): gana la que entra en foco.
 */
export function useFocusStatusBar(style: StatusBarStyle) {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(style);
    }, [style]),
  );
}
