import { ParticleShape } from './types';
import * as THREE from 'three';

export const PARTICLE_COUNT = 8000;

// Helper to get random point in sphere
const randomInSphere = () => {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  const r = Math.cbrt(Math.random());
  const sinPhi = Math.sin(phi);
  return new THREE.Vector3(
    r * sinPhi * Math.cos(theta),
    r * sinPhi * Math.sin(theta),
    r * Math.cos(phi)
  );
};

export const generateParticles = (shape: ParticleShape, count: number): Float32Array => {
  const positions = new Float32Array(count * 3);
  const vec = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    let x = 0, y = 0, z = 0;

    switch (shape) {
      case ParticleShape.HEART: {
        // Parametric heart
        const t = Math.random() * Math.PI * 2;
        const u = Math.random() * Math.PI; // Full sphere distribution tweak
        // Specific Heart Formula
        // x = 16sin^3(t)
        // y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
        // We add volume by jittering or using layers
        const r = Math.sqrt(Math.random()) * 2; // radius variation
        const ht = Math.random() * Math.PI * 2;
        const hp = Math.random() * Math.PI; // roughly sphere
        // 3D Heart approximation
        x = 16 * Math.pow(Math.sin(ht), 3);
        y = 13 * Math.cos(ht) - 5 * Math.cos(2 * ht) - 2 * Math.cos(3 * ht) - Math.cos(4 * ht);
        z = r * Math.cos(hp) * 5; // Thickness
        // Normalize roughly
        x *= 0.1; y *= 0.1; z *= 0.1; 
        break;
      }

      case ParticleShape.FLOWER: {
        // Rose curve / Rhodonea
        const k = 4;
        const theta = Math.random() * Math.PI * 2;
        const rad = Math.cos(k * theta) + 2; // offset to make it fuller
        const r = Math.random() * 2;
        x = rad * Math.cos(theta) * r;
        y = rad * Math.sin(theta) * r;
        z = (Math.random() - 0.5) * 1.5; // Thickness
        break;
      }

      case ParticleShape.SATURN: {
        // Planet + Ring
        const isRing = Math.random() > 0.4;
        if (isRing) {
          const inner = 3;
          const outer = 5;
          const angle = Math.random() * Math.PI * 2;
          const dist = inner + Math.random() * (outer - inner);
          x = Math.cos(angle) * dist;
          z = Math.sin(angle) * dist;
          y = (Math.random() - 0.5) * 0.2; // Thin ring
        } else {
          // Planet
          const p = randomInSphere();
          x = p.x * 2;
          y = p.y * 2;
          z = p.z * 2;
        }
        // Tilt
        const tilt = Math.PI / 6;
        const cosT = Math.cos(tilt);
        const sinT = Math.sin(tilt);
        const ty = y * cosT - z * sinT;
        const tz = y * sinT + z * cosT;
        y = ty;
        z = tz;
        break;
      }

      case ParticleShape.BUDDHA: {
        // Simple approximation: Head (Sphere) + Body (Oval) + Base (Oval)
        const part = Math.random();
        if (part < 0.2) {
          // Head
          const p = randomInSphere();
          x = p.x * 0.8;
          y = p.y * 0.8 + 2.5;
          z = p.z * 0.8;
        } else if (part < 0.6) {
          // Body
          const p = randomInSphere();
          x = p.x * 1.5;
          y = p.y * 1.5 + 0.5;
          z = p.z * 1.2;
        } else {
          // Legs/Base
          const p = randomInSphere();
          x = p.x * 2.2;
          y = p.y * 0.8 - 1.5;
          z = p.z * 1.8;
        }
        break;
      }

      case ParticleShape.FIREWORKS: {
        // Explosion burst
        const p = randomInSphere();
        // Concentrate more towards center for trail effect visual
        const len = Math.random();
        x = p.x * len * 5;
        y = p.y * len * 5;
        z = p.z * len * 5;
        break;
      }
      
      default:
        x = (Math.random() - 0.5) * 5;
        y = (Math.random() - 0.5) * 5;
        z = (Math.random() - 0.5) * 5;
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }
  return positions;
};
