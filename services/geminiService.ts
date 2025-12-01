import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { ParticleState } from '../types';

export class GeminiService {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private currentSession: any = null;
  private inputAudioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private videoInterval: number | null = null;
  private onStateUpdate: ((state: ParticleState) => void) | null = null;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  public async connect(onStateUpdate: (state: ParticleState) => void, onStatusChange: (status: string) => void) {
    this.onStateUpdate = onStateUpdate;
    onStatusChange('Initializing Audio/Video...');

    // 1. Setup Audio Input
    // Changed: Removed explicit sampleRate to allow system default and avoid NotSupportedError
    this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // 2. Get User Media
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
            channelCount: 1,
            // Changed: Removed strict sampleRate constraint
        }, 
        video: {
            width: 320,
            height: 240,
            frameRate: 10
        } 
      });
    } catch (e) {
      console.error("Permission denied", e);
      onStatusChange('Error: Camera/Mic Permission Denied');
      return;
    }

    onStatusChange('Connecting to Gemini...');

    // 3. Define Tool for Gesture Control
    const setParticleStateTool: FunctionDeclaration = {
      name: 'setParticleState',
      parameters: {
        type: Type.OBJECT,
        description: 'Updates the visual state of the particle system based on hand gestures.',
        properties: {
          expansion: {
            type: Type.NUMBER,
            description: 'Expansion factor (0.1 = hands closed/together, 3.0 = hands wide open/apart).',
          },
          tension: {
            type: Type.NUMBER,
            description: 'Tension level (0.0 = relaxed, 1.0 = fast movement/shaking/tense).',
          },
        },
        required: ['expansion', 'tension'],
      },
    };

    // 4. Connect to Live API
    this.sessionPromise = this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          onStatusChange('Connected! Analyzing Gestures...');
          this.startAudioStream();
        },
        onmessage: (message: LiveServerMessage) => {
            // Handle Tool Calls (The primary way we get data back)
            if (message.toolCall) {
                for (const fc of message.toolCall.functionCalls) {
                    if (fc.name === 'setParticleState') {
                        const args = fc.args as any;
                        if (this.onStateUpdate) {
                            this.onStateUpdate({
                                expansion: Number(args.expansion) || 1,
                                tension: Number(args.tension) || 0,
                                focus: 0.5,
                                rotation: { x: 0, y: 0 }
                            });
                        }
                        // Send success response back to keep model happy
                        this.sessionPromise?.then(session => {
                             session.sendToolResponse({
                                functionResponses: {
                                    id: fc.id,
                                    name: fc.name,
                                    response: { result: "ok" }
                                }
                             });
                        });
                    }
                }
            }
        },
        onclose: () => onStatusChange('Disconnected'),
        onerror: (e) => {
            console.error(e);
            onStatusChange('Error in Connection');
        }
      },
      config: {
        responseModalities: [Modality.AUDIO], // We must accept audio, even if we don't play it
        tools: [{ functionDeclarations: [setParticleStateTool] }],
        systemInstruction: `
          You are a real-time vision processor for a kinetic art installation.
          Continuously analyze the user's hand gestures in the video stream.
          
          Call the tool 'setParticleState' frequently (at least once per second) with these rules:
          1. 'expansion': Look at the distance between the user's hands. 
             - If hands are touching or closed fists near each other: 0.1 to 0.5.
             - If hands are shoulder-width apart: 1.0.
             - If hands are wide open / arms stretched: 2.0 to 3.0.
          2. 'tension': Look for speed or "clenched" fists.
             - Relaxed movement: 0.0 to 0.2.
             - Fast, jerky movement or tight fists: 0.8 to 1.0.
             
          If no hands are visible, default to expansion: 1.0, tension: 0.1.
          Do not speak. Just call the function continuously.
        `,
      },
    });

    // Store session for video sending
    this.sessionPromise.then(session => {
        this.currentSession = session;
    });
  }

  private startAudioStream() {
    if (!this.inputAudioContext || !this.stream) return;
    
    const source = this.inputAudioContext.createMediaStreamSource(this.stream);
    const processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
    
    // Gemini expects 16kHz audio
    const TARGET_SAMPLE_RATE = 16000;
    const sourceSampleRate = this.inputAudioContext.sampleRate;
    
    processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Downsample if necessary (e.g., from 44.1k/48k to 16k)
        let finalData = inputData;
        if (sourceSampleRate !== TARGET_SAMPLE_RATE) {
            const ratio = sourceSampleRate / TARGET_SAMPLE_RATE;
            const newLength = Math.floor(inputData.length / ratio);
            finalData = new Float32Array(newLength);
            for (let i = 0; i < newLength; i++) {
                finalData[i] = inputData[Math.floor(i * ratio)];
            }
        }

        // Convert to PCM16
        const pcm16 = new Int16Array(finalData.length);
        for (let i = 0; i < finalData.length; i++) {
            pcm16[i] = finalData[i] * 0x7fff;
        }
        
        // Base64 encode
        let binary = '';
        const bytes = new Uint8Array(pcm16.buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        this.sessionPromise?.then(session => {
            session.sendRealtimeInput({
                media: {
                    mimeType: 'audio/pcm;rate=16000',
                    data: base64
                }
            });
        });
    };
    
    source.connect(processor);
    processor.connect(this.inputAudioContext.destination);
  }

  public startVideoStreaming(videoElement: HTMLVideoElement) {
    if (this.videoInterval) clearInterval(this.videoInterval);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const quality = 0.5;

    // Send frames at ~5 FPS (200ms)
    this.videoInterval = window.setInterval(() => {
        if (!this.currentSession || !videoElement.videoWidth) return;

        canvas.width = videoElement.videoWidth * 0.5; // Downscale
        canvas.height = videoElement.videoHeight * 0.5;
        
        ctx?.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];

        this.currentSession.sendRealtimeInput({
            media: {
                mimeType: 'image/jpeg',
                data: base64
            }
        });

    }, 200);
  }

  public disconnect() {
    if (this.videoInterval) clearInterval(this.videoInterval);
    if (this.inputAudioContext) this.inputAudioContext.close();
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.currentSession = null;
    this.sessionPromise = null;
  }
}