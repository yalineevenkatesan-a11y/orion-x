'use client';

import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
}

export function BackgroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    const particles: Particle[] = [];
    const numParticles = 50;

    // Create 40-60 drifting ambient nodes
    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.25, // very slow drift
        vy: (Math.random() - 0.5) * 0.25,
        radius: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.4 + 0.1
      });
    }

    let animationFrameId: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(147, 51, 234, ${p.opacity})`; // Violet glow
        ctx.fill();

        // Update positions
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around boundaries
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-50 bg-[#020204] overflow-hidden select-none pointer-events-none">
      {/* Absolute dark indigo radial gradient glow */}
      <div 
        className="absolute top-[-10%] left-[-10%] w-[80vw] h-[80vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(49,46,129,0.18)_0%,rgba(0,0,0,0)_70%)] blur-[80px] animate-pulse"
        style={{ animationDuration: '12s' }}
      />
      
      {/* Midnight violet radial gradient glow */}
      <div 
        className="absolute bottom-[-10%] right-[-10%] w-[80vw] h-[80vw] rounded-full bg-[radial-gradient(circle_at_center,rgba(88,28,135,0.18)_0%,rgba(0,0,0,0)_70%)] blur-[80px] animate-pulse"
        style={{ animationDuration: '18s' }}
      />
      
      {/* Subtle overlay grid for texture */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.003)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.003)_1px,transparent_1px)] bg-[size:40px_40px]" />

      {/* Floating particles canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60" />
    </div>
  );
}
export default BackgroundCanvas;
