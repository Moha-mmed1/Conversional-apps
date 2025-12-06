import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  volume: number; // 0-100 (approx)
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, volume }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let rotation = 0;

    const render = () => {
      if (!isActive) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw idle state (small circle)
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 20, 0, Math.PI * 2);
        ctx.fillStyle = '#334155'; // Slate 700
        ctx.fill();
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Base radius plus volume reactivity
      const radius = 50 + (volume * 1.5);
      
      // Dynamic color based on volume intensity
      const hue = 210 + (volume * 0.5); // Blue to Purple range
      
      // Draw Glow
      const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.5, centerX, centerY, radius * 1.5);
      gradient.addColorStop(0, `hsla(${hue}, 80%, 60%, 0.8)`);
      gradient.addColorStop(1, `hsla(${hue}, 80%, 60%, 0)`);
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw Inner Core with organic shape
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);
      
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
         const angle = (Math.PI * 2 / 5) * i;
         const r = radius * (0.8 + Math.sin(Date.now() / 200 + i) * 0.1);
         const x = Math.cos(angle) * r;
         const y = Math.sin(angle) * r;
         if (i === 0) ctx.moveTo(x, y);
         else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = `hsl(${hue}, 90%, 70%)`;
      ctx.fill();
      ctx.restore();

      rotation += 0.01;
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [isActive, volume]);

  return (
    <canvas 
      ref={canvasRef} 
      width={400} 
      height={400} 
      className="w-full max-w-[400px] h-auto aspect-square"
    />
  );
};

export default Visualizer;