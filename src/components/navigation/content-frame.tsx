import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { makeStyles } from '@/theme';

/** Ancho máximo del contenido: en un teléfono no cambia nada, en iPad/tablet queda centrado. */
export const MAX_CONTENT_WIDTH = 720;

/**
 * Centra la app en una columna de `MAX_CONTENT_WIDTH` cuando la pantalla es más ancha (iPad,
 * tablets, ventanas de Split View). Sin esto las cards y el hero se estiran a todo el ancho.
 */
export function ContentFrame({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.outer}>
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    outer: { flex: 1, alignItems: 'center', backgroundColor: c.canvas },
    inner: {
      flex: 1,
      width: '100%',
      maxWidth: MAX_CONTENT_WIDTH,
      overflow: 'hidden',
    },
  }),
);
