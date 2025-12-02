import React, { useState } from 'react';
import { ParticleShape, VisionState } from '../types';

interface ControlsProps {
  currentShape: ParticleShape;
  setShape: (s: ParticleShape) => void;
  color: string;
  setColor: (c: string) => void;
  visionState: VisionState;
  videoRef: React.RefObject<HTMLVideoElement>;
  particleState: { expansion: number; tension: number; focus: number; rotation: {x: number, y: number} };
  onToggleSound: (muted: boolean) => void;
}

export const Controls: React.FC<ControlsProps> = ({
  currentShape,
  setShape,
  color,
  setColor,
  visionState,
  videoRef,
  particleState,
  onToggleSound
}) => {
  const [isMuted, setIsMuted] = useState(true);

  const handleSoundToggle = () => {
    const newState = !isMuted;
    setIsMuted(newState);
    onToggleSound(newState);
  };

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6">
      
      {/* Header / Status */}
      <div className="flex justify-between items-start pointer-events-auto">
        <div className="bg-black/60 backdrop-blur-md p-4 rounded-xl border border-white/10 text-white shadow-lg max-w-sm w-80">
            <div className="flex justify-between items-center mb-1">
                <h1 className="text-xl font-bold bg-gradient-to-r from-teal-400 to-indigo-500 bg-clip-text text-transparent">
                    Kinetic Vision
                </h1>
                <button 
                    onClick={handleSoundToggle}
                    className={`p-2 rounded-full transition-colors ${isMuted ? 'bg-white/10 text-gray-400' : 'bg-teal-500/20 text-teal-400'}`}
                    title="Toggle Sci-Fi Audio"
                >
                    {isMuted ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                    )}
                </button>
            </div>
            
            <p className="text-xs text-gray-400">MediaPipe Gesture Recognition</p>
            
            <div className="mt-4 flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${visionState.isLoaded ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                <span className="text-sm font-mono uppercase text-yellow-300">{visionState.gesture.replace(/_/g, ' ')}</span>
            </div>

            {visionState.isLoaded && (
                <div className="mt-4 space-y-3">
                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400 uppercase tracking-wider">
                            <span>Expansion</span>
                            <span>{particleState.expansion.toFixed(1)}</span>
                        </div>
                        <div className="w-full bg-gray-800 h-1 rounded overflow-hidden">
                            <div className="bg-teal-400 h-full transition-all duration-200" style={{ width: `${Math.min(100, (particleState.expansion / 3) * 100)}%` }} />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400 uppercase tracking-wider">
                            <span>Tension</span>
                            <span>{particleState.tension.toFixed(2)}</span>
                        </div>
                        <div className="w-full bg-gray-800 h-1 rounded overflow-hidden">
                            <div className="bg-indigo-400 h-full transition-all duration-200" style={{ width: `${particleState.tension * 100}%` }} />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400 uppercase tracking-wider">
                            <span>Focus (Sweet Spot)</span>
                            <span>{particleState.focus.toFixed(2)}</span>
                        </div>
                        <div className="w-full bg-gray-800 h-1 rounded overflow-hidden">
                            <div className="bg-pink-400 h-full transition-all duration-200" style={{ width: `${particleState.focus * 100}%` }} />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-gray-400 uppercase tracking-wider">
                            <span>Rotation (X/Y)</span>
                        </div>
                        <div className="flex gap-1 h-1">
                             <div className="w-1/2 bg-gray-800 rounded overflow-hidden flex items-center justify-center">
                                {/* Visualizing relative to 0 center */}
                                <div className="h-full bg-blue-500 transition-all duration-200 relative" style={{ width: '4px', height: '100%', left: `${(particleState.rotation.y / 2) * 50}%` }} />
                             </div>
                             <div className="w-1/2 bg-gray-800 rounded overflow-hidden flex items-center justify-center">
                                <div className="h-full bg-green-500 transition-all duration-200 relative" style={{ width: '4px', height: '100%', top: `${(particleState.rotation.x / 2) * 50}%` }} />
                             </div>
                        </div>
                    </div>
                </div>
            )}
            
            <div className="mt-4 pt-3 border-t border-white/10 text-[10px] text-gray-500">
                <p>Move 1/4 screen width away for Focus.</p>
                <p className="mt-2 text-white/50">✌️ Victory = Flower | 👍 Thumbs Up = Heart</p>
                <p className="text-white/50">☝️ Point Up = Fireworks | 🤟 Love = Buddha</p>
            </div>
        </div>

        {/* Video Preview (Small) */}
        <div className="relative w-48 rounded-xl overflow-hidden border border-white/20 shadow-2xl bg-black transform hover:scale-105 transition-transform duration-300">
            <video 
                ref={videoRef} 
                autoPlay 
                muted 
                playsInline 
                className="w-full h-full object-cover opacity-90 scale-x-[-1]" 
            />
            <div className="absolute bottom-2 left-2 text-[10px] bg-black/50 px-2 py-1 rounded text-white font-mono backdrop-blur-sm">
                CAM {visionState.handsVisible > 0 ? `(${visionState.handsVisible} HANDS)` : ''}
            </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="pointer-events-auto self-center bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row gap-6 items-center shadow-2xl mb-8">
        
        {/* Shape Selectors */}
        <div className="flex gap-2 flex-wrap justify-center">
            {Object.values(ParticleShape).map((shape) => (
                <button
                    key={shape}
                    onClick={() => setShape(shape)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                        currentShape === shape 
                        ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.4)] scale-105' 
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                >
                    {shape}
                </button>
            ))}
        </div>

        <div className="w-px h-8 bg-white/20 hidden md:block" />

        {/* Color Picker */}
        <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Color</span>
            <input 
                type="color" 
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded-full border-2 border-white/20 cursor-pointer bg-transparent p-0 overflow-hidden"
            />
            <div className="flex gap-2">
                {['#ff0055', '#00ccff', '#ffcc00', '#aa00ff', '#ffffff'].map(c => (
                    <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={`w-5 h-5 rounded-full border border-white/10 transition-transform hover:scale-125 ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : ''}`}
                        style={{ backgroundColor: c }}
                    />
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};