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
        // Removed explicit delegate: "GPU" to allow auto-selection/CPU fallback
        // This fixes the issue where the app hangs if WebGL/GPU is unavailable
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
        state: { expansion: 1, tension: 0 }, 
        gesture: 'Loading Model...', 
        handsDetected: 0 
      };
    }

    if (!video.videoWidth || video.readyState < 2) {
      return { 
        state: { expansion: 1, tension: 0 }, 
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
            state: { expansion: 1, tension: 0 }, 
            gesture: 'Error', 
            handsDetected: 0 
        };
      }
    }
    
    // 3. Fallback (Video frame hasn't changed)
    // Return a special flag or neutral? We return the last known good state logic or neutral.
    // To prevent jitter, we return neutral here effectively, but normally the loop calls this fast enough.
    return { 
        state: { expansion: 1, tension: 0 }, 
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
    let dominantGesture = "None";

    if (handsDetected > 0) {
      // 1. Determine Dominant Gesture
      if (gestures.length > 0 && gestures[0].length > 0) {
        dominantGesture = gestures[0][0].categoryName;
      }

      // 2. Calculate Tension (Fist vs Open)
      let isFist = false;
      let isOpen = false;

      // Check all hands
      for (const handGestures of gestures) {
        for (const g of handGestures) {
            if (g.categoryName === 'Closed_Fist') isFist = true;
            if (g.categoryName === 'Open_Palm') isOpen = true;
        }
      }

      if (isFist) tension = 1.0;
      else if (isOpen) tension = 0.1;
      else tension = 0.4; // Neutral

      // 3. Calculate Expansion (Distance between hands)
      if (handsDetected === 2) {
        const leftWrist = landmarks[0][0];
        const rightWrist = landmarks[1][0];
        
        const dx = leftWrist.x - rightWrist.x;
        const dy = leftWrist.y - rightWrist.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Map distance: 0.2 (close) -> 0.8 (far) to expansion 0.1 -> 3.0
        expansion = Math.max(0.1, Math.min(3.0, distance * 5));
      } else {
        expansion = 1.0; // Default when one hand
      }
    } else {
      dominantGesture = "No Hands";
    }

    return {
      state: { expansion, tension },
      gesture: dominantGesture,
      handsDetected
    };
  }
}