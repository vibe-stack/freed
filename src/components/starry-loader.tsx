'use client';

import React from 'react';

type Star = {
  x: number;
  y: number;
  r: number; // radius (px)
  b: number; // base brightness 0-1
  p: number; // twinkle phase (radians)
  s: number; // twinkle speed factor
  dx: number; // drift speed x (px/sec)
  dy: number; // drift speed y (px/sec)
  layer: 0 | 1 | 2; // parallax layer: 0 far, 1 mid, 2 near
};

type Shooting = {
  x: number;
  y: number;
  vx: number; // px/sec
  vy: number; // px/sec
  life: number; // seconds
  maxLife: number; // seconds
};

const MIN_DURATION = 3500; // ms
const FADE_OUT_MS = 500; // ms

export const StarryLoader: React.FC<{ onDone?: () => void }> = ({ onDone }) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const starsRef = React.useRef<Star[]>([]);
  const startTimeRef = React.useRef<number>(Date.now());
  const [hiding, setHiding] = React.useState(false);
  const prevTimeRef = React.useRef<number>(performance.now());
  const shootingRef = React.useRef<Shooting | null>(null);
  const nextShootAtRef = React.useRef<number>(performance.now() + 500 + Math.random() * 500);

  // Resize and DPR aware canvas setup
  const resize = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { innerWidth: w, innerHeight: h } = window;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    // Regenerate stars based on area for consistent density
    const area = w * h;
    const density = 0.00018; // stars per px^2 — tuned for performance/looks
    const count = Math.max(80, Math.min(800, Math.floor(area * density)));
    const stars: Star[] = [];
    for (let i = 0; i < count; i++) {
      // Layer distribution: far 50%, mid 35%, near 15%
      const r = Math.random();
      const layer: 0 | 1 | 2 = r < 0.5 ? 0 : r < 0.85 ? 1 : 2;
      // Size slightly scales with layer
      const sizeBase = layer === 0 ? 0.3 : layer === 1 ? 0.5 : 0.8;
      const sizeRand = layer === 0 ? 0.7 : layer === 1 ? 0.9 : 1.2;
      // Drift speeds per layer (px/sec)
      const driftScale = layer === 0 ? 2 : layer === 1 ? 6 : 12;
      // Twinkle speed factor
      const twinkle = layer === 0 ? 0.6 : layer === 1 ? 0.9 : 1.2;
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: sizeBase + Math.random() * sizeRand,
        b: Math.random() * 0.6 + 0.4,
        p: Math.random() * Math.PI * 2,
        s: twinkle * (0.7 + Math.random() * 0.6),
        dx: (Math.random() - 0.5) * driftScale,
        dy: (Math.random() - 0.5) * driftScale,
        layer,
      });
    }
    starsRef.current = stars;
  }, []);

  // Animation loop
  const animate = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.width;
  const h = canvas.height;
  const now = performance.now();
  let dt = (now - prevTimeRef.current) / 1000; // seconds
  if (!isFinite(dt) || dt <= 0) dt = 0.016;
  dt = Math.min(dt, 0.05); // clamp to avoid big jumps on tab switch
  prevTimeRef.current = now;

    // Clear with deep night color
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, w, h);

    // Soft radial vignette for depth
    const grad = ctx.createRadialGradient(
      w * 0.5,
      h * 0.6,
      0,
      w * 0.5,
      h * 0.6,
      Math.max(w, h) * 0.8,
    );
    grad.addColorStop(0, 'rgba(10,12,20,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Stars
    const stars = starsRef.current;
    ctx.save();
    ctx.scale(dpr, dpr);
    const vw = w / dpr;
    const vh = h / dpr;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      // faster, noticeable twinkle (0.4-1Hz)
      s.p += dt * (1 + s.s) * 2;
      // parallax drift with time-based delta
      s.x += s.dx * dt;
      s.y += s.dy * dt;
      // wrap around
      if (s.x < 0) s.x += vw; else if (s.x > vw) s.x -= vw;
      if (s.y < 0) s.y += vh; else if (s.y > vh) s.y -= vh;

      const twinkle = 0.55 + Math.sin(s.p) * 0.45; // 0.1..1.0, more range
      const alpha = Math.max(0.1, Math.min(1, s.b * twinkle));
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      // Draw as small squares (faster than arc)
      const size = Math.max(1, s.r);
      ctx.fillRect(s.x, s.y, size, size);

      // occasional sparkle
      if ((i & 63) === 0) {
        ctx.globalAlpha = alpha * 0.2;
        ctx.fillRect(s.x - size, s.y, size * 3, 1);
        ctx.fillRect(s.x, s.y - size, 1, size * 3);
      }
    }

    // Shooting star: occasional quick streak diagonally
    if (now >= nextShootAtRef.current && !shootingRef.current) {
      // spawn from random top-left region towards bottom-right
      const startX = -vw * 0.1 + Math.random() * vw * 0.3;
      const startY = Math.random() * vh * 0.4;
      const speed = vw * (0.6 + Math.random() * 0.5); // px/sec relative to width
      const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.3; // around 45 degrees
      shootingRef.current = {
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.6 + Math.random() * 0.5,
      };
      // schedule next between 2.5s and 5s from now
      nextShootAtRef.current = now + 500 + Math.random() * 500;
    }

    const shoot = shootingRef.current;
    if (shoot) {
      shoot.life += dt;
      shoot.x += shoot.vx * dt;
      shoot.y += shoot.vy * dt;
      // draw a short trail with fading segments
      const trailLen = 6; // segments
      const baseAlpha = 0.8 * (1 - shoot.life / shoot.maxLife);
      const segDx = -(shoot.vx * 0.02);
      const segDy = -(shoot.vy * 0.02);
      for (let t = 0; t < trailLen; t++) {
        const ax = shoot.x + segDx * t;
        const ay = shoot.y + segDy * t;
        const a = Math.max(0, baseAlpha - t * 0.12);
        if (a <= 0) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ax, ay, 2 + (trailLen - t) * 0.4, 1.5);
      }
      if (
        shoot.life >= shoot.maxLife ||
        shoot.x > vw + 20 ||
        shoot.y > vh + 20
      ) {
        shootingRef.current = null;
      }
    }
    ctx.restore();

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  React.useEffect(() => {
    startTimeRef.current = Date.now();
    resize();
    animate();
    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [animate, resize]);

  // Expose a method to end after min duration
  const end = React.useCallback(() => {
    const elapsed = Date.now() - startTimeRef.current;
    const wait = Math.max(0, MIN_DURATION - elapsed);
    const t = window.setTimeout(() => {
      setHiding(true);
      // allow fade-out before unmount
      window.setTimeout(() => onDone?.(), FADE_OUT_MS);
    }, wait);
    return () => window.clearTimeout(t);
  }, [onDone]);

  React.useEffect(() => end(), [end]);

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[2147483647] flex items-center justify-center select-none pointer-events-auto ${
        hiding ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        transition: `opacity ${FADE_OUT_MS}ms ease-out`,
        background: 'linear-gradient(180deg, #04060B 0%, #070B13 100%)',
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div
        className="relative px-5 py-3 rounded-lg text-white text-lg tracking-wide"
        style={{
          fontWeight: 600,
          letterSpacing: '0.08em',
          textShadow: '0 2px 8px rgba(0,0,0,0.7)',
          pointerEvents: 'none',
          mixBlendMode: 'screen',
        }}
      >
        Loading
      </div>
    </div>
  );
};

export default StarryLoader;
