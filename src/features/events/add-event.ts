import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

/** Abre el formulario para crear un evento (POST /api/events). */
export function openAddEvent() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  router.push('/new-event');
}
