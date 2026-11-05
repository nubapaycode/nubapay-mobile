import { EventForm } from '@/components/events/event-form';
import { useFocusStatusBar } from '@/hooks/use-focus-status-bar';

/** Crear evento (POST /api/events). Al guardar queda seleccionado en el home. */
export default function NewEventScreen() {
  useFocusStatusBar();
  return <EventForm />;
}
