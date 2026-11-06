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
 * Live Activity del evento en vivo, adaptada a lo que vende:
 * - pantalla bloqueada: recaudación grande, el dato principal (entradas o productos) a la
 *   derecha, la barra de aforo si hay entradas con tope, y abajo última hora + segundo dato;
 * - Dynamic Island compacta: ícono según lo que vende + recaudación corta;
 * - expandida: recaudación, dato principal y, abajo, barra + última hora + segundo dato.
 */
const LiveEventActivity = (props: EventPulseProps) => {
  'widget';
  return {
    banner: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 16 }), activityBackgroundTint('#080b11')]}>
        <HStack spacing={6}>
          <Image systemName={props.icon} size={12} color="#c6ff00" />
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
            <Text modifiers={[font({ size: 12 }), foregroundStyle('#9aa3b2')]}>Recaudado · {props.orders}</Text>
          </VStack>
          <Spacer />
          <VStack alignment="trailing" spacing={2}>
            <Text
              modifiers={[
                font({ size: 17, weight: 'semibold' }),
                foregroundStyle('#f5f7fa'),
                monospacedDigit(),
                lineLimit(1),
              ]}>
              {props.mainValue}
            </Text>
            <Text modifiers={[font({ size: 11 }), foregroundStyle('#636c7c')]}>{props.mainLabel}</Text>
          </VStack>
        </HStack>
        {props.ratio >= 0 ? <Gauge value={props.ratio} modifiers={[foregroundStyle('#c6ff00')]} /> : null}
        <HStack>
          <Text modifiers={[font({ size: 12 }), foregroundStyle('#9aa3b2')]}>{props.paceLabel} </Text>
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle('#c6ff00'), monospacedDigit()]}>
            {props.paceValue}
          </Text>
          <Spacer />
          <Text modifiers={[font({ size: 12 }), foregroundStyle('#9aa3b2')]}>{props.extraLabel} </Text>
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle('#f5f7fa'), monospacedDigit()]}>
            {props.extraValue}
          </Text>
        </HStack>
      </VStack>
    ),
    compactLeading: <Image systemName={props.icon} color="#c6ff00" />,
    compactTrailing: (
      <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle('#ffffff'), monospacedDigit()]}>
        {props.revenueShort}
      </Text>
    ),
    minimal: <Image systemName={props.icon} color="#c6ff00" />,
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
        <Text modifiers={[font({ size: 11 }), foregroundStyle('#9aa3b2')]}>{props.mainLabel}</Text>
        <Text modifiers={[font({ size: 16, weight: 'semibold' }), foregroundStyle('#f5f7fa'), monospacedDigit()]}>
          {props.mainValue}
        </Text>
      </VStack>
    ),
    expandedBottom: (
      <VStack spacing={6}>
        {props.ratio >= 0 ? <Gauge value={props.ratio} modifiers={[foregroundStyle('#c6ff00')]} /> : null}
        <HStack>
          <Text modifiers={[font({ size: 12 }), foregroundStyle('#9aa3b2')]}>{props.paceLabel} </Text>
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle('#c6ff00'), monospacedDigit()]}>
            {props.paceValue}
          </Text>
          <Spacer />
          <Text modifiers={[font({ size: 12 }), foregroundStyle('#9aa3b2')]}>{props.extraLabel} </Text>
          <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle('#f5f7fa'), monospacedDigit()]}>
            {props.extraValue}
          </Text>
        </HStack>
      </VStack>
    ),
  };
};

export default createLiveActivity<EventPulseProps>('LiveEvent', LiveEventActivity);
