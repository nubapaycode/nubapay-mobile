import { formatMoney } from "@/features/dashboard/format";
import type { ProductPromotion } from "@/lib/api/organizer";

/**
 * Promoción de un producto o combo: descuento (porcentaje o monto fijo) en una franja horaria.
 *
 * El backend (routes/event_workspace.py → product-promotions) guarda solo el precio final
 * (`promo_price`), la etiqueta pública (`badge_label`) y la franja (`starts_at`/`ends_at`, UTC sin
 * zona). El tipo y el monto del descuento viajan en la etiqueta ("20% OFF" / "$ 500 OFF"), que es
 * lo que ve el comprador; al leerla se recuperan de ahí.
 */

export type PromoKind = "percent" | "fixed";

export type Promo = {
  kind: PromoKind;
  /** % (1–99) o pesos de descuento. */
  amount: number;
  /** Precio final con el descuento. */
  promoPrice: number;
  label: string;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

/** Lo que se edita en el formulario. */
export type PromoInput = {
  kind: PromoKind;
  amount: number;
  startsAt: Date;
  endsAt: Date;
};

export const promoLabel = (kind: PromoKind, amount: number) =>
  kind === "percent"
    ? `${Math.round(amount)}% OFF`
    : `${formatMoney(amount)} OFF`;

export const promoPriceFor = (price: number, kind: PromoKind, amount: number) =>
  Math.max(
    0,
    Math.round(
      kind === "percent" ? price * (1 - amount / 100) : price - amount,
    ),
  );

/** El backend devuelve UTC sin zona: se le agrega la "Z" para leerlo bien. */
const fromUtc = (s: string | null) =>
  s ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`) : null;

export function parsePromo(p: ProductPromotion, price: number): Promo {
  const promoPrice = p.promo_price ?? price;
  const pct = /^\s*(\d+(?:[.,]\d+)?)\s*%/.exec(p.badge_label);
  return {
    kind: pct ? "percent" : "fixed",
    amount: pct
      ? Number(pct[1].replace(",", "."))
      : Math.max(0, price - promoPrice),
    promoPrice,
    label: p.badge_label,
    isActive: p.is_active,
    startsAt: fromUtc(p.starts_at),
    endsAt: fromUtc(p.ends_at),
  };
}

/** Está vigente ahora (activa y dentro de la franja). */
export const promoLive = (p: Promo, now = Date.now()) =>
  p.isActive &&
  (!p.startsAt || p.startsAt.getTime() <= now) &&
  (!p.endsAt || now <= p.endsAt.getTime());

/** Ya terminó (pasó el fin de la franja). */
export const promoEnded = (p: Promo, now = Date.now()) =>
  !!p.endsAt && p.endsAt.getTime() < now;

const atTime = (base: Date, t: Date) => {
  const d = new Date(base);
  d.setHours(t.getHours(), t.getMinutes(), 0, 0);
  return d;
};
const plusDay = (d: Date) => new Date(d.getTime() + 24 * 60 * 60 * 1000);

/**
 * Franja horaria a partir de dos horas, anclada al día del evento (`anchor`): si el inicio es de
 * madrugada (antes de las 12) y anterior a la hora del evento, cae al día siguiente; si el fin es
 * antes o igual que el inicio, cruza la medianoche.
 */
export function resolveWindow(
  startTime: Date,
  endTime: Date,
  anchor: Date,
): { startsAt: Date; endsAt: Date } {
  let startsAt = atTime(anchor, startTime);
  if (startsAt < anchor && startsAt.getHours() < 12)
    startsAt = plusDay(startsAt);
  let endsAt = atTime(startsAt, endTime);
  if (endsAt <= startsAt) endsAt = plusDay(endsAt);
  return { startsAt, endsAt };
}

const timeFmt = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
});
const dayFmt = new Intl.DateTimeFormat("es-AR", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

export const formatTime = (d: Date) => timeFmt.format(d);

/** "22:00 – 01:00". */
export const formatWindowShort = (p: {
  startsAt: Date | null;
  endsAt: Date | null;
}) =>
  p.startsAt && p.endsAt
    ? `${formatTime(p.startsAt)} – ${formatTime(p.endsAt)}`
    : "Todo el evento";

/** "sáb 8 nov, 22:00 → dom 9 nov, 01:00" (el día del fin solo si cambia). */
export function formatWindowLong(startsAt: Date, endsAt: Date) {
  const sameDay = startsAt.toDateString() === endsAt.toDateString();
  return `${dayFmt.format(startsAt)}, ${formatTime(startsAt)} → ${sameDay ? "" : `${dayFmt.format(endsAt)}, `}${formatTime(endsAt)}`;
}
