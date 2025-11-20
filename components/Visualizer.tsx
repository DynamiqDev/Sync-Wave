import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  audioSource: MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null;
  context: AudioContext | null;
}

export const Visualizer: React.FC<VisualizerProps> = ({ audioSource, context }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const requestRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!audioSource || !context || !canvasRef.current) return;

    const analyser = context.createAnalyser();
    analyser.fftSize = 128; // Lower for thicker bars
    audioSource.connect(analyser);
    // Do not connect analyser to destination here, the player handles output
    // If we connect here, we might get double audio. 
    // The player logic typically connects source -> destination. 
    // We just want to tap into the source.
    
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      if (!ctx) return;
      
      // Resize handling
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;

      const width = canvas.width;
      const height = canvas.height;

      requestRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * height;
        
        // Cyberpunk Gradient
        const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
        gradient.addColorStop(0, '#0891b2'); // Cyan 600
        gradient.addColorStop(1, '#8b5cf6'); // Violet 500

        ctx.fillStyle = gradient;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      // Do not disconnect audioSource here, it might break playback
      analyser.disconnect();
    };
  }, [audioSource, context]);

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full rounded-xl opacity-80"
    />
  );
};