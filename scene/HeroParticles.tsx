'use client';

import { useEffect, useRef } from 'react';
import styles from './hero-particles.module.css';

const PARTICLE_COUNT = 760;

const PARTICLE_VERTEX = /* glsl */ `
  attribute float a_phase;
  attribute float a_size;
  attribute float a_accent;
  uniform float u_time;
  uniform float u_pixel_ratio;
  uniform float u_aspect;
  uniform vec2 u_displacement;
  uniform vec2 u_velocity;
  varying float v_accent;
  varying float v_alpha;

  void main() {
    vec3 point = position;
    float phase = a_phase;

    // Stable, low-frequency wandering gives the contour a living quality
    // without making it noisy or changing its anatomical read.
    point.x += sin(u_time * (0.18 + a_accent * 0.08) + phase) * 0.012;
    point.y += cos(u_time * (0.14 + a_accent * 0.11) + phase * 1.37) * 0.015;
    point.z += sin(u_time * (0.11 + a_accent * 0.06) + phase * 0.73) * 0.04;

    // The pointer impulse is a smooth field-wide displacement. The CPU-side
    // spring supplies the return; the shader adds a short directional trail.
    point.xy += u_displacement * (0.42 + a_accent * 0.38);
    point.xy -= u_velocity * (0.025 + a_accent * 0.04);
    point.z += length(u_velocity) * 0.06 * sin(phase + u_time * 0.2);

    float horizontalFit = min(1.0, 1.55 / max(u_aspect, 0.7));
    point.xy = point.xy * vec2(0.62 * horizontalFit, 0.86);
    point.x += mix(0.02, 0.48, smoothstep(0.72, 1.8, u_aspect));
    point.y -= 0.025;

    gl_Position = vec4(point, 0.0, 1.0);
    gl_PointSize = u_pixel_ratio * (2.1 + a_size * 2.8 + sin(u_time * 0.32 + phase) * 0.35);
    v_accent = a_accent;
    v_alpha = 0.55 + a_size * 0.4;
  }
`;

const PARTICLE_FRAGMENT = /* glsl */ `
  precision mediump float;
  varying float v_accent;
  varying float v_alpha;

  void main() {
    float distanceToCenter = length(gl_PointCoord - vec2(0.5));
    float softness = 1.0 - smoothstep(0.12, 0.5, distanceToCenter);
    vec3 cool = vec3(0.51, 0.59, 0.67);
    vec3 warm = vec3(0.78, 0.46, 0.32);
    vec3 ink = vec3(0.93, 0.91, 0.86);
    vec3 color = mix(mix(ink, cool, 0.55), warm, smoothstep(0.62, 1.0, v_accent));
    gl_FragColor = vec4(color, softness * v_alpha * 0.86);
  }
`;

interface HeroPoint {
  x: number;
  y: number;
  z: number;
  phase: number;
  size: number;
  accent: number;
}

// This SVG path set is the source vocabulary for the hero. It is deliberately
// an anatomical contour with chambers and an ascending vessel, rather than a
// generic sphere or a random cloud.
const CARDIAC_SVG_PATHS = [
  {
    d: 'M 50 94 C 43 88 15 71 8 47 C 2 27 10 10 26 7 C 37 5 46 12 50 22 C 54 12 63 5 74 7 C 90 10 98 27 92 47 C 85 71 57 88 50 94 Z',
    count: 380,
    z: 0,
    fill: false,
  },
  {
    d: 'M 48 25 C 38 17 24 20 22 33 C 20 45 30 54 46 67 C 49 55 50 40 48 25 Z',
    count: 90,
    z: 0.12,
    fill: false,
  },
  {
    d: 'M 52 25 C 62 17 76 20 78 33 C 80 45 70 54 54 67 C 51 55 50 40 52 25 Z',
    count: 90,
    z: 0.16,
    fill: false,
  },
  {
    d: 'M 50 22 C 49 14 50 7 56 3 C 61 0 67 4 66 10 L 61 25',
    count: 50,
    z: 0.22,
    fill: false,
  },
  {
    d: 'M 43 68 C 47 74 52 74 57 68',
    count: 50,
    z: 0.18,
    fill: false,
  },
  {
    d: 'M 50 94 C 43 88 15 71 8 47 C 2 27 10 10 26 7 C 37 5 46 12 50 22 C 54 12 63 5 74 7 C 90 10 98 27 92 47 C 85 71 57 88 50 94 Z',
    count: 100,
    z: 0.04,
    fill: true,
  },
] as const;

