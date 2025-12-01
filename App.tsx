import React, { useState, useEffect, useRef } from 'react';
import { Scene } from './components/ParticleScene';
import { Controls } from './components/Controls';
import { VisionService } from './services/visionService';
import { ParticleShape, ParticleState, VisionState } from './types';

const App: React.FC = () => {
  const [shape, setShape] = useState<ParticleShape>(ParticleShape.HEART);
  const [color, setColor] = useState<string>('#ff0055');
  const [visionState, setVisionState] = useState<VisionState>({ isLoaded: false, gesture: 'Initializing...', handsVisible: 0 });
  const [particleState, setParticleState] = useState<ParticleState>({ 
    expansion: 1, 
    tension: 0,
    focus: 0.5,
    rotation: { x: 0, y: 0 }
  });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const visionService = useRef<VisionService | null>(null);
  const requestRef = useRef<number>(0);
  const isInitialized = useRef<boolean>(false);

  // Initialize Vision Service
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const init = async () => {
      try {
        visionService.current = new VisionService();
        await visionService.current.initialize();
        setVisionState(prev => ({ ...prev, isLoaded: true, gesture: 'Ready' }));
        startCamera();
      } catch (error) {
        console.error("Initialization Failed:", error);
        setVisionState(prev => ({ ...prev, gesture: 'Init Failed' }));
      }
    };
    init();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 }, 
          frameRate: { ideal: 30 } 
        },
        audio: false 
      });
      
      // Check ref again after await in case component unmounted
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        
        // Start prediction loop immediately after play resolves
        requestRef.current = requestAnimationFrame(predict);
      } else {
        // Cleanup if ref is gone
        stream.getTracks().forEach(t => t.stop());
      }
    } catch (err) {
      console.error("Camera error:", err);
      setVisionState(prev => ({ ...prev, gesture: 'Camera Error' }));
    }
  };

  const predict = () => {
    // Ensure service is ready and video is playing
    if (visionService.current && videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
      const result = visionService.current.processVideo(videoRef.current);
      
      // Only update state if we got a valid result (not 'None' from skipped frame)
      if (result.gesture !== 'None' && result.gesture !== 'Waiting for Video...') {
          setParticleState(result.state);
          
          setVisionState(prev => ({
            ...prev,
            gesture: result.gesture,
            handsVisible: result.handsDetected
          }));

          // Gesture -> Shape Mapping
          switch (result.gesture) {
            case 'Victory':
              setShape(ParticleShape.FLOWER);
              break;
            case 'Thumb_Up':
              setShape(ParticleShape.HEART);
              break;
            case 'Pointing_Up':
              setShape(ParticleShape.FIREWORKS);
              break;
            case 'ILoveYou':
              setShape(ParticleShape.BUDDHA);
              break;
            case 'Open_Palm':
                 // Keep current shape or default to something
              break;
          }
      }
    }
    requestRef.current = requestAnimationFrame(predict);
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden font-sans">
      
      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-0">
        <Scene shape={shape} color={color} particleState={particleState} />
      </div>

      {/* UI Overlay Layer */}
      <div className="absolute inset-0 z-10">
        <Controls 
            currentShape={shape} 
            setShape={setShape}
            color={color}
            setColor={setColor}
            visionState={visionState}
            videoRef={videoRef}
            particleState={particleState}
        />
      </div>
    </div>
  );
};

export default App;