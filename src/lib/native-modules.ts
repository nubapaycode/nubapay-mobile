import { requireOptionalNativeModule } from 'expo';
import { Alert } from 'react-native';

/**
 * Carga perezosa de módulos con código nativo que pueden no estar en el build instalado
 * (p. ej. un build de desarrollo generado antes de agregarlos). Importarlos arriba del archivo
 * rompe toda la ruta al cargarla; así solo falla la acción y se avisa.
 *
 * Antes de importar se chequea que el módulo nativo exista: en desarrollo, Metro no rechaza el
 * `import()` cuando falta (loguea el error y resuelve un módulo roto), así que el try/catch solo
 * no alcanza.
 */
async function load<T>(nativeModule: string, loader: () => Promise<T>, name: string): Promise<T | null> {
  const unavailable = () => {
    Alert.alert(
      'Función no disponible',
      `Esta versión de la app no incluye ${name}. Actualizá la app (build nuevo) para usarla.`,
    );
    return null;
  };
  if (!requireOptionalNativeModule(nativeModule)) return unavailable();
  try {
    return await loader();
  } catch {
    return unavailable();
  }
}

export const loadImagePicker = () =>
  load('ExponentImagePicker', () => import('expo-image-picker'), 'el acceso a fotos y cámara');
export const loadClipboard = () => load('ExpoClipboard', () => import('expo-clipboard'), 'copiar al portapapeles');
