import { AppState } from 'react-native';

import { toast } from '@/components/ui/toast';
import { setQueryData } from '@/lib/query';

/** Tiempo para arrepentirse antes de que el borrado se mande de verdad. */
const UNDO_MS = 6000;
/** Si hay que salir de la pantalla de detalle, la lista se actualiza recién cuando termina la transición. */
const LEAVE_MS = 380;

type Pending = { commit: () => void };
const pending = new Set<Pending>();

// Si la app pasa a segundo plano no se pierde la intención del usuario: se confirma lo pendiente.
AppState.addEventListener('change', (state) => {
  if (state === 'active') return;
  [...pending].forEach((p) => p.commit());
});

type Options<T> = {
  /** Clave del cache de la lista de la que sale el ítem (la lista se actualiza al instante). */
  queryKey: string;
  /** Qué ítem de la lista se borra. */
  match: (item: T) => boolean;
  /** Lo que se le avisa a la persona: "Categoría eliminada", "Ana salió del equipo"… */
  title: string;
  message?: string;
  /** La llamada real al backend; se corre pasado el tiempo de "Deshacer". */
  commit: () => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Para pantallas de detalle: volver a la lista antes de ocultar el ítem. */
  leave?: () => void;
  /** Texto del error si el backend lo rechaza (el ítem vuelve a la lista). */
  errorTitle: string;
};

/**
 * Borrado con "Deshacer" en vez de diálogo de confirmación: el ítem desaparece de inmediato, un
 * aviso ofrece deshacerlo durante unos segundos y recién entonces se manda el borrado. Si el
 * backend lo rechaza, el ítem vuelve y se explica por qué.
 */
export function undoableDelete<T>(o: Options<T>) {
  let snapshot: T[] | null = null;
  let hidden = false;
  let done = false;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let commitTimer: ReturnType<typeof setTimeout> | undefined;

  const restore = () => {
    if (!hidden) return;
    const prev = snapshot;
    setQueryData<T[]>(o.queryKey, () => prev);
  };

  const entry: Pending = {
    commit: async () => {
      if (done) return;
      done = true;
      pending.delete(entry);
      clearTimeout(hideTimer);
      clearTimeout(commitTimer);
      const res = await o.commit();
      if (!res.ok) {
        restore();
        toast.error(o.errorTitle, res.error);
      }
    },
  };

  const hide = () => {
    setQueryData<T[]>(o.queryKey, (prev) => {
      snapshot = prev;
      return prev ? prev.filter((i) => !o.match(i)) : prev;
    });
    hidden = true;
  };

  pending.add(entry);
  if (o.leave) {
    o.leave();
    hideTimer = setTimeout(hide, LEAVE_MS);
  } else {
    hide();
  }
  commitTimer = setTimeout(entry.commit, UNDO_MS + (o.leave ? LEAVE_MS : 0));

  toast.info(o.title, o.message, {
    icon: 'trash',
    duration: UNDO_MS,
    action: {
      label: 'Deshacer',
      onPress: () => {
        if (done) return;
        done = true;
        pending.delete(entry);
        clearTimeout(hideTimer);
        clearTimeout(commitTimer);
        restore();
      },
    },
  });
}
