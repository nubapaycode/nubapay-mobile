import { Canvas, Image, type SkImage } from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native';

/** Dibuja una foto (de `capture`) a su tamaño original, anclada arriba a la izquierda. */
export default function SnapshotImage({
  image,
  width,
  height,
}: {
  image: SkImage;
  width: number;
  height: number;
}) {
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image image={image} x={0} y={0} width={width} height={height} fit="fill" />
    </Canvas>
  );
}
