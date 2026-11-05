import { router } from 'expo-router';

/**
 * Canal entre el formulario de combo y la hoja `/manage/combo-products`: el formulario abre la hoja
 * con lo que ya tiene elegido y recibe la selección final (ids de productos) al tocar "Listo".
 */
type Pending = { selected: string[]; onDone: (ids: string[]) => void };

let pending: Pending | null = null;

export function openComboPicker(selected: string[], onDone: (ids: string[]) => void) {
  pending = { selected, onDone };
  router.push('/manage/combo-products');
}

/** Lo que estaba elegido al abrir la hoja. */
export const comboPickerSelection = () => pending?.selected ?? [];

export function finishComboPicker(ids: string[]) {
  pending?.onDone(ids);
  pending = null;
}
