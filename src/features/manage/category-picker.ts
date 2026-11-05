import { router } from 'expo-router';

/**
 * Canal entre el formulario de producto y la hoja `/manage/category-picker`: el formulario abre la
 * hoja con la categoría actual y recibe la elegida (o la recién creada; null = sin categoría).
 */
type Pending = { current: string | null; onPick: (name: string | null) => void };

let pending: Pending | null = null;

export function openCategoryPicker(current: string | null, onPick: (name: string | null) => void) {
  pending = { current, onPick };
  router.push('/manage/category-picker');
}

/** La categoría elegida al abrir la hoja. */
export const categoryPickerCurrent = () => pending?.current ?? null;

export function finishCategoryPicker(name: string | null) {
  pending?.onPick(name);
  pending = null;
}
