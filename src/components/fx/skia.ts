import { Platform, TurboModuleRegistry } from 'react-native';

/**
 * Skia tiene código nativo: un build instalado antes de agregarlo no lo trae, e importarlo arriba
 * de un archivo rompería la pantalla entera. Los efectos con Skia se cargan solo si el módulo
 * existe; si no, cada uno cae a su versión sin Skia (o no se muestra).
 * En web Skia necesita CanvasKit, que no se carga: ahí también se usa el fallback.
 */
export const hasSkia = Platform.OS !== 'web' && TurboModuleRegistry.get('RNSkiaModule') != null;
