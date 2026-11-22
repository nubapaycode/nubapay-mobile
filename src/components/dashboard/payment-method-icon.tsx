import { Image } from 'expo-image';

import { MercadoPagoLogo } from '@/components/payouts/brand-logos';
import type { PaymentKey } from '@/features/dashboard/types';
import { useTheme } from '@/theme';

import { Icon, type IconName } from './icon';

const ICON: Record<'cash' | 'transfer', IconName> = { cash: 'cash', transfer: 'bank' };

/** Logos cuadrados (los mismos que usa nubapay-frontend en public/images). */
const LOGO: Record<'sipago' | 'mobbex', number> = {
  sipago: require('@/assets/images/payments/sipago.png'),
  mobbex: require('@/assets/images/payments/mobbex.png'),
};

/**
 * Marca del medio de pago: logo de Mercado Pago, Sipago y Mobbex; ícono para efectivo y
 * transferencia (y tarjeta si llega uno desconocido).
 */
export function PaymentMethodIcon({ method, size = 15 }: { method: PaymentKey; size?: number }) {
  const { colors } = useTheme();
  if (method === 'mp') return <MercadoPagoLogo width={Math.round(size * 1.75)} />;
  if (method === 'sipago' || method === 'mobbex') {
    const side = Math.round(size * 1.6);
    return (
      <Image
        source={LOGO[method]}
        style={{ width: side, height: side, borderRadius: side * 0.28 }}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return <Icon name={ICON[method] ?? 'card'} size={size} color={colors.text} />;
}
