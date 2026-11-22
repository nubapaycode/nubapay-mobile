import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { font } from '@/constants/theme';
import { makeStyles } from '@/theme';
import { Text } from '@/components/ui/text';

const SIZE = 52;
/** Más alta que ancha; el margen negativo la deja crecer sin agrandar la card. */
const HEIGHT = 64;
const RADIUS = 15;

/**
 * Fotos de lo que se compró, apiladas como tarjetas: adelante el primer ítem y, si hay más, el
 * segundo asoma detrás (girado y más chico, apenas visible). Con más de dos, un badge "+N" cuenta
 * el resto. Sin foto (entradas o productos sin imagen): fondo gris con un "?".
 */
export function ItemStack({ photos }: { photos: (string | null)[] }) {
  const styles = useStyles();
  const [front, back] = photos;
  const extra = photos.length - 2;
  return (
    <View style={styles.wrap} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {photos.length > 1 ? (
        <View style={[styles.tile, styles.back]}>
          <Thumb uri={back ?? null} />
        </View>
      ) : null}
      {/* La sombra va en un contenedor aparte: el recorte de la foto (overflow) la taparía. */}
      <View style={styles.frontShadow}>
        <View style={[styles.tile, styles.front]}>
          <Thumb uri={front ?? null} />
        </View>
      </View>
      {extra > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Thumb({ uri }: { uri: string | null }) {
  const styles = useStyles();
  if (uri) {
    return (
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={uri} />
    );
  }
  return <Text style={styles.empty}>?</Text>;
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    // Ancho extra a la derecha para la tarjeta de atrás.
    wrap: { width: SIZE + 8, height: HEIGHT, marginVertical: -(HEIGHT - SIZE) / 2, justifyContent: 'center' },
    tile: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: SIZE,
      height: HEIGHT,
      borderRadius: RADIUS,
      borderCurve: 'continuous',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.raised,
    },
    front: { borderWidth: 2, borderColor: c.surface },
    frontShadow: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: SIZE,
      height: HEIGHT,
      borderRadius: RADIUS,
      borderCurve: 'continuous',
      boxShadow: c.scheme === 'dark' ? '0 4px 12px rgba(0, 0, 0, 0.35)' : '0 4px 12px rgba(11, 15, 23, 0.08)',
    },
    back: {
      opacity: 0.45,
      transform: [{ translateX: 9 }, { translateY: -3 }, { rotate: '9deg' }, { scale: 0.86 }],
    },
    empty: { color: c.textMuted, fontSize: 20, ...font('medium') },
    badge: {
      position: 'absolute',
      right: -2,
      bottom: -5,
      minWidth: 24,
      height: 20,
      paddingHorizontal: 6,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.ink,
      borderWidth: 2,
      borderColor: c.surface,
    },
    badgeText: { color: c.onInk, fontSize: 11, fontVariant: ['tabular-nums'], ...font('medium') },
  }),
);
