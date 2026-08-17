'use client';

import { useEffect, useRef, useState } from 'react';
import { scrollState } from '@/lib/narrative/store';
import styles from './field-zone.module.css';

export type FieldShape =
  | 'signal'
  | 'pixel'
  | 'features'
  | 'cloud'
  | 'volume'
  | 'contour'
  | 'graph';

interface FieldZoneProps {
  align?: 'left' | 'right';
  shape: FieldShape;
  readout?: string;
  className?: string;
}

interface Particle {
  bx: number;
  by: number;
  bz: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ph: number;
  size: number;
  lit: boolean;
  accent: boolean;
  intensity: number;
}

const PARTICLE_COUNT = 350;

function generateShapePoints(shape: FieldShape, width: number, height: number): Particle[] {
  const particles: Particle[] = [];
  const cx = width * 0.52;
  const cy = height * 0.5;
  const minDim = Math.min(width, height);
  const R = minDim * 0.38;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    let bx = cx;
    let by = cy;
    let bz = 0;
    const t = i / PARTICLE_COUNT;
    const angle = t * Math.PI * 2 * 3;
    const randA = Math.random() * Math.PI * 2;
    const randR = Math.random();

    switch (shape) {
      case 'signal': {
        // Eye contour / signal pulse
        const isCore = Math.random() < 0.16;
        if (isCore) {
          const r = R * 0.15 * Math.sqrt(Math.random());
          bx = cx + Math.cos(randA) * r;
          by = cy + Math.sin(randA) * r;
          bz = (Math.random() - 0.5) * 20;
        } else {
          // Eye curve
          const u = (t * 2 - 1) * Math.PI;
          const eyeWidth = R * 1.1;
          const eyeHeight = R * 0.55 * (1 - Math.pow((i % 175) / 175 * 2 - 1, 2));
          const sign = i % 2 === 0 ? 1 : -1;
          bx = cx + ((i % 175) / 175 - 0.5) * 2 * eyeWidth + (Math.random() - 0.5) * 12;
          by = cy + sign * eyeHeight * (0.6 + Math.random() * 0.4) + (Math.random() - 0.5) * 10;
          bz = Math.sin(u) * 25;
        }
        break;
      }
      case 'pixel': {
        // Pixel matrix grid
        const cols = 20;
        const rows = Math.ceil(PARTICLE_COUNT / cols);
        const col = i % cols;
        const row = Math.floor(i / cols);
        const spacing = minDim * 0.038;
        bx = cx + (col - cols / 2) * spacing + (Math.random() - 0.5) * 3;
        by = cy + (row - rows / 2) * spacing + (Math.random() - 0.5) * 3;
        bz = (Math.sin(col * 0.5) + Math.cos(row * 0.5)) * 10;
        break;
      }
      case 'features': {
        // Feature keypoints and ring detector
        const ring = Math.random();
        if (ring < 0.65) {
          const r = R * (0.55 + Math.random() * 0.45);
          bx = cx + Math.cos(randA) * r;
          by = cy + Math.sin(randA) * r;
          bz = Math.sin(randA * 3) * 20;
        } else {
          const keyNodes = [
            [-0.3, -0.2], [0.2, -0.3], [0.35, 0.2], [-0.25, 0.3], [0, 0],
            [-0.15, -0.05], [0.15, 0.08], [-0.05, 0.22]
          ];
          const node = keyNodes[i % keyNodes.length];
          bx = cx + node[0] * R * 1.5 + (Math.random() - 0.5) * 14;
          by = cy + node[1] * R * 1.5 + (Math.random() - 0.5) * 14;
          bz = (Math.random() - 0.5) * 30;
        }
        break;
      }
      case 'cloud': {
        // 3D Point Cloud / surface geometry
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * v - 1.0);
        const r = R * (0.65 + Math.random() * 0.35);
        const sinPhi = Math.sin(phi);
        bx = cx + r * sinPhi * Math.cos(theta) * 1.2;
        by = cy + r * Math.cos(phi) * 0.85;
        bz = r * sinPhi * Math.sin(theta) * 0.6;
        break;
      }
      case 'volume': {
        // MRI / CT slice stack
        const sliceCount = 7;
        const sliceIdx = i % sliceCount;
        const sliceY = (sliceIdx / (sliceCount - 1) - 0.5) * R * 1.1;
        const sliceR = R * Math.sqrt(Math.max(0.1, 1 - Math.pow(sliceIdx / 3 - 1, 2))) * 0.9;
        const a = Math.random() * Math.PI * 2;
        const rad = Math.sqrt(Math.random()) * sliceR;
        bx = cx + Math.cos(a) * rad * 1.25;
        by = cy + sliceY + (Math.random() - 0.5) * 4;
        bz = Math.sin(a) * rad * 0.5;
        break;
      }
      case 'contour': {
        // Cardiac anatomical contour
        const phi = t * Math.PI * 2;
        const sin = Math.sin(phi);
        const cos = Math.cos(phi);
        // Cardiac shape parametric equation
        const heartX = 16 * sin * sin * sin / 18;
        const heartY = -(13 * cos - 5 * Math.cos(2 * phi) - 2 * Math.cos(3 * phi) - Math.cos(4 * phi)) / 19;
        const scale = R * (0.8 + Math.random() * 0.25);
        bx = cx + heartX * scale + (Math.random() - 0.5) * 8;
        by = cy + heartY * scale + (Math.random() - 0.5) * 8;
        bz = (Math.random() - 0.5) * 35;
        break;
      }
      case 'graph': {
        // Node-edge network
        const nodeCount = 12;
        const nodeIdx = i % nodeCount;
        const nodeAngle = (nodeIdx / nodeCount) * Math.PI * 2;
        const nodeR = R * (0.45 + (nodeIdx % 3) * 0.25);
        const nodeX = cx + Math.cos(nodeAngle) * nodeR;
        const nodeY = cy + Math.sin(nodeAngle) * nodeR * 0.8;
        const nextNodeIdx = (nodeIdx + 1 + (i % 3)) % nodeCount;
        const nextAngle = (nextNodeIdx / nodeCount) * Math.PI * 2;
        const nextR = R * (0.45 + (nextNodeIdx % 3) * 0.25);
        const nextX = cx + Math.cos(nextAngle) * nextR;
        const nextY = cy + Math.sin(nextAngle) * nextR * 0.8;
        const lerpT = Math.random();
        bx = nodeX + (nextX - nodeX) * lerpT + (Math.random() - 0.5) * 6;
        by = nodeY + (nextY - nodeY) * lerpT + (Math.random() - 0.5) * 6;
        bz = (Math.random() - 0.5) * 30;
        break;
      }
      default: {
        bx = cx + (Math.random() - 0.5) * R * 1.5;
        by = cy + (Math.random() - 0.5) * R * 1.5;
        bz = 0;
      }
    }

    const isLit = Math.random() < 0.22;
    const isAccent = isLit && Math.random() < 0.5;

    particles.push({
      bx,
      by,
      bz,
      x: bx,
      y: by,
      z: bz,
      vx: 0,
      vy: 0,
      vz: 0,
      ph: Math.random() * Math.PI * 2,
      size: isLit ? 1.4 + Math.random() * 0.8 : 0.85 + Math.random() * 0.45,
      lit: isLit,
      accent: isAccent,
      intensity: isLit ? 0.9 : 0.42,
    });
  }

  return particles;
}

export function FieldZone({ align = 'right', shape, readout, className = '' }: FieldZoneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { rootMargin: '120px 0px 120px 0px', threshold: 0.01 },
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles: Particle[] = [];
    let animationFrameId: number;
    let time = 0;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      width = canvas.clientWidth || 600;
      height = canvas.clientHeight || 500;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = generateShapePoints(shape, width, height);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    let lastTime = performance.now();

    const render = (now: number) => {
      if (!isVisible && !reduceMotion) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const dt = Math.min(0.064, Math.max(0.008, (now - lastTime) / 1000));
      lastTime = now;
      time += dt * 1.2;

      ctx.clearRect(0, 0, width, height);

      // Velocity-gated pointer response
      const pointerEnergy = reduceMotion ? 0 : scrollState.pointerEnergy;
      const ptrX = ((scrollState.pointerX + 1) * 0.5) * width;
      const ptrY = ((-scrollState.pointerY + 1) * 0.5) * height;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Organic wandering / breathing
        const wanderX = Math.sin(time * 0.85 + p.ph) * 1.8 + Math.cos(time * 0.4 + p.ph * 2.1) * 0.8;
        const wanderY = Math.cos(time * 0.75 + p.ph * 1.2) * 1.8 + Math.sin(time * 0.5 + p.ph * 1.7) * 0.8;

        if (pointerEnergy > 0.01 && !reduceMotion) {
          const dx = p.bx - ptrX;
          const dy = p.by - ptrY;
          const dist = Math.hypot(dx, dy) || 1;
          const maxDist = 220;

          if (dist < maxDist) {
            const force = (1 - dist / maxDist) * pointerEnergy * 24;
            p.vx += (dx / dist) * force * dt * 8;
            p.vy += (dy / dist) * force * dt * 8;
          }
        }

        // Damping and spring back to base
        p.vx *= Math.pow(0.88, dt * 60);
        p.vy *= Math.pow(0.88, dt * 60);

        const currentX = p.bx + wanderX + p.vx;
        const currentY = p.by + wanderY + p.vy;

        p.x = currentX;
        p.y = currentY;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);

        if (p.accent) {
          ctx.fillStyle = `rgba(228, 165, 74, ${p.intensity})`; // Phosphor amber
        } else if (p.lit) {
          ctx.fillStyle = `rgba(231, 228, 216, 0.88)`; // Ink
        } else {
          ctx.fillStyle = `rgba(231, 228, 216, ${p.intensity})`; // Ink faint / dim
        }

        ctx.fill();
      }

      if (!reduceMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    if (reduceMotion) {
      render(performance.now());
    } else {
      animationFrameId = requestAnimationFrame(render);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [shape, isVisible]);

  const isLeft = align === 'left';
  const defaultReadout = `FIELD ▸ ${shape.toUpperCase()} · N=350 · 60FPS`;

  return (
    <div
      ref={containerRef}
      className={`${styles.fieldzone} ${isLeft ? styles.fieldzoneLeft : ''} ${className}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} />

      {/* Phosphor sweep gradient */}
      <div className={styles.sweep} />

      {/* Independent floating corner fiducials (+ marks) */}
      <span className={`${styles.fid} ${isLeft ? styles.fidTopLeft : styles.fidTopRight}`} />
      <span className={`${styles.fid} ${isLeft ? styles.fidBottomLeft : styles.fidBottomRight}`} />

      {/* Floating monospace data readout */}
      <div className={`${styles.readout} ${isLeft ? styles.readoutLeft : styles.readoutRight}`}>
        <span className={styles.readoutData}>{readout || defaultReadout}</span>
      </div>

      {/* Vertical scale ruler hugging outer field edge */}
      <div className={`${styles.vscale} ${isLeft ? styles.vscaleLeft : styles.vscaleRight}`}>
        {Array.from({ length: 20 }).map((_, i) => (
          <i key={i} className={i % 4 === 0 ? styles.vscaleMajor : styles.vscaleMinor} />
        ))}
      </div>
    </div>
  );
}
