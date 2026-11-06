import { Gauge, HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

import type { EventPulseProps } from './types';

/**
 * Widget de pantalla de inicio / bloqueo: lo recaudado en el período y las entradas vendidas
 * del evento elegido en la app. Se actualiza cada vez que la app carga el inicio.
 * Corre en el runtime aislado de widgets: solo componentes de @expo/ui y nada de módulo.
 */
const EventPulseWidget = (props: EventPulseProps) => {
  'widget';
  return (
    <VStack
      alignment="leading"
      spacing={4}
      modifiers={[
        containerBackground('#080b11', 'widget'),
        widgetURL('nubapaybusiness://'),
      ]}>
      <HStack spacing={6}>
        <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle('#c6ff00')]}>NUBAPAY</Text>
        <Spacer />
        <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle('#9aa3b2')]}>{props.period}</Text>
      </HStack>
      <Text
        modifiers={[
          font({ size: 12, weight: 'semibold' }),
          foregroundStyle('#9aa3b2'),
          lineLimit(1),
        ]}>
        {props.eventName}
      </Text>
      <Spacer />
      <Text
        modifiers={[
          font({ size: 26, weight: 'bold', design: 'rounded' }),
          foregroundStyle('#ffffff'),
          monospacedDigit(),
          minimumScaleFactor(0.5),
          lineLimit(1),
        ]}>
        {props.revenue}
      </Text>
      {props.ratio >= 0 ? (
        <Gauge value={props.ratio} modifiers={[foregroundStyle('#c6ff00')]} />
      ) : null}
      <HStack>
        <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle('#f5f7fa'), monospacedDigit()]}>
          {props.sold}
        </Text>
        <Spacer />
        <Text modifiers={[font({ size: 10 }), foregroundStyle('#636c7c')]}>{props.updated}</Text>
      </HStack>
    </VStack>
  );
};

export default createWidget<EventPulseProps>('EventPulse', EventPulseWidget, {
  eventName: 'Abrí Nubapay',
  revenue: '$ 0',
  revenueShort: '$0',
  period: 'Hoy',
  sold: 'Sin datos todavía',
  ratio: -1,
  orders: '',
  updated: '',
});
