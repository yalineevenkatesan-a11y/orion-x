'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useWorkspaceUi } from '@/context/WorkspaceUiContext';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export function SplashScreen() {
  const { setWorkspaceState } = useWorkspaceUi();
  
  const [logs, setLogs] = useState<string[]>([]);
  const [progressWidth, setProgressWidth] = useState(0);
  const [isFading, setIsFading] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // 1. Diagnostic terminal log timeouts and progress bar trigger
  useEffect(() => {
    const logList = [
      { text: 'Initializing core orchestration kernel...', delay: 200 },
      { text: 'Establishing local SQLite transaction tables... [OK]', delay: 800 },
      { text: 'Checking local AI model server hooks... [OK]', delay: 1500 },
      { text: 'Optimizing system vector indexing canvas... Ready', delay: 2200 }
    ];

    const timeouts = logList.map((log) => 
      setTimeout(() => {
        setLogs((prev) => [...prev, log.text]);
      }, log.delay)
    );

    // Trigger smooth progress line bar fill animation
    const progressTimer = setTimeout(() => {
      setProgressWidth(100);
    }, 50);

    // Fade-out trigger at 2500ms
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, 2500);

    // Switch state to HUB after fade duration finishes (3000ms total)
    const completeTimer = setTimeout(() => {
      setWorkspaceState('HUB');
    }, 3000);

    return () => {
      timeouts.forEach(clearTimeout);
      clearTimeout(progressTimer);
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [setWorkspaceState]);

  // 2. High-performance HTML5 canvas neural particle engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle screen resize dimensions mapping
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    const particles: Particle[] = [];
    const numParticles = 40;

    // Initialize 40 dot nodes with randomized positions and velocities
    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        radius: Math.random() * 2 + 1
      });
    }

    const renderLoop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw and update particle dot nodes
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.4)';
        ctx.fill();

        // Update positions with velocities
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off canvas layout edges
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      });

      // Compute distances and draw connecting beams
      for (let i = 0; i < numParticles; i++) {
        for (let j = i + 1; j < numParticles; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(34, 211, 238, ${0.15 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className={`fixed inset-0 z-50 bg-[#020204] flex flex-col items-center justify-center transition-opacity duration-500 select-none ${
      isFading ? 'opacity-0' : 'opacity-100'
    }`}>
      {/* Background Neural Nodes canvas */}
      <canvas 
        ref={canvasRef} 
        id="neural-matrix-canvas" 
        className="absolute inset-0 w-full h-full pointer-events-none" 
      />

      {/* Core branding center container */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-6">
        <h1 className="text-xl font-mono font-bold tracking-[0.4em] text-white animate-pulse drop-shadow-[0_0_12px_rgba(255,255,255,0.15)] mb-4">
          ORION-X STUDIO
        </h1>

        {/* Glowing Progress bar track */}
        <div className="w-full h-[2px] bg-white/5 rounded-full overflow-hidden mb-6 relative">
          <div 
            className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 shadow-[0_0_8px_rgba(34,211,238,0.8)] transition-all duration-[2450ms] ease-out"
            style={{ width: `${progressWidth}%` }}
          />
        </div>

        {/* Diagnostic logs console */}
        <div className="w-full h-28 bg-black/40 border border-white/5 rounded-xl p-4 font-mono text-[9px] text-gray-500 flex flex-col gap-1.5 overflow-hidden backdrop-blur-md">
          {logs.map((log, idx) => (
            <div key={idx} className="flex items-center gap-1.5 leading-relaxed text-cyan-400/80 animate-fade-in">
              <span className="text-purple-400/60 select-none">&gt;&gt;</span>
              <span>{log}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
export default SplashScreen;
