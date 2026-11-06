import { Chart, Gauge, HStack, Image, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint,
  animation,
  Animation,
  contentTransition,
  font,
  foregroundStyle,
  frame,
  gaugeStyle,
  id,
  layoutPriority,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  padding,
  scaleEffect,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

import type { EventPulseProps } from './types';

/**
 * Live Activity del evento en vivo:
 * - pantalla bloqueada: el nombre como título, la recaudación con lo vendido en la última hora
 *   (lima si viene subiendo, ámbar si se frenó), el gráfico de esa hora en tramos de 5 min y la
 *   mascota en la pose que corresponde (esperando, vendiendo, en racha, frenada o agotado). Solo datos que tiene cualquier evento, sin los de entradas o barra;
 * - Dynamic Island compacta: aro de aforo (o la nube si no hay entradas con tope) + recaudación corta;
 * - expandida: recaudación, dato principal y, abajo, barra + última hora + segundo dato.
 *
 * `paceSeries` y `paceTrend` pueden faltar en pushes de un backend anterior: sin ellos no hay gráfico
 * ni flecha. La flecha tampoco se muestra sin ventas en media hora (`flat`).
 */
const LiveEventActivity = (props: EventPulseProps) => {
  'widget';
  // Pose de la mascota que decide el backend (`mascot`); sin el campo, la de vender.
  const poses = ['Waiting', 'Selling', 'Hot', 'Slow', 'SoldOut'];
  const poseIndex = Math.max(0, ['waiting', 'selling', 'hot', 'slow', 'soldout'].indexOf(props.mascot ?? 'selling'));
  const pose = poses[poseIndex] ?? 'Selling';
  return {
    banner: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 16 }), activityBackgroundTint('#080b11')]}>
        <HStack spacing={8}>
          <Text
            modifiers={[
              font({ size: 15, weight: 'semibold' }),
              foregroundStyle('#f5f7fa'),
              lineLimit(1),
              layoutPriority(1),
            ]}>
            {props.eventName}
          </Text>
          <Spacer />
          <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle('#c6ff00')]}>EN VIVO</Text>
        </HStack>
        <HStack spacing={12}>
          <VStack alignment="leading" spacing={3}>
            <Text
              modifiers={[
                font({ size: 30, weight: 'bold', design: 'rounded' }),
                foregroundStyle('#ffffff'),
                monospacedDigit(),
                contentTransition('numericText'),
                minimumScaleFactor(0.6),
                lineLimit(1),
              ]}>
              {props.revenue}
            </Text>
            <HStack spacing={4}>
              {props.paceTrend === 'up' || props.paceTrend === 'down' ? (
                <Image
                  systemName={props.paceTrend === 'down' ? 'arrow.down.right' : 'arrow.up.right'}
                  size={10}
                  color={props.paceTrend === 'down' ? '#ffb340' : '#c6ff00'}
                />
              ) : null}
              <Text
                modifiers={[
                  font({ size: 12, weight: 'semibold' }),
                  foregroundStyle(props.paceTrend === 'down' ? '#ffb340' : '#c6ff00'),
                  monospacedDigit(),
                  lineLimit(1),
                ]}>
                {props.paceValue}
              </Text>
              <Text modifiers={[font({ size: 12 }), foregroundStyle('#9aa3b2'), lineLimit(1)]}>última hora</Text>
            </HStack>
          </VStack>
          <Spacer />
          {(props.paceSeries ?? []).length > 1 ? (
            <ZStack modifiers={[frame({ width: 84, height: 40 })]}>
              <Chart
                type="area"
                showGrid={false}
                data={(props.paceSeries ?? []).map((y, x) => ({ x, y }))}
                areaStyle={{ color: props.paceTrend === 'down' ? '#ffb34026' : '#c6ff0026' }}
              />
              <Chart
                type="line"
                showGrid={false}
                data={(props.paceSeries ?? []).map((y, x) => ({ x, y }))}
                lineStyle={{ color: props.paceTrend === 'down' ? '#ffb340' : '#c6ff00', width: 2 }}
              />
            </ZStack>
          ) : null}
          {/* Una pose por estado (assets/widgets/NubapayMascot*.imageset); el `id` hace que iOS
              funda una pose con la otra cuando cambia el estado. */}
          <ZStack modifiers={[frame({ width: 54, height: 58 }), animation(Animation.easeInOut({ duration: 0.5 }), poseIndex)]}>
            <Image assetName={`NubapayMascot${pose}`} modifiers={[id(pose), frame({ width: 54, height: 58 })]} />
          </ZStack>
        </HStack>
      </VStack>
    ),
    // Aro de aforo; sin entradas con tope, la nube de Nubapay (ver plugins/with-widget-assets.js).
    // El Gauge circular mide ~44 pt: se escala para que entre en la isla compacta.
    compactLeading:
      props.ratio >= 0 ? (
        <Gauge
          value={props.ratio}
          modifiers={[gaugeStyle('circularCapacity'), tint('#c6ff00'), scaleEffect(0.5), frame({ width: 22, height: 22 })]}
        />
      ) : (
        <Image assetName="NubapayCloud" />
      ),
    compactTrailing: (
      <Text
        modifiers={[
          font({ size: 14, weight: 'semibold' }),
          foregroundStyle('#ffffff'),
          monospacedDigit(),
          contentTransition('numericText'),
        ]}>
        {props.revenueShort}
      </Text>
    ),
    minimal:
      props.ratio >= 0 ? (
        <Gauge
          value={props.ratio}
          modifiers={[gaugeStyle('circularCapacity'), tint('#c6ff00'), scaleEffect(0.5), frame({ width: 22, height: 22 })]}
        />
      ) : (
        <Image assetName="NubapayCloud" />
      ),
    expandedLeading: (
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ size: 11 }), foregroundStyle('#9aa3b2')]}>Recaudado</Text>
        <Text
          modifiers={[
            font({ size: 20, weight: 'bold', design: 'rounded' }),
            foregroundStyle('#ffffff'),
            monospacedDigit(),
            contentTransition('numericText'),
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
