import { MercadoPagoLogo } from '@/components/payouts/brand-logos';
import type { PaymentKey } from '@/features/dashboard/types';
import { useTheme } from '@/theme';

import { Icon, type IconName } from './icon';

const ICON: Record<Exclude<PaymentKey, 'mp'>, IconName> = { cash: 'cash', transfer: 'bank' };

/** Marca del medio de pago: logo de Mercado Pago; ícono para efectivo y transferencia. */
export function PaymentMethodIcon({ method, size = 15 }: { method: PaymentKey; size?: number }) {
  const { colors } = useTheme();
  if (method === 'mp') return <MercadoPagoLogo width={Math.round(size * 1.75)} />;
  return <Icon name={ICON[method]} size={size} color={colors.text} />;
}
