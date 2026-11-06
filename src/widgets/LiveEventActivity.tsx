import { Gauge, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint,
  font,
  foregroundStyle,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

import type { EventPulseProps } from './types';

/**
 * Live Activity del evento en vivo: en la pantalla bloqueada (banner) y en la Dynamic Island
 * (compacta: ticket + recaudación corta; expandida: recaudación, aforo y pedidos).
 * La app la arranca cuando el evento entra en vivo y la actualiza con cada carga del inicio.
 */
const LiveEventActivity = (props: EventPulseProps) => {
  'widget';
  return {
    banner: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 16 }), activityBackgroundTint('#080b11')]}>
        <HStack spacing={6}>
          <Image systemName="dot.radiowaves.left.and.right" size={12} color="#c6ff00" />
          <Text modifiers={[font({ size: 12, weight: 'bold' }), foregroundStyle('#c6ff00')]}>EN VIVO</Text>
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle('#9aa3b2'), lineLimit(1)]}>
            {props.eventName}
          </Text>
        </HStack>
        <HStack alignment="bottom">
          <VStack alignment="leading" spacing={2}>
            <Text
              modifiers={[
                font({ size: 30, weight: 'bold', design: 'rounded' }),
                foregroundStyle('#ffffff'),
                monospacedDigit(),
                minimumScaleFactor(0.6),
                lineLimit(1),
              ]}>
              {props.revenue}
            </Text>
            <Text modifiers={[font({ size: 12 }), foregroundStyle('#9aa3b2')]}>
              Recaudado · {props.period} · {props.orders}
            </Text>
          </VStack>
          <Spacer />
          <VStack alignment="trailing" spacing={2}>
            <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle('#f5f7fa'), monospacedDigit()]}>
              {props.sold}
            </Text>
            <Text modifiers={[font({ size: 11 }), foregroundStyle('#636c7c')]}>entradas</Text>
          </VStack>
        </HStack>
        {props.ratio >= 0 ? <Gauge value={props.ratio} modifiers={[foregroundStyle('#c6ff00')]} /> : null}
      </VStack>
    ),
    compactLeading: <Image systemName="ticket.fill" color="#c6ff00" />,
    compactTrailing: (
      <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle('#ffffff'), monospacedDigit()]}>
        {props.revenueShort}
      </Text>
    ),
    minimal: <Image systemName="ticket.fill" color="#c6ff00" />,
    expandedLeading: (
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ size: 11 }), foregroundStyle('#9aa3b2')]}>Recaudado</Text>
        <Text
          modifiers={[
            font({ size: 20, weight: 'bold', design: 'rounded' }),
            foregroundStyle('#ffffff'),
            monospacedDigit(),
            minimumScaleFactor(0.6),
            lineLimit(1),
          ]}>
          {props.revenue}
        </Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack alignment="trailing" spacing={2}>
        <Text modifiers={[font({ size: 11 }), foregroundStyle('#9aa3b2')]}>Entradas</Text>
        <Text modifiers={[font({ size: 16, weight: 'semibold' }), foregroundStyle('#f5f7fa'), monospacedDigit()]}>
          {props.sold}
        </Text>
      </VStack>
    ),
    expandedBottom: (
      <VStack spacing={6}>
        {props.ratio >= 0 ? <Gauge value={props.ratio} modifiers={[foregroundStyle('#c6ff00')]} /> : null}
        <HStack>
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle('#9aa3b2'), lineLimit(1)]}>
            {props.eventName}
          </Text>
          <Spacer />
          <Text modifiers={[font({ size: 12 }), foregroundStyle('#636c7c')]}>{props.orders}</Text>
        </HStack>
      </VStack>
    ),
  };
};

export default createLiveActivity<EventPulseProps>('LiveEvent', LiveEventActivity);
