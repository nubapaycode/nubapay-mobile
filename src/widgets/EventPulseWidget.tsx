import { Gauge, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
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

import { EMPTY_PULSE, type EventPulseProps } from './types';

/**
 * Widget de pantalla de inicio: lo recaudado en el evento elegido en la app y, abajo, el dato
 * principal según lo que vende (entradas o productos) junto con lo vendido en la última hora.
 * Corre en el runtime aislado de widgets: solo componentes de @expo/ui y nada de módulo.
 */
const EventPulseWidget = (props: EventPulseProps) => {
  'widget';
  return (
    <VStack
      alignment="leading"
      spacing={4}
      modifiers={[containerBackground('#080b11', 'widget'), widgetURL('nubapaybusiness://')]}>
      <HStack spacing={5}>
        <Image assetName="NubapayCloud" />
        <Text
          modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle('#9aa3b2'), lineLimit(1)]}>
          {props.eventName}
        </Text>
      </HStack>
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
      <Text modifiers={[font({ size: 10 }), foregroundStyle('#636c7c'), lineLimit(1)]}>
        {props.orders} · {props.updated}
      </Text>
      {props.ratio >= 0 ? <Gauge value={props.ratio} modifiers={[foregroundStyle('#c6ff00')]} /> : null}
      <HStack alignment="top">
        <VStack alignment="leading" spacing={1}>
          <Text modifiers={[font({ size: 9, weight: 'medium' }), foregroundStyle('#9aa3b2')]}>
            {props.mainLabel}
          </Text>
          <Text
            modifiers={[
              font({ size: 13, weight: 'semibold' }),
              foregroundStyle('#f5f7fa'),
              monospacedDigit(),
              minimumScaleFactor(0.7),
              lineLimit(1),
            ]}>
            {props.mainValue}
          </Text>
        </VStack>
        <Spacer />
        <VStack alignment="trailing" spacing={1}>
          <Text modifiers={[font({ size: 9, weight: 'medium' }), foregroundStyle('#9aa3b2')]}>
            {props.paceLabel}
          </Text>
          <Text
            modifiers={[
              font({ size: 13, weight: 'semibold' }),
              foregroundStyle('#c6ff00'),
              monospacedDigit(),
              lineLimit(1),
            ]}>
            {props.paceValue}
          </Text>
        </VStack>
      </HStack>
    </VStack>
  );
};

export default createWidget<EventPulseProps>('EventPulse', EventPulseWidget, EMPTY_PULSE);
