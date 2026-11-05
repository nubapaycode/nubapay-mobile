import { router } from 'expo-router';

/**
 * Canal entre un formulario y la hoja `/manage/combo-products`: el formulario abre la hoja con lo
 * que ya tiene elegido y recibe la selección final (ids de productos) al tocar "Listo".
 * - `combo`: solo productos simples (un combo no puede tener combos).
 * - `block`: cualquier producto (bloques de la tienda).
 */
export type PickerMode = 'combo' | 'block';
type Pending = { selected: string[]; mode: PickerMode; onDone: (ids: string[]) => void };

let pending: Pending | null = null;

export function openComboPicker(selected: string[], onDone: (ids: string[]) => void) {
  pending = { selected, mode: 'combo', onDone };
  router.push('/manage/combo-products');
}

export function openBlockProductsPicker(selected: string[], onDone: (ids: string[]) => void) {
  pending = { selected, mode: 'block', onDone };
  router.push('/manage/combo-products');
}

/** Lo que estaba elegido al abrir la hoja. */
export const comboPickerSelection = () => pending?.selected ?? [];
export const comboPickerMode = (): PickerMode => pending?.mode ?? 'combo';

export function finishComboPicker(ids: string[]) {
  pending?.onDone(ids);
  pending = null;
}
