import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { ParticleShape, ParticleState } from '../types';
import { generateParticles, PARTICLE_COUNT } from '../constants';

interface ParticleSceneProps {
  shape: ParticleShape;
  color: string;
  particleState: ParticleState;
}

const Particles = ({ shape, color, particleState }: ParticleSceneProps) => {
  const pointsRef = useRef<THREE.Points>(null);
  
  // Memoize particle positions for the current shape
  const positions = useMemo(() => generateParticles(shape, PARTICLE_COUNT), [shape]);
  
  // Store original positions to interpolate back
  const originalPositions = useMemo(() => positions.slice(), [positions]);

  // Use a ref for current animated values to avoid react render loop for physics
  const currentExpansion = useRef(1);
  const currentTension = useRef(0);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    // Smoothly interpolate towards target state
    const lerpSpeed = 3.0 * delta;
    currentExpansion.current = THREE.MathUtils.lerp(currentExpansion.current, particleState.expansion, lerpSpeed);
    currentTension.current = THREE.MathUtils.lerp(currentTension.current, particleState.tension, lerpSpeed);

    const positionsAttribute = pointsRef.current.geometry.attributes.position;
    const array = positionsAttribute.array as Float32Array;
    const time = state.clock.getElapsedTime();

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      
      // Base Position
      const ox = originalPositions[i3];
      const oy = originalPositions[i3 + 1];
      const oz = originalPositions[i3 + 2];

      // Expansion Logic
      let x = ox * currentExpansion.current;
      let y = oy * currentExpansion.current;
      let z = oz * currentExpansion.current;

      // Tension/Jitter Logic
      // High tension = fast random vibration + rotation
      const jitter = currentTension.current * 0.2;
      
      if (jitter > 0.01) {
        x += (Math.random() - 0.5) * jitter;
        y += (Math.random() - 0.5) * jitter;
        z += (Math.random() - 0.5) * jitter;
      }

      // Idle Animation (breathing)
      const breathing = Math.sin(time * 0.5 + i * 0.01) * 0.05 * (1 - currentTension.current);
      x += x * breathing;
      y += y * breathing;
      z += z * breathing;

      // Rotation based on tension
      const rotSpeed = 0.2 + currentTension.current * 2.0;
      const angle = time * rotSpeed * 0.1;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      
      // Simple Y-axis rotation
      const rx = x * cosA - z * sinA;
      const rz = x * sinA + z * cosA;
      x = rx;
      z = rz;

      array[i3] = x;
      array[i3 + 1] = y;
      array[i3 + 2] = z;
    }

    positionsAttribute.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={PARTICLE_COUNT}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        attach="material"
        color={color}
        size={0.05}
        sizeAttenuation={true}
        transparent={true}
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

export const Scene: React.FC<ParticleSceneProps> = (props) => {
  return (
    <Canvas camera={{ position: [0, 0, 10], fov: 60 }} className="w-full h-full bg-black">
      <color attach="background" args={['#050505']} />
      <ambientLight intensity={0.5} />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <Particles {...props} />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} />
    </Canvas>
  );
};