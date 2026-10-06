import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { GraphPayload } from '../../types';

/**
 * Interactive 3D supplier knowledge graph. Nodes are laid out in 3D
 * (focal supplier centre, directors inner ring, related entities and
 * accounts outer rings) and the whole scene slowly orbits; the reviewer
 * can drag to rotate and scroll to zoom.
 */

const NODE_COLORS: Record<string, string> = {
  SUPPLIER: '#77854A',
  DIRECTOR: '#C7A97B',
  RELATED_ENTITY: '#B9975B',
  BANK_ACCOUNT: '#8C8371',
  ADDRESS: '#5E7549',
};

function layout3D(payload: GraphPayload) {
  const positions: Record<string, [number, number, number]> = {};
  const byType: Record<string, string[]> = {};
  for (const n of payload.nodes) {
    byType[n.node_type] = byType[n.node_type] || [];
    byType[n.node_type].push(n.id);
  }

  const rings: Array<{ type: string; radius: number; height: number }> = [
    { type: 'SUPPLIER', radius: 0, height: 0 },
    { type: 'DIRECTOR', radius: 2.6, height: 0.9 },
    { type: 'BANK_ACCOUNT', radius: 3.4, height: -1.1 },
    { type: 'ADDRESS', radius: 4.2, height: -0.4 },
    { type: 'RELATED_ENTITY', radius: 4.8, height: 0.4 },
  ];
  for (const ring of rings) {
    const ids = byType[ring.type] || [];
    ids.forEach((id, i) => {
      const a = (i / Math.max(1, ids.length)) * Math.PI * 2 + (ring.radius === 0 ? 0 : 0.4);
      positions[id] = [
        Math.cos(a) * ring.radius,
        ring.height,
        Math.sin(a) * ring.radius,
      ];
    });
  }
  // any unknown types
  let orphan = 0;
  for (const n of payload.nodes) {
    if (!positions[n.id]) {
      const a = orphan * 1.1;
      positions[n.id] = [Math.cos(a) * 5.5, 1.8, Math.sin(a) * 5.5];
      orphan += 1;
    }
  }
  return positions;
}

function NodeSphere({ position, color, label, selected, onSelect }: {
  position: [number, number, number];
  color: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const s = selected ? 1.35 + Math.sin(t * 3) * 0.08 : 1;
    ref.current.scale.setScalar(s);
  });
  return (
    <group position={position} onClick={onSelect}>
      <mesh ref={ref}>
        <sphereGeometry args={[selected ? 0.42 : 0.32, 24, 24]} />
        <meshStandardMaterial
          color={color}
          metalness={0.55}
          roughness={0.3}
          emissive={color}
          emissiveIntensity={selected ? 0.55 : 0.18}
        />
      </mesh>
      {/* soft halo */}
      <mesh scale={1.7}>
        <sphereGeometry args={[0.32, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={selected ? 0.16 : 0.07} />
      </mesh>
    </group>
  );
}

function EdgeLines({ payload, positions }: { payload: GraphPayload; positions: Record<string, [number, number, number]> }) {
  const geometry = useMemo(() => {
    const pts: number[] = [];
    for (const e of payload.edges) {
      const a = positions[e.source];
      const b = positions[e.target];
      if (!a || !b) continue;
      pts.push(...a, ...b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, [payload, positions]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#B9975B" transparent opacity={0.5} />
    </lineSegments>
  );
}

function Scene({ payload, selectedId, onSelect }: {
  payload: GraphPayload;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const positions = useMemo(() => layout3D(payload), [payload]);

  useFrame(({ clock }) => {
    if (groupRef.current) groupRef.current.rotation.y = clock.getElapsedTime() * 0.08;
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 8, 6]} intensity={1.0} color="#F0E9D8" />
      <pointLight position={[0, 0, 0]} intensity={0.5} color="#B9975B" />
      <group ref={groupRef}>
        <EdgeLines payload={payload} positions={positions} />
        {payload.nodes.map(node => (
          <NodeSphere
            key={node.id}
            position={positions[node.id] || [0, 0, 0]}
            color={NODE_COLORS[node.node_type] || '#5E7549'}
            label={node.label}
            selected={selectedId === node.id}
            onSelect={() => onSelect(node.id)}
          />
        ))}
        {/* ground disc */}
        <mesh position={[0, -2.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[6.4, 64]} />
          <meshStandardMaterial color="#2E2011" metalness={0.1} roughness={0.9} transparent opacity={0.35} />
        </mesh>
      </group>
      <OrbitControls enablePan={false} minDistance={5} maxDistance={16} autoRotate={false} />
    </>
  );
}

export const Network3D: React.FC<{
  payload: GraphPayload;
  selectedId: string | null;
  onSelectNode: (id: string) => void;
  className?: string;
}> = ({ payload, selectedId, onSelectNode, className = '' }) => (
  <div className={className}>
    <Canvas camera={{ position: [0, 3, 10], fov: 46 }} dpr={[1, 2]} gl={{ alpha: true, antialias: true }}>
      <Scene payload={payload} selectedId={selectedId} onSelect={onSelectNode} />
    </Canvas>
  </div>
);