function randomSource(seed = 0x6d2b79f5) {
  let value = seed >>> 0;
  return () => {
    value += 0x9e3779b9;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createCardiacPoints(): HeroPoint[] {
  const random = randomSource();
  const points: HeroPoint[] = [];

  const namespace = 'http://www.w3.org/2000/svg';
  const samplePath = (pathData: string, count: number, z: number, fill: boolean) => {
    const path = document.createElementNS(namespace, 'path');
    path.setAttribute('d', pathData);
    const length = path.getTotalLength();
    if (!Number.isFinite(length) || length <= 0) return;

    for (let index = 0; index < count; index += 1) {
      const sample = path.getPointAtLength((index / count) * length);
      const scale = fill ? 0.2 + Math.sqrt(random()) * 0.78 : 1;
      points.push({
        x: ((sample.x - 50) / 50) * scale + (random() - 0.5) * (fill ? 0.018 : 0.01),
        y: ((50 - sample.y) / 50) * scale + (random() - 0.5) * (fill ? 0.018 : 0.01),
        z: z + (random() - 0.5) * (fill ? 0.12 : 0.05),
        phase: random() * Math.PI * 2,
        size: 0.45 + random() * 0.95,
        accent: fill ? 0.42 + random() * 0.42 : 0.48 + random() * 0.52,
      });
    }
  };

  CARDIAC_SVG_PATHS.forEach((path) => samplePath(path.d, path.count, path.z, path.fill));
  while (points.length < PARTICLE_COUNT) {
    samplePath(CARDIAC_SVG_PATHS[0].d, 1, 0.03, true);
  }

  return points.slice(0, PARTICLE_COUNT);
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('[HeroParticles] shader compilation failed', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, PARTICLE_VERTEX);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, PARTICLE_FRAGMENT);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

export function HeroParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      console.warn('[HeroParticles] WebGL is unavailable');
      return;
    }

    const program = createProgram(gl);
    if (!program) {
      console.warn('[HeroParticles] shader program could not be created');
      return;
    }

    const points = createCardiacPoints();
    const positions = new Float32Array(points.flatMap((point) => [point.x, point.y, point.z]));
    const phases = new Float32Array(points.map((point) => point.phase));
    const sizes = new Float32Array(points.map((point) => point.size));
    const accents = new Float32Array(points.map((point) => point.accent));
    const positionBuffer = gl.createBuffer();
    const phaseBuffer = gl.createBuffer();
    const sizeBuffer = gl.createBuffer();
    const accentBuffer = gl.createBuffer();
    if (!positionBuffer || !phaseBuffer || !sizeBuffer || !accentBuffer) {
      gl.deleteProgram(program);
      return;
    }

    const positionLocation = gl.getAttribLocation(program, 'position');
    const phaseLocation = gl.getAttribLocation(program, 'a_phase');
    const sizeLocation = gl.getAttribLocation(program, 'a_size');
    const accentLocation = gl.getAttribLocation(program, 'a_accent');
    const uniforms = {
      time: gl.getUniformLocation(program, 'u_time'),
      pixelRatio: gl.getUniformLocation(program, 'u_pixel_ratio'),
      aspect: gl.getUniformLocation(program, 'u_aspect'),
      displacement: gl.getUniformLocation(program, 'u_displacement'),
      velocity: gl.getUniformLocation(program, 'u_velocity'),
    };

    const upload = (buffer: WebGLBuffer, data: Float32Array) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    };
    upload(positionBuffer, positions);
    upload(phaseBuffer, phases);
    upload(sizeBuffer, sizes);
    upload(accentBuffer, accents);

    let width = 1;
    let height = 1;
    let pixelRatio = 1;
    let frame = 0;
    let time = 0;
    let lastTime = performance.now();
    let lastPointerX = window.innerWidth * 0.72;
    let lastPointerY = window.innerHeight * 0.5;
    let pointerSeen = false;
    let displacementX = 0;
    let displacementY = 0;
    let velocityX = 0;
    let velocityY = 0;
    let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const draw = (now: number) => {
      const delta = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      time += delta;

      if (!reducedMotion) {
        const damping = Math.exp(-5.2 * delta);
        const returnForce = Math.exp(-4.8 * delta);
        displacementX += velocityX * delta;
        displacementY += velocityY * delta;
        velocityX *= damping;
        velocityY *= damping;
        displacementX *= returnForce;
        displacementY *= returnForce;
      } else {
        displacementX = 0;
        displacementY = 0;
        velocityX = 0;
        velocityY = 0;
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(program);

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, phaseBuffer);
      gl.enableVertexAttribArray(phaseLocation);
      gl.vertexAttribPointer(phaseLocation, 1, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
      gl.enableVertexAttribArray(sizeLocation);
      gl.vertexAttribPointer(sizeLocation, 1, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, accentBuffer);
      gl.enableVertexAttribArray(accentLocation);
      gl.vertexAttribPointer(accentLocation, 1, gl.FLOAT, false, 0, 0);

      gl.uniform1f(uniforms.time, time);
      gl.uniform1f(uniforms.pixelRatio, pixelRatio);
      gl.uniform1f(uniforms.aspect, width / height);
      gl.uniform2f(uniforms.displacement, displacementX, displacementY);
      gl.uniform2f(uniforms.velocity, velocityX, velocityY);
      gl.drawArrays(gl.POINTS, 0, PARTICLE_COUNT);

      frame = window.requestAnimationFrame(draw);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || reducedMotion) return;
      const dx = (event.clientX - lastPointerX) / Math.max(width, 1);
      const dy = (event.clientY - lastPointerY) / Math.max(height, 1);
      if (pointerSeen) {
        velocityX = Math.max(-0.9, Math.min(0.9, velocityX + dx * 5.2));
        velocityY = Math.max(-0.9, Math.min(0.9, velocityY - dy * 5.2));
      }
      pointerSeen = true;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
    };
    const onMotionPreference = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    motionQuery.addEventListener('change', onMotionPreference);
    frame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      motionQuery.removeEventListener('change', onMotionPreference);
      gl.deleteBuffer(positionBuffer);
      gl.deleteBuffer(phaseBuffer);
      gl.deleteBuffer(sizeBuffer);
      gl.deleteBuffer(accentBuffer);
      gl.deleteProgram(program);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.heroParticles} aria-hidden="true" />;
}
