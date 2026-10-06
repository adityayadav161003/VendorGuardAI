import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * 3D brand artwork in the heritage palette (olive / brass / espresso).
 * Pure geometry — no external assets, everything renders locally.
 */

function ShieldMesh() {
  const group = useRef<THREE.Group>(null);

  const { shieldGeometry, starGeometry } = useMemo(() => {
    // Shield outline (pointed heater shield)
    const s = new THREE.Shape();
    s.moveTo(0, 2.6);
    s.bezierCurveTo(1.7, 2.75, 2.6, 2.6, 3.0, 2.4);          // right shoulder
    s.lineTo(3.0, 0.2);
    s.bezierCurveTo(3.0, -1.6, 1.9, -2.7, 0, -3.4);          // right flank to point
    s.bezierCurveTo(-1.9, -2.7, -3.0, -1.6, -3.0, 0.2);      // left flank
    s.lineTo(-3.0, 2.4);
    s.bezierCurveTo(-2.6, 2.6, -1.7, 2.75, 0, 2.6);          // left shoulder

    const shield = new THREE.ExtrudeGeometry(s, {
      depth: 0.55,
      bevelEnabled: true,
      bevelThickness: 0.16,
      bevelSize: 0.14,
      bevelSegments: 5,
      curveSegments: 28,
    });
    shield.center();

    // Brass star
    const star = new THREE.Shape();
    const spikes = 5, outer = 0.95, inner = 0.38;
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) star.moveTo(x, y);
      else star.lineTo(x, y);
    }
    star.closePath();
    const starGeo = new THREE.ExtrudeGeometry(star, {
      depth: 0.22, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3,
    });
    starGeo.center();

    return { shieldGeometry: shield, starGeometry: starGeo };
  }, []);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    group.current.rotation.y = Math.sin(t * 0.35) * 0.55 + t * 0.12;
    group.current.rotation.x = Math.sin(t * 0.25) * 0.08;
    group.current.position.y = Math.sin(t * 0.8) * 0.14;
  });

  return (
    <group ref={group} scale={0.92}>
      {/* Olive body */}
      <mesh geometry={shieldGeometry} castShadow>
        <meshStandardMaterial color="#4C572F" metalness={0.35} roughness={0.42} />
      </mesh>
      {/* Brass face plate (slightly forward) */}
      <mesh geometry={shieldGeometry} position={[0, 0, 0.42]} scale={[0.88, 0.88, 0.4]}>
        <meshStandardMaterial color="#B9975B" metalness={0.85} roughness={0.28} />
      </mesh>
      {/* Espresso inset */}
      <mesh geometry={shieldGeometry} position={[0, 0, 0.62]} scale={[0.68, 0.68, 0.3]}>
        <meshStandardMaterial color="#211A12" metalness={0.2} roughness={0.6} />
      </mesh>
      {/* Star */}
      <mesh geometry={starGeometry} position={[0, 0.45, 0.86]}>
        <meshStandardMaterial color="#D4BC88" metalness={0.9} roughness={0.2}
          emissive="#96763F" emissiveIntensity={0.25} />
      </mesh>
      {/* Laurel bar */}
      <mesh position={[0, -0.85, 0.86]}>
        <boxGeometry args={[1.7, 0.12, 0.1]} />
        <meshStandardMaterial color="#77854A" metalness={0.4} roughness={0.4} />
      </mesh>
    </group>
  );
}

function OrbitRing({ radius, tilt, speed, color }: { radius: number; tilt: number; speed: number; color: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = clock.getElapsedTime() * speed;
  });
  return (
    <group ref={ref} rotation={[tilt, 0.3, 0]}>
      <mesh>
        <torusGeometry args={[radius, 0.02, 12, 120]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.35} transparent opacity={0.65} />
      </mesh>
      <mesh position={[radius, 0, 0]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color="#D4BC88" metalness={0.9} roughness={0.2}
          emissive="#96763F" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

export const Crest3D: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={className}>
    <Canvas camera={{ position: [0, 0.4, 9], fov: 42 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }}>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 6]} intensity={1.1} color="#F0E9D8" />
      <directionalLight position={[-5, -2, -4]} intensity={0.5} color="#77854A" />
      <pointLight position={[0, 2, 4]} intensity={0.7} color="#B9975B" />
      <ShieldMesh />
      <OrbitRing radius={4.6} tilt={Math.PI / 2.6} speed={0.22} color="#B9975B" />
      <OrbitRing radius={5.3} tilt={Math.PI / 2.1} speed={-0.15} color="#5F6D3B" />
    </Canvas>
  </div>
);
