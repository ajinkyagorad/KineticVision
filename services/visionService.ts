import { GestureRecognizer, FilesetResolver, GestureRecognizerResult } from '@mediapipe/tasks-vision';
import { ParticleState } from '../types';

export class VisionService {
  private gestureRecognizer: GestureRecognizer | null = null;
  private runningMode: "IMAGE" | "VIDEO" = "VIDEO";
  private lastVideoTime = -1;

  public async initialize(): Promise<void> {
    console.log("Initializing Vision Service...");
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );

    this.gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
      },
      runningMode: this.runningMode,
      numHands: 2
    });
    console.log("Vision Service Initialized.");
  }

  public processVideo(video: HTMLVideoElement): { 
    state: ParticleState, 
    gesture: string, 
    handsDetected: number 
  } {
    // 1. Safety Checks
    if (!this.gestureRecognizer) {
      return { 
        state: { expansion: 1, tension: 0, focus: 0.5, rotation: { x: 0, y: 0 } }, 
        gesture: 'Loading Model...', 
        handsDetected: 0 
      };
    }

    if (!video.videoWidth || video.readyState < 2) {
      return { 
        state: { expansion: 1, tension: 0, focus: 0.5, rotation: { x: 0, y: 0 } }, 
        gesture: 'Waiting for Video...', 
        handsDetected: 0 
      };
    }

    const nowInMs = Date.now();

    // 2. Process Video Frame
    if (video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = video.currentTime;
      
      try {
        const result = this.gestureRecognizer.recognizeForVideo(video, nowInMs);
        return this.analyzeResult(result);
      } catch (e) {
        console.warn("Vision processing error:", e);
        // Return neutral state on error
        return { 
            state: { expansion: 1, tension: 0, focus: 0.5, rotation: { x: 0, y: 0 } }, 
            gesture: 'Error', 
            handsDetected: 0 
        };
      }
    }
    
    // 3. Fallback
    return { 
        state: { expansion: 1, tension: 0, focus: 0.5, rotation: { x: 0, y: 0 } }, 
        gesture: 'None', 
        handsDetected: 0 
    };
  }

  private analyzeResult(result: GestureRecognizerResult): { 
    state: ParticleState, 
    gesture: string, 
    handsDetected: number 
  } {
    const landmarks = result.landmarks;
    const gestures = result.gestures;
    const handsDetected = landmarks.length;

    let expansion = 1.0;
    let tension = 0.0;
    let focus = 0.5;
    let rotation = { x: 0, y: 0 };
    let dominantGesture = "None";

    if (handsDetected > 0) {
      // --- Gesture Detection ---
      if (gestures.length > 0 && gestures[0].length > 0) {
        dominantGesture = gestures[0][0].categoryName;
      }

      // --- Tension Calculation (Fist = High Tension) ---
      let isFist = false;
      let isOpen = false;
      for (const handGestures of gestures) {
        for (const g of handGestures) {
            if (g.categoryName === 'Closed_Fist') isFist = true;
            if (g.categoryName === 'Open_Palm') isOpen = true;
        }
      }
      if (isFist) tension = 1.0;
      else if (isOpen) tension = 0.1;
      else tension = 0.4;

      // --- Expansion (Hand Distance) & Rotation (Centroid) ---
      let centroidX = 0;
      let centroidY = 0;
      let handSize = 0; // Proxy for depth/proximity

      if (handsDetected === 2) {
        const leftWrist = landmarks[0][0];
        const rightWrist = landmarks[1][0];
        
        const dx = leftWrist.x - rightWrist.x;
        const dy = leftWrist.y - rightWrist.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Map distance: 0.2 (close) -> 0.8 (far) to expansion 0.1 -> 3.0
        expansion = Math.max(0.1, Math.min(3.0, distance * 5));
        
        centroidX = (leftWrist.x + rightWrist.x) / 2;
        centroidY = (leftWrist.y + rightWrist.y) / 2;

        // Estimate size/proximity using distance between wrist and middle finger tip for both hands
        const size1 = Math.abs(landmarks[0][0].y - landmarks[0][9].y); // Wrist to Middle
        const size2 = Math.abs(landmarks[1][0].y - landmarks[1][9].y);
        handSize = (size1 + size2) / 2;

      } else {
        expansion = 1.0; 
        const wrist = landmarks[0][0];
        centroidX = wrist.x;
        centroidY = wrist.y;
        
        // Estimate size based on single hand
        handSize = Math.abs(landmarks[0][0].y - landmarks[0][9].y);
      }

      // --- Focus (Intensity) Calculation ---
      // handSize typically ranges from 0.1 (far) to 0.4 (very close)
      // We want Focus 0 (far) to 1 (close)
      // 0.1 -> 0.0, 0.4 -> 1.0
      focus = Math.max(0, Math.min(1, (handSize - 0.1) * 3.3));

      // --- Rotation Calculation ---
      // Map X (0..1) -> Y Rotation (-PI..PI) (Inverted for natural feel)
      // Map Y (0..1) -> X Rotation (-PI/2..PI/2)
      rotation.y = -(centroidX - 0.5) * Math.PI * 1.5; 
      rotation.x = -(centroidY - 0.5) * Math.PI;

    } else {
      dominantGesture = "No Hands";
      focus = 0.3; // Default low focus
    }

    return {
      state: { expansion, tension, focus, rotation },
      gesture: dominantGesture,
      handsDetected
    };
  }
}