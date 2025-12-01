import React, { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
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
  
  // Buffers for morphing
  // 1. targetPositions: The ideal coordinates for the selected shape
  const targetPositions = useMemo(() => generateParticles(shape, PARTICLE_COUNT), [shape]);
  
  // 2. currentBasePositions: The actual interpolated position of particles before noise/expansion
  // We initialize it with the first shape's positions
  const currentBasePositions = useRef<Float32Array>(new Float32Array(PARTICLE_COUNT * 3));
  const isInitialized = useRef(false);

  // Initialize buffer on first load
  if (!isInitialized.current) {
    currentBasePositions.current.set(targetPositions);
    isInitialized.current = true;
  }

  // Refs for smooth animation values
  const currentExpansion = useRef(1);
  const currentTension = useRef(0);
  const currentFocus = useRef(0.5);
  const currentRotation = useRef(new THREE.Euler());

  useFrame((state, delta) => {
    if (!pointsRef.current) return;

    // 1. Smoothly interpolate global state values
    const lerpSpeed = 4.0 * delta;
    currentExpansion.current = THREE.MathUtils.lerp(currentExpansion.current, particleState.expansion, lerpSpeed);
    currentTension.current = THREE.MathUtils.lerp(currentTension.current, particleState.tension, lerpSpeed);
    currentFocus.current = THREE.MathUtils.lerp(currentFocus.current, particleState.focus, lerpSpeed);
    
    // Rotation smoothing
    currentRotation.current.x = THREE.MathUtils.lerp(currentRotation.current.x, particleState.rotation.x, lerpSpeed);
    currentRotation.current.y = THREE.MathUtils.lerp(currentRotation.current.y, particleState.rotation.y, lerpSpeed);

    // Apply rotation to the whole group
    pointsRef.current.rotation.x = currentRotation.current.x;
    pointsRef.current.rotation.y = currentRotation.current.y;

    const positionsAttribute = pointsRef.current.geometry.attributes.position;
    const array = positionsAttribute.array as Float32Array;
    const time = state.clock.getElapsedTime();

    // The morph speed - how fast particles travel to new shape
    const morphSpeed = 3.0 * delta; 

    // Focus factor: 1.0 = sharp shape, 0.0 = cloudy/scattered
    // Invert for noise calculation: 0.0 = low noise, 1.0 = high noise
    const noiseFactor = (1.0 - currentFocus.current) * 2.0; 

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      
      // --- Step A: Morph current base position towards target ---
      // We update the persistent 'currentBasePositions' buffer
      currentBasePositions.current[i3]     += (targetPositions[i3]     - currentBasePositions.current[i3])     * morphSpeed;
      currentBasePositions.current[i3 + 1] += (targetPositions[i3 + 1] - currentBasePositions.current[i3 + 1]) * morphSpeed;
      currentBasePositions.current[i3 + 2] += (targetPositions[i3 + 2] - currentBasePositions.current[i3 + 2]) * morphSpeed;

      let x = currentBasePositions.current[i3];
      let y = currentBasePositions.current[i3 + 1];
      let z = currentBasePositions.current[i3 + 2];

      // --- Step B: Apply Expansion ---
      // Expansion scales the shape outwards from center
      x *= currentExpansion.current;
      y *= currentExpansion.current;
      z *= currentExpansion.current;

      // --- Step C: Apply Focus (Scattering) ---
      // If focus is low (hand far), add random noise based on particle index
      // We use sin/cos of index to make it deterministic frame-to-frame but look random
      if (noiseFactor > 0.01) {
          x += Math.sin(i * 13.2 + time) * noiseFactor;
          y += Math.cos(i * 25.1 + time) * noiseFactor;
          z += Math.sin(i * 41.7) * noiseFactor;
      }

      // --- Step D: Apply Tension (Jitter) ---
      // High tension = fast random vibration
      const jitter = currentTension.current * 0.15;
      if (jitter > 0.01) {
        x += (Math.random() - 0.5) * jitter;
        y += (Math.random() - 0.5) * jitter;
        z += (Math.random() - 0.5) * jitter;
      }

      // --- Step E: Apply Breathing (Idle Animation) ---
      const breathing = Math.sin(time * 0.8 + i * 0.01) * 0.03 * (1 - currentTension.current);
      x += x * breathing;
      y += y * breathing;
      z += z * breathing;

      // Update actual geometry
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
          array={new Float32Array(PARTICLE_COUNT * 3)} // Initialize with empty, filled in first frame
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        attach="material"
        color={color}
        size={0.06} // Slightly larger for better morph visuals
        sizeAttenuation={true}
        transparent={true}
        opacity={0.7}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

export const Scene: React.FC<ParticleSceneProps> = (props) => {
  return (
    <Canvas camera={{ position: [0, 0, 12], fov: 50 }} className="w-full h-full bg-black">
      <color attach="background" args={['#050505']} />
      <ambientLight intensity={0.5} />
      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
      <Particles {...props} />
      {/* Removed OrbitControls as we now control rotation via Hands */}
    </Canvas>
  );
};