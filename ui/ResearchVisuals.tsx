'use client';

import { useEffect, useId, useRef } from 'react';

type CanvasVariant = 'sphere' | 'tetrahedron' | 'wave';

interface CanvasVisualProps {
  className?: string;
}

const INK = [27, 28, 26] as const;
const WARM = [184, 101, 70] as const;
const COOL = [113, 132, 154] as const;

function rgba(color: readonly [number, number, number], alpha: number) {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

function rotateY(point: { x: number; y: number; z: number }, angle: number) {
  return {
    x: point.x * Math.cos(angle) - point.z * Math.sin(angle),
    y: point.y,
    z: point.x * Math.sin(angle) + point.z * Math.cos(angle),
  };
}

function rotateX(point: { x: number; y: number; z: number }, angle: number) {
  return {
    x: point.x,
    y: point.y * Math.cos(angle) - point.z * Math.sin(angle),
    z: point.y * Math.sin(angle) + point.z * Math.cos(angle),
  };
}

function rotateZ(point: { x: number; y: number; z: number }, angle: number) {
  return {
    x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
    y: point.x * Math.sin(angle) + point.y * Math.cos(angle),
    z: point.z,
  };
}

function CanvasVisual({ variant, className = '' }: CanvasVisualProps & { variant: CanvasVariant }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    let frame = 0;
    let time = 0;
    let width = 0;
    let height = 0;
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const compactQuery = window.matchMedia('(max-width: 767px)');
    let staticMode = reducedMotionQuery.matches || compactQuery.matches;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawSphere = () => {
      const chars = '·∘○◯◌●';
      const points: { x: number; y: number; z: number; char: string }[] = [];
      const radius = Math.min(width, height) * 0.42;
      const centerX = width / 2;
      const centerY = height / 2;

      for (let phi = 0; phi < Math.PI * 2; phi += 0.2) {
        for (let theta = 0; theta < Math.PI; theta += 0.2) {
          const x = Math.sin(theta) * Math.cos(phi + time * 0.5);
          const y = Math.sin(theta) * Math.sin(phi + time * 0.5);
          const z = Math.cos(theta);
          const yRotated = rotateY({ x, y, z }, time * 0.3);
          const rotated = rotateX(yRotated, time * 0.2);
          const depth = (rotated.z + 1) / 2;

          points.push({
            x: centerX + rotated.x * radius,
            y: centerY + rotated.y * radius,
            z: rotated.z,
            char: chars[Math.floor(depth * (chars.length - 1))],
          });
        }
      }

      points.sort((a, b) => a.z - b.z);
      context.font = `${Math.max(8, Math.min(12, width / 18))}px IBM Plex Mono, monospace`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      points.forEach((point) => {
        context.fillStyle = rgba(INK, 0.12 + (point.z + 1) * 0.28);
        context.fillText(point.char, point.x, point.y);
      });
    };

    const drawTetrahedron = () => {
      const chars = '░▒▓█';
      const vertices = [
        { x: 0, y: 1, z: 0 },
        { x: -0.943, y: -0.333, z: -0.5 },
        { x: 0.943, y: -0.333, z: -0.5 },
        { x: 0, y: -0.333, z: 1 },
      ];
      const edges = [
        [0, 1],
        [0, 2],
        [0, 3],
        [1, 2],
        [2, 3],
        [3, 1],
      ];
      const points: { x: number; y: number; z: number; char: string }[] = [];
      const scale = Math.min(width, height) * 0.34;

      edges.forEach(([fromIndex, toIndex]) => {
        const from = vertices[fromIndex];
        const to = vertices[toIndex];
        for (let t = 0; t <= 1; t += 0.08) {
          let point = {
            x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t,
            z: from.z + (to.z - from.z) * t,
          };
          point = rotateY(point, time * 0.4);
          point = rotateX(point, time * 0.3);
          point = rotateZ(point, time * 0.2);
          const depth = (point.z + 1.5) / 3;
          points.push({
            x: width / 2 + point.x * scale,
            y: height / 2 - point.y * scale,
            z: point.z,
            char: chars[Math.min(chars.length - 1, Math.floor(depth * chars.length))],
          });
        }
      });

      points.sort((a, b) => a.z - b.z);
      context.font = `${Math.max(10, Math.min(18, width / 12))}px IBM Plex Mono, monospace`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      points.forEach((point) => {
        context.fillStyle = rgba(WARM, 0.16 + (point.z + 1.5) * 0.2);
        context.fillText(point.char, point.x, point.y);
      });
    };

    const drawWave = () => {
      const chars = '·∘○◯◌●';
      const cols = Math.max(1, Math.floor(width / 18));
      const rows = Math.max(1, Math.floor(height / 18));
      context.font = '12px IBM Plex Mono, monospace';
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const waveA = Math.sin(x * 0.22 + time * 1.8) * Math.cos(y * 0.16 + time);
          const waveB = Math.sin((x + y) * 0.12 + time * 1.4);
          const waveC = Math.cos(x * 0.1 - y * 0.12 + time * 0.8);
          const normalized = ((waveA + waveB + waveC) / 3 + 1) / 2;
          const px = (x + 0.5) * (width / cols);
          const py = (y + 0.5) * (height / rows);

          context.fillStyle = rgba(COOL, 0.1 + normalized * 0.35);
          context.fillText(chars[Math.floor(normalized * (chars.length - 1))], px, py);
        }
      }
    };

    const render = () => {
      context.clearRect(0, 0, width, height);
      if (variant === 'sphere') drawSphere();
      if (variant === 'tetrahedron') drawTetrahedron();
      if (variant === 'wave') drawWave();
      if (!staticMode) time += variant === 'wave' ? 0.025 : 0.018;
    };

    const animate = () => {
      if (document.hidden) return;
      render();
      if (!staticMode) frame = window.requestAnimationFrame(animate);
    };

    const handleModeChange = () => {
      staticMode = reducedMotionQuery.matches || compactQuery.matches;
      window.cancelAnimationFrame(frame);
      if (staticMode) {
        render();
      } else if (!document.hidden) {
        frame = window.requestAnimationFrame(animate);
      }
    };

    const handleVisibilityChange = () => {
      window.cancelAnimationFrame(frame);
      if (!document.hidden) animate();
    };

    resize();
    render();
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    reducedMotionQuery.addEventListener('change', handleModeChange);
    compactQuery.addEventListener('change', handleModeChange);
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(canvas);

    if (!staticMode) frame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      reducedMotionQuery.removeEventListener('change', handleModeChange);
      compactQuery.removeEventListener('change', handleModeChange);
      resizeObserver?.disconnect();
    };
  }, [variant]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}

export function ResearchTetrahedron({ className = '' }: CanvasVisualProps) {
  return <CanvasVisual variant="tetrahedron" className={className} />;
}

export function ResearchWave({ className = '' }: CanvasVisualProps) {
  return <CanvasVisual variant="wave" className={className} />;
}

type DiagramKind = 'cloud' | 'features' | 'human';

interface ResearchDiagramProps {
  kind: DiagramKind;
  className?: string;
}

export function ResearchDiagram({ kind, className = '' }: ResearchDiagramProps) {
  const id = useId().replace(/:/g, '');
  const pathId = `research-data-path-${id}`;

  return (
    <svg className={className} viewBox="0 0 200 120" aria-hidden="true" focusable="false">
      {kind === 'cloud' && (
        <>
          <rect x="28" y="16" width="144" height="82" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          {[0, 1, 2, 3, 4].map((index) => (
            <rect key={index} x="40" y={28 + index * 13} width="120" height="7" rx="2" fill="currentColor" opacity="0.15">
              <animate
                attributeName="opacity"
                values="0.15;0.72;0.15"
                dur="2.4s"
                begin={`${index * 0.16}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="width"
                values="18;120;18"
                dur="2.4s"
                begin={`${index * 0.16}s`}
                repeatCount="indefinite"
              />
            </rect>
          ))}
          <circle cx="100" cy="108" r="3" fill="currentColor" opacity="0.3">
            <animate attributeName="opacity" values="0.2;0.9;0.2" dur="1.2s" repeatCount="indefinite" />
          </circle>
        </>
      )}

      {kind === 'features' && (
        <>
          <circle cx="100" cy="60" r="11" fill="currentColor">
            <animate attributeName="r" values="11;14;11" dur="2.2s" repeatCount="indefinite" />
          </circle>
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const angle = index * 60 * (Math.PI / 180);
            const radius = 42;
            const x = 100 + Math.cos(angle) * radius;
            const y = 60 + Math.sin(angle) * radius;
            return (
              <g key={index}>
                <line x1="100" y1="60" x2={x} y2={y} stroke="currentColor" strokeWidth="1" opacity="0.25">
                  <animate attributeName="opacity" values="0.2;0.7;0.2" dur="2.2s" begin={`${index * 0.25}s`} repeatCount="indefinite" />
                </line>
                <circle cx={x} cy={y} r="5" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <animate attributeName="r" values="5;7;5" dur="2.2s" begin={`${index * 0.25}s`} repeatCount="indefinite" />
                </circle>
              </g>
            );
          })}
          <circle cx="100" cy="60" r="25" fill="none" stroke="currentColor" strokeWidth="1" opacity="0">
            <animate attributeName="r" values="18;54" dur="2.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.45;0" dur="2.2s" repeatCount="indefinite" />
          </circle>
        </>
      )}

      {kind === 'human' && (
        <>
          <rect x="22" y="30" width="42" height="48" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="136" y="30" width="42" height="48" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="64" y1="54" x2="136" y2="54" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4">
            <animate attributeName="stroke-dashoffset" values="0;-8" dur="0.6s" repeatCount="indefinite" />
          </line>
          <circle r="4" fill="currentColor">
            <animateMotion dur="1.6s" repeatCount="indefinite">
              <mpath href={`#${pathId}`} />
            </animateMotion>
          </circle>
          <path id={pathId} d="M 64 54 L 136 54" fill="none" />
          <line x1="76" y1="94" x2="124" y2="94" stroke="currentColor" strokeWidth="1" opacity="0.25">
            <animate attributeName="x1" values="76;124;76" dur="2.6s" repeatCount="indefinite" />
            <animate attributeName="x2" values="124;76;124" dur="2.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.1;0.75;0.1" dur="2.6s" repeatCount="indefinite" />
          </line>
        </>
      )}
    </svg>
  );
}
