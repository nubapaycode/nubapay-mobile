/* eslint-disable react/no-unknown-property -- props de three (intensity, roughness…) en elementos de R3F */
import { Canvas, useFrame } from '@react-three/fiber/native';
import { useMemo, useRef } from 'react';
import { type GestureResponderEvent, StyleSheet, View } from 'react-native';
import * as THREE from 'three';
type Props = { primary: string; brand: string; ink: string; animate: boolean };

/** Arrastre del dedo, compartido entre la vista (toques) y el loop de three (useFrame). */
type Drag = {
  active: boolean;
  lastX: number;
  lastY: number;
  lastMove: number;
  /** Giro pendiente de aplicar (rad), acumulado entre cuadros. */
  dx: number;
  dy: number;
  /** Velocidad angular para la inercia al soltar (rad/s). */
  vx: number;
  vy: number;
};

/** "N" de Nubapay como silueta, para extruirla sobre la cara de la moneda. */
function nShape() {
  const s = new THREE.Shape();
  const w = 0.62;
  const h = 0.78;
  const t = 0.17; // grosor del trazo
  s.moveTo(-w / 2, -h / 2);
  s.lineTo(-w / 2 + t, -h / 2);
  s.lineTo(-w / 2 + t, h / 2 - t * 1.6);
  s.lineTo(w / 2 - t, -h / 2);
  s.lineTo(w / 2, -h / 2);
  s.lineTo(w / 2, h / 2);
  s.lineTo(w / 2 - t, h / 2);
  s.lineTo(w / 2 - t, -h / 2 + t * 1.6);
  s.lineTo(-w / 2 + t, h / 2);
  s.lineTo(-w / 2, h / 2);
  s.closePath();
  return s;
}

function Coin({ primary, brand, ink, animate, getDrag }: Props & { getDrag: () => Drag }) {
  const group = useRef<THREE.Group>(null);
  const spin = useRef({ x: 0.25, y: -0.5 });
  const letter = useMemo(
    () => new THREE.ExtrudeGeometry(nShape(), { depth: 0.08, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }),
    [],
  );

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const d = getDrag();
    // Mientras se arrastra, la moneda sigue al dedo 1:1.
    spin.current.y += d.dx;
    spin.current.x += d.dy;
    d.dx = 0;
    d.dy = 0;
    if (!d.active) {
      // Inercia del último arrastre que se frena, más un giro lento de reposo.
      spin.current.y += d.vx * delta;
      spin.current.x += d.vy * delta;
      d.vx *= Math.pow(0.05, delta);
      d.vy *= Math.pow(0.05, delta);
      if (animate) spin.current.y += delta * 0.55;
      // La inclinación vuelve de a poco al ángulo de reposo.
      spin.current.x += (0.25 - spin.current.x) * Math.min(1, delta * 2.5);
    }
    spin.current.x = Math.max(-0.9, Math.min(0.9, spin.current.x));
    g.rotation.set(spin.current.x, spin.current.y, 0);
    g.position.y = animate ? Math.sin(state.clock.elapsedTime * 1.4) * 0.08 : 0;
  });

  return (
    <group ref={group}>
      {/* Cuerpo */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1, 1, 0.22, 64]} />
        <meshStandardMaterial color={primary} metalness={0.55} roughness={0.28} />
      </mesh>
      {/* Canto de marca */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.065, 16, 96]} />
        <meshStandardMaterial color={brand} metalness={0.3} roughness={0.35} emissive={brand} emissiveIntensity={0.15} />
      </mesh>
      {/* "N" en ambas caras */}
      <mesh geometry={letter} position={[0, 0, 0.1]}>
        <meshStandardMaterial color={ink} metalness={0.4} roughness={0.3} />
      </mesh>
      <mesh geometry={letter} position={[0, 0, -0.1]} rotation={[0, Math.PI, 0]}>
        <meshStandardMaterial color={ink} metalness={0.4} roughness={0.3} />
      </mesh>
    </group>
  );
}

/**
 * Moneda de marca en 3D para el login: gira sola y flota; con el dedo se la puede hacer girar
 * (con inercia al soltar).
 */
export default function BrandCoin(props: Props) {
  const drag = useRef<Drag>({ active: false, lastX: 0, lastY: 0, lastMove: 0, dx: 0, dy: 0, vx: 0, vy: 0 });

  const onStart = (e: GestureResponderEvent) => {
    const d = drag.current;
    d.active = true;
    d.lastX = e.nativeEvent.pageX;
    d.lastY = e.nativeEvent.pageY;
    d.lastMove = Date.now();
    d.vx = 0;
    d.vy = 0;
  };
  const onMove = (e: GestureResponderEvent) => {
    const d = drag.current;
    const { pageX, pageY } = e.nativeEvent;
    const now = Date.now();
    const dt = Math.max(1, now - d.lastMove) / 1000;
    const ax = (pageX - d.lastX) * 0.012;
    const ay = (pageY - d.lastY) * 0.008;
    d.dx += ax;
    d.dy += ay;
    // Velocidad suavizada para lanzar la moneda al soltar.
    d.vx = d.vx * 0.6 + (ax / dt) * 0.4;
    d.vy = d.vy * 0.6 + (ay / dt) * 0.4;
    d.lastX = pageX;
    d.lastY = pageY;
    d.lastMove = now;
  };
  const onEnd = () => {
    const d = drag.current;
    d.active = false;
    // Si el dedo quedó quieto antes de soltar, no hay lanzamiento.
    if (Date.now() - d.lastMove > 90) {
      d.vx = 0;
      d.vy = 0;
    }
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      onStartShouldSetResponder={() => true}
      onResponderGrant={onStart}
      onResponderMove={onMove}
      onResponderRelease={onEnd}
      onResponderTerminate={onEnd}>
      <Canvas camera={{ position: [0, 0, 4.2], fov: 38 }} frameloop="always">
        <ambientLight intensity={0.55} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} />
        <directionalLight position={[-4, -2, 2]} intensity={0.8} color={props.brand} />
        <pointLight position={[0, 0, 3]} intensity={0.6} />
        <Coin {...props} getDrag={() => drag.current} />
      </Canvas>
    </View>
  );
}
