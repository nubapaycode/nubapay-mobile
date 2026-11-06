import type { MascotMood } from '@/widgets/types';

import { formatInt, formatMoneyCompact, formatPercent } from './format';
import type { DashboardData } from './types';

/**
 * Lo que comenta la mascota en el globo de la card "Última hora": frases cortas con datos reales
 * del evento, según la pose. Se elige una distinta cada vez (ver `nextMascotLine`).
 */
export function mascotLines(data: DashboardData, mood: MascotMood): string[] {
  const { summary, insights } = data;
  const { tickets, products, peak_hour } = insights;
  const lines: string[] = [];

  if (mood === 'waiting') {
    lines.push('Cuando entre la primera venta, te aviso.');
    if (tickets.capacity) lines.push(`Hay ${formatInt(tickets.capacity)} entradas esperando dueño.`);
    return lines;
  }
  if (mood === 'slow') {
    lines.push('Está tranqui por ahora.');
    if (products.units_pending > 0) lines.push(`Buen momento para entregar los ${formatInt(products.units_pending)} pendientes.`);
  }
  if (mood === 'hot') lines.push(`¡Esto explota! ${formatInt(summary.live.orders_last_hour)} pedidos en la última hora.`);
  if (mood === 'soldout') lines.push('¡Agotaste las entradas! Ahora a disfrutar.');

  if (summary.total_revenue > 0) lines.push(`Llevás ${formatMoneyCompact(summary.total_revenue)} recaudados.`);
  if (tickets.capacity && tickets.sold > 0 && mood !== 'soldout') {
    lines.push(`Ya vendiste el ${formatPercent(tickets.sold / tickets.capacity)} del aforo.`);
  }
  if (tickets.checked_in > 0) lines.push(`Ya entraron ${formatInt(tickets.checked_in)} personas.`);
  const top = summary.top_products[0];
  if (top && top.quantity > 0) lines.push(`${top.name} es lo que más sale.`);
  if (peak_hour && peak_hour.orders > 0) lines.push(`La hora pico fue a las ${peak_hour.label}.`);
  return lines;
}

/** Cada cuánto puede hablar la mascota, como mínimo (por evento, mientras la app está abierta). */
export const MASCOT_LINE_EVERY_MS = 12 * 60_000;

const lastShown = new Map<string, { at: number; line: string }>();

/**
 * La próxima frase para este evento, o `null` si habló hace menos de MASCOT_LINE_EVERY_MS.
 * Con `force` (el usuario la tocó) ignora el límite. No repite la última que dijo y marca el
 * momento al devolver una, así el próximo comentario solo vuelve a esperar el intervalo.
 */
export function nextMascotLine(
  eventId: string,
  lines: string[],
  { now = Date.now(), force = false }: { now?: number; force?: boolean } = {},
): string | null {
  const prev = lastShown.get(eventId);
  if (!force && prev && now - prev.at < MASCOT_LINE_EVERY_MS) return null;
  const options = lines.filter((l) => l !== prev?.line);
  const pool = options.length ? options : lines;
  if (!pool.length) return null;
  const line = pool[Math.floor(Math.random() * pool.length)];
  lastShown.set(eventId, { at: now, line });
  return line;
}

/** Cuánto falta para que la mascota pueda volver a hablar en este evento (0 si ya puede). */
export function msUntilNextLine(eventId: string, now = Date.now()): number {
  const prev = lastShown.get(eventId);
  return prev ? Math.max(0, MASCOT_LINE_EVERY_MS - (now - prev.at)) : 0;
}
