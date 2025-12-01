export enum ParticleShape {
  HEART = 'Heart',
  FLOWER = 'Flower',
  SATURN = 'Saturn',
  BUDDHA = 'Buddha',
  FIREWORKS = 'Fireworks'
}

export interface ParticleState {
  expansion: number; // 0.1 to 3.0
  tension: number;   // 0.0 to 1.0 (affects jitter/speed)
}

export interface VisionState {
  isLoaded: boolean;
  gesture: string;
  handsVisible: number;
}

export interface ControlState {
  shape: ParticleShape;
  color: string;
  particleCount: number;
}