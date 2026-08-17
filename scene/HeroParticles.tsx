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

  // The outer contour uses a normalized cardiac curve rather than a generic
  // primitive. Interior chamber arcs keep it legible as a medical/CV signal.
  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const angle = (index / PARTICLE_COUNT) * Math.PI * 2;
    const contour = index < PARTICLE_COUNT * 0.58;
    const t = contour ? angle : random() * Math.PI * 2;
    const sin = Math.sin(t);
    const cos = Math.cos(t);
    const heartX = 16 * sin * sin * sin;
    const heartY = 13 * cos - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const fill = contour ? 1 : Math.sqrt(random()) * 0.92;
    const chamber = index % 5 === 0 ? 0.04 : 0;
    const x = (heartX / 18) * fill + chamber;
    const y = (heartY / 19) * fill + (random() - 0.5) * (contour ? 0.018 : 0.08);

    points.push({
      x,
      y,
      z: (random() - 0.5) * (contour ? 0.08 : 0.28),
      phase: random() * Math.PI * 2,
      size: 0.35 + random() * 0.8,
      accent: random(),
    });
  }

  // A pair of chamber-like curves gives the silhouette a scan/feature-map
  // vocabulary without introducing a second object or a decorative sphere.
  const chamberCurves = [
    { cx: -0.25, cy: 0.08, rx: 0.23, ry: 0.34 },
    { cx: 0.23, cy: -0.05, rx: 0.2, ry: 0.3 },
  ];
  chamberCurves.forEach(({ cx, cy, rx, ry }, curveIndex) => {
    for (let index = 0; index < 38; index += 1) {
      const angle = (index / 38) * Math.PI * 2;
      points[(curveIndex * 38 + index) % points.length] = {
        ...points[(curveIndex * 38 + index) % points.length],
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry,
        z: 0.12 + curveIndex * 0.025,
        accent: 0.72 + curveIndex * 0.08,
      };
    }
  });

  return points;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
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
    if (!gl) return;

    const program = createProgram(gl);
    if (!program) return;

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
