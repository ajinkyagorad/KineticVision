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
        return this.analyzeResult(result, video.videoWidth);
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

  private analyzeResult(result: GestureRecognizerResult, frameWidth: number): { 
    state: ParticleState, 
    gesture: string, 
    handsDetected: number 
  } {
    const landmarks = result.landmarks;
    const gestures = result.gestures;
    const handsDetected = landmarks.length;

    let expansion = 1.0;
    let tension = 0.0;
    let focus = 0.0;
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

      // --- Metric Extraction ---
      let centroidX = 0;
      let centroidY = 0;
      let rawHandSize = 0; // 0.0 to 1.0 relative to frame

      if (handsDetected === 2) {
        const leftWrist = landmarks[0][0];
        const rightWrist = landmarks[1][0];
        
        // --- Expansion (Distance between hands) ---
        const dx = leftWrist.x - rightWrist.x;
        const dy = leftWrist.y - rightWrist.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Map distance: 0.1 (touching) to 0.8 (arms wide) -> Expansion 0.2 to 3.0
        // Use a power curve for more sensitivity in the middle
        expansion = Math.max(0.2, Math.min(3.5, Math.pow(dist * 2.5, 1.2)));

        centroidX = (leftWrist.x + rightWrist.x) / 2;
        centroidY = (leftWrist.y + rightWrist.y) / 2;

        // Avg Hand Size
        const size1 = Math.abs(landmarks[0][0].y - landmarks[0][9].y); 
        const size2 = Math.abs(landmarks[1][0].y - landmarks[1][9].y);
        rawHandSize = (size1 + size2) / 2;

      } else {
        expansion = 1.0; 
        const wrist = landmarks[0][0];
        const middleTip = landmarks[0][9];
        
        centroidX = wrist.x;
        centroidY = wrist.y;
        
        rawHandSize = Math.abs(wrist.y - middleTip.y);
      }

      // --- Focus (Sweet Spot) Calculation ---
      // Requirement: Focused when hand is ~1/4th frame width (0.25). 
      // Dissociates if closer (> 0.25) or farther (< 0.25).
      
      const TARGET_SIZE = 0.25; // 25% of frame
      const TOLERANCE = 0.15;   // Range of effect

      // Calculate deviation from target
      const deviation = Math.abs(rawHandSize - TARGET_SIZE);
      
      // Normalize deviation: 0 deviation = 1.0 focus. >TOLERANCE deviation = 0.0 focus.
      if (deviation < TOLERANCE) {
          focus = 1.0 - (deviation / TOLERANCE);
          // Add a curve to make the "sweet spot" feel sharper
          focus = Math.pow(focus, 2); 
      } else {
          focus = 0.0;
      }

      // --- Rotation Calculation ---
      // Requirement: Swap Axes.
      // Screen X controls Rotation X (Tilt Up/Down logic if we map X to X? No, usually X movement rotates around Y axis)
      // User asked to SWAP. 
      // Previous: X -> Y, Y -> X.
      // New: X -> X, Y -> Y (This feels like "tilting" the container).
      // Also fixed "default orientation" by centering around 0.
      
      // X: 0 (left) -> -0.5 -> Rotate -PI/3
      // X: 1 (right) -> 0.5 -> Rotate +PI/3
      rotation.y = (centroidX - 0.5) * (Math.PI / 1.5); 
      
      // Y: 0 (top) -> -0.5 -> Rotate -PI/3
      // Y: 1 (bottom) -> 0.5 -> Rotate +PI/3
      rotation.x = -(centroidY - 0.5) * (Math.PI / 1.5); // Inverted Y for natural feel (Hand up = Look up/Tilt up)

    } else {
      dominantGesture = "No Hands";
      focus = 0.0; // Dissociated when no hands
      // Slowly return to neutral rotation? handled by lerp in Scene
    }

    return {
      state: { expansion, tension, focus, rotation },
      gesture: dominantGesture,
      handsDetected
    };
  }
}