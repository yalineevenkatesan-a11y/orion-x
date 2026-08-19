'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, MeshDistortMaterial } from '@react-three/drei';

type IdleState = 'HUGGING_TEDDY' | 'SWINGING_LEGS' | 'LOOKING_AROUND' | 'CELEBRATING';

function CompanionVisuals({ idleState }: { idleState: IdleState }) {
  const meshRef = useRef<any>(null);
  const ringRef = useRef<any>(null);

  useFrame((state) => {
    const elapsed = state.clock.getElapsedTime();

    if (meshRef.current) {
      // 1. Behavior: CELEBRATING (rapid spin and bounce pulse)
      if (idleState === 'CELEBRATING') {
        meshRef.current.rotation.y = elapsed * 10.0;
        meshRef.current.rotation.x = elapsed * 5.0;
        const pulse = 1.2 + Math.sin(elapsed * 20) * 0.1;
        meshRef.current.scale.set(pulse, pulse, pulse);
        meshRef.current.position.y = Math.abs(Math.sin(elapsed * 10)) * 0.2;
      }
      // 2. Behavior: SWINGING_LEGS (wobbling distortion)
      else if (idleState === 'SWINGING_LEGS') {
        meshRef.current.rotation.x = Math.sin(elapsed * 2) * 0.15;
        meshRef.current.rotation.y = elapsed * 0.5;
        meshRef.current.position.y = Math.sin(elapsed * 3) * 0.1;
        meshRef.current.scale.set(1.0, 1.0, 1.0);
      } 
      // 3. Behavior: HUGGING_TEDDY (glowing pulse compression)
      else if (idleState === 'HUGGING_TEDDY') {
        const pulse = 1.0 + Math.sin(elapsed * 4) * 0.05;
        meshRef.current.scale.set(pulse, pulse, pulse);
        meshRef.current.rotation.y = elapsed * 0.15;
        meshRef.current.position.y = 0;
      } 
      // 4. Behavior: LOOKING_AROUND (looking around direction shifts)
      else {
        meshRef.current.rotation.y = Math.sin(elapsed * 0.8) * 0.4;
        meshRef.current.rotation.x = Math.cos(elapsed * 0.5) * 0.15;
        meshRef.current.position.y = Math.sin(elapsed * 1.5) * 0.05;
        meshRef.current.scale.set(1.0, 1.0, 1.0);
      }
    }

    if (ringRef.current) {
      ringRef.current.rotation.z = -elapsed * (idleState === 'CELEBRATING' ? 3.0 : 0.3);
      ringRef.current.rotation.x = Math.sin(elapsed * 0.5) * 0.2;
    }
  });

  return (
    <group>
      <ambientLight intensity={1.5} />
      <pointLight position={[10, 10, 10]} intensity={2.0} color="#22d3ee" />
      <pointLight position={[-10, -10, -10]} intensity={1.0} color="#a855f7" />

      {/* Main companion core sphere */}
      <Sphere ref={meshRef} args={[1, 64, 64]} scale={1.0}>
        <MeshDistortMaterial
          color={
            idleState === 'CELEBRATING' 
              ? '#22c55e' // Green celebration!
              : idleState === 'HUGGING_TEDDY' 
                ? '#a855f7' 
                : '#06b6d4'
          }
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          metalness={0.9}
          roughness={0.2}
          distort={idleState === 'SWINGING_LEGS' ? 0.3 : idleState === 'CELEBRATING' ? 0.4 : 0.1}
          speed={idleState === 'SWINGING_LEGS' ? 4 : idleState === 'CELEBRATING' ? 8 : 1.5}
        />
      </Sphere>

      {/* Orbiting Tech Ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[1.5, 0.02, 16, 100]} />
        <meshBasicMaterial 
          color={
            idleState === 'CELEBRATING' 
              ? '#4ade80' 
              : idleState === 'HUGGING_TEDDY' 
                ? '#c084fc' 
                : '#22d3ee'
          } 
          opacity={0.6} 
          transparent 
        />
      </mesh>
    </group>
  );
}

interface AICompanionContainerProps {
  celebrateTrigger?: number;
}

export function AICompanionContainer({ celebrateTrigger = 0 }: AICompanionContainerProps) {
  const [idleState, setIdleState] = useState<IdleState>('LOOKING_AROUND');
  const [isMounted, setIsMounted] = useState(false);

  // Set isMounted to true client-side to prevent SSR layout crashes
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Trigger celebration on prop update
  useEffect(() => {
    if (celebrateTrigger > 0) {
      setIdleState('CELEBRATING');
      const timer = setTimeout(() => {
        setIdleState('LOOKING_AROUND');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [celebrateTrigger]);

  // Cycle states randomly to simulate lifelike behavior without looping obviously
  useEffect(() => {
    if (idleState === 'CELEATING' as any || idleState === 'CELEBRATING') return;

    const states: IdleState[] = ['HUGGING_TEDDY', 'SWINGING_LEGS', 'LOOKING_AROUND'];
    
    const interval = setInterval(() => {
      const randomState = states[Math.floor(Math.random() * states.length)];
      setIdleState(randomState);
    }, 4500);

    return () => clearInterval(interval);
  }, [idleState]);

  // Fallback visual mock loading placeholder to handle structural measurements on hot-reloads safely
  if (!isMounted) {
    return (
      <div className="absolute bottom-8 left-8 w-56 h-56 z-30 bg-gradient-to-t from-purple-950/20 to-cyan-950/10 border border-white/5 rounded-2xl flex items-center justify-center animate-pulse backdrop-blur-sm select-none">
        <span className="font-mono text-[9px] text-cyan-400/60 uppercase tracking-widest">Hydrating...</span>
      </div>
    );
  }

  return (
    <div className="absolute bottom-8 left-8 w-56 h-56 z-30 flex flex-col items-center">
      {/* Behavior diagnostic panel tag overlay */}
      <div className="mb-2 bg-black/60 border border-white/10 rounded-full px-3 py-1 font-mono text-[9px] text-cyan-400 tracking-wider backdrop-blur-md shadow-lg select-none">
        BEHAVIOR: <span className="text-purple-400 font-bold">{idleState}</span>
      </div>

      {/* Three.js / Fiber Render window */}
      <div className="w-full h-full cursor-grab active:cursor-grabbing relative bg-gradient-to-t from-purple-950/20 to-cyan-950/10 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm shadow-2xl">
        <Canvas camera={{ position: [0, 0, 3.5], fov: 45 }}>
          <CompanionVisuals idleState={idleState} />
          <OrbitControls enableZoom={false} enablePan={false} />
        </Canvas>
      </div>
    </div>
  );
}
export default AICompanionContainer;
