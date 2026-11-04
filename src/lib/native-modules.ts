import { Alert } from 'react-native';

/**
 * Carga perezosa de módulos con código nativo que pueden no estar en el build instalado
 * (p. ej. un build de desarrollo generado antes de agregarlos). Importarlos arriba del archivo
 * rompe toda la ruta al cargarla; así solo falla la acción y se avisa.
 */
async function load<T>(loader: () => Promise<T>, name: string): Promise<T | null> {
  try {
    return await loader();
  } catch {
    Alert.alert(
      'Función no disponible',
      `Esta versión de la app no incluye ${name}. Actualizá la app (build nuevo) para usarla.`,
    );
    return null;
  }
}

export const loadImagePicker = () => load(() => import('expo-image-picker'), 'el acceso a fotos y cámara');
export const loadClipboard = () => load(() => import('expo-clipboard'), 'copiar al portapapeles');
