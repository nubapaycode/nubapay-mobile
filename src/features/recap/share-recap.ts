import { File, Paths } from 'expo-file-system';
import type { ComponentRef, RefObject } from 'react';
import { Platform, Share, View } from 'react-native';

import { hasSkia } from '@/components/fx/skia';

type SkiaLib = typeof import('@shopify/react-native-skia');

// Skia es nativo: solo se carga si el build lo trae (ver components/fx/skia).
const skia: SkiaLib | null = hasSkia
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('@shopify/react-native-skia') as SkiaLib)
  : null;

/**
 * Comparte la tarjeta del resumen como imagen: la captura con Skia, la guarda en caché y abre la
 * hoja de compartir de iOS. Devuelve `false` si no se pudo (sin Skia, en Android, donde `Share`
 * no manda archivos, o si falló la captura): ahí se comparte el texto.
 */
export async function shareRecapImage(ref: RefObject<ComponentRef<typeof View> | null>): Promise<boolean> {
  if (!skia || Platform.OS !== 'ios' || !ref.current) return false;
  try {
    const image = await skia.makeImageFromView(ref as Parameters<SkiaLib['makeImageFromView']>[0]);
    if (!image) return false;
    const file = new File(Paths.cache, `resumen-nubapay-${Date.now()}.png`);
    file.write(image.encodeToBytes());
    await Share.share({ url: file.uri });
    return true;
  } catch {
    return false;
  }
}
