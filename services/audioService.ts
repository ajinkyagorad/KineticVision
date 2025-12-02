import { ParticleState } from '../types';

export class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  
  // Drone Oscillators (Background Hum)
  private droneOsc: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private droneFilter: BiquadFilterNode | null = null;

  // FM Synth (Sci-Fi Texture)
  private fmCarrier: OscillatorNode | null = null;
  private fmModulator: OscillatorNode | null = null;
  private fmGain: GainNode | null = null;
  private fmFilter: BiquadFilterNode | null = null;

  private isMuted: boolean = true;
  private isInitialized: boolean = false;

  public initialize() {
    if (this.isInitialized) return;
    
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    // Master Chain
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0; // Start silent

    // --- 1. Low Drone (Bass) ---
    this.droneOsc = this.ctx.createOscillator();
    this.droneOsc.type = 'sawtooth';
    this.droneOsc.frequency.value = 55; // Low A
    
    this.droneFilter = this.ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 100;
    
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.15;

    this.droneOsc.connect(this.droneFilter);
    this.droneFilter.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);
    this.droneOsc.start();

    // --- 2. FM Sci-Fi Texture (Highs) ---
    this.fmCarrier = this.ctx.createOscillator();
    this.fmCarrier.type = 'sine';
    this.fmCarrier.frequency.value = 220;

    this.fmModulator = this.ctx.createOscillator();
    this.fmModulator.type = 'square';
    this.fmModulator.frequency.value = 110;
    
    const modulationGain = this.ctx.createGain();
    modulationGain.gain.value = 50; // Modulation depth

    this.fmFilter = this.ctx.createBiquadFilter();
    this.fmFilter.type = 'bandpass';
    this.fmFilter.Q.value = 2;

    this.fmGain = this.ctx.createGain();
    this.fmGain.gain.value = 0.05;

    // FM Routing: Modulator -> ModGain -> Carrier.frequency
    this.fmModulator.connect(modulationGain);
    modulationGain.connect(this.fmCarrier.frequency);
    
    this.fmCarrier.connect(this.fmFilter);
    this.fmFilter.connect(this.fmGain);
    this.fmGain.connect(this.masterGain);

    this.fmCarrier.start();
    this.fmModulator.start();

    this.isInitialized = true;
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.isMuted = false;
    if (this.masterGain) {
        this.masterGain.gain.setTargetAtTime(1.0, this.ctx!.currentTime, 0.1);
    }
  }

  public toggleMute(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
        const target = muted ? 0 : 1.0;
        this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    }
    if (!muted && this.ctx?.state === 'suspended') {
        this.ctx.resume();
    }
  }

  public update(state: ParticleState) {
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const rampTime = 0.1;

    // --- Drone Logic ---
    // Expansion opens the filter (brighter sound when hands open)
    // 50Hz base + up to 800Hz
    const cutoff = 50 + (state.expansion * 400); 
    this.droneFilter?.frequency.setTargetAtTime(cutoff, now, rampTime);

    // Tension increases drone pitch slightly (instability)
    const dronePitch = 55 + (state.tension * 10);
    this.droneOsc?.frequency.setTargetAtTime(dronePitch, now, rampTime);


    // --- FM Logic ---
    // Focus controls volume and harmony
    // High focus = Clearer sound (less modulation complexity, higher volume)
    // Low focus = Dissociated sound (lower volume, more chaotic)
    
    if (this.fmFilter && this.fmCarrier && this.fmModulator) {
        // Center frequency moves with focus (High focus = higher pitch "singing")
        const centerFreq = 200 + (state.focus * 400); 
        this.fmFilter.frequency.setTargetAtTime(centerFreq, now, rampTime);

        // Modulator frequency creates texture. 
        // Tension makes it wobble faster
        this.fmModulator.frequency.setTargetAtTime(100 + (state.tension * 50), now, rampTime);
    }
  }
}