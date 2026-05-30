'use client';

import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Center } from '@react-three/drei';

/* Brand colors */
const RAIL_COLOR = '#1aab57';
const RUNG_COLOR = '#e8e0d4';

function Ladder({ length }: { length: number }) {
  /* Model in meters, then scale the whole group to a constant on-screen height */
  const railWidth = 0.42;          // distance between the two side rails
  const railRadius = 0.045;
  const rungRadius = 0.03;
  const rungSpacing = 0.32;        // meters between rungs

  const rungCount = Math.max(2, Math.round(length / rungSpacing));
  const targetHeight = 8;          // constant visual height in scene units
  const scale = targetHeight / length;

  const rungs = useMemo(() => {
    const items: number[] = [];
    const top = length / 2 - rungSpacing * 0.6;
    const bottom = -length / 2 + rungSpacing * 0.6;
    const usable = top - bottom;
    const steps = Math.max(1, rungCount - 1);
    for (let i = 0; i < rungCount; i++) {
      items.push(bottom + (usable * i) / steps);
    }
    return items;
  }, [length, rungCount]);

  return (
    <group scale={scale} rotation={[0, -0.35, 0]}>
      {/* Side rails */}
      {[-railWidth / 2, railWidth / 2].map((x) => (
        <mesh key={x} position={[x, 0, 0]} castShadow>
          <cylinderGeometry args={[railRadius, railRadius, length, 24]} />
          <meshStandardMaterial color={RAIL_COLOR} roughness={0.35} metalness={0.15} />
        </mesh>
      ))}

      {/* Rounded rail caps */}
      {[-railWidth / 2, railWidth / 2].map((x) =>
        [length / 2, -length / 2].map((y) => (
          <mesh key={`${x}-${y}`} position={[x, y, 0]}>
            <sphereGeometry args={[railRadius, 20, 20]} />
            <meshStandardMaterial color={RAIL_COLOR} roughness={0.35} metalness={0.15} />
          </mesh>
        )),
      )}

      {/* Rungs */}
      {rungs.map((y, i) => (
        <mesh key={i} position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[rungRadius, rungRadius, railWidth, 20]} />
          <meshStandardMaterial color={RUNG_COLOR} roughness={0.5} metalness={0.05} />
        </mesh>
      ))}
    </group>
  );
}

export default function Ladder3D({ length }: { length: number }) {
  return (
    <Canvas shadows camera={{ position: [6, 1, 9], fov: 38 }} dpr={[1, 2]}>
      <color attach="background" args={['#0a1628']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 6]} intensity={1.4} castShadow />
      <directionalLight position={[-6, 2, -4]} intensity={0.4} color="#2ecc71" />

      <Suspense fallback={null}>
        <Center>
          <Ladder length={length} />
        </Center>
        <ContactShadows position={[0, -4.6, 0]} opacity={0.35} scale={14} blur={2.5} far={6} />
        <Environment preset="warehouse" />
      </Suspense>

      <OrbitControls
        enablePan={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.7}
        minDistance={7}
        maxDistance={16}
        autoRotate
        autoRotateSpeed={0.6}
      />
    </Canvas>
  );
}
