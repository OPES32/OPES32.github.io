/**
 * VCT / THE CHAMPIONS FREQUENCY — live scene renderer.
 *
 * Six scenes, six spatial languages:
 *   2021 RED CHAPEL      arena light, glass, heartbeat sonar
 *   2022 PYRE            fire wall, embers, smoke, heat
 *   2023 TIMEBREAK       clock rings, perspective grid, digital glitch
 *   2024 CHROME PRISM    mirrored shards, lasers, specular floor
 *   2025 BULLET TIME     tactical grid, tracers, reticle, scanlines
 *   2026 TOTAL ECLIPSE   corona, solar flares, ash, molten fissures
 *
 * One canvas, no dependencies. The renderer reacts to the live analyser
 * through setLevels(); scene events are triggered from bass transients and
 * a low-frequency fallback pulse.
 */

const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const random = (min, max) => min + Math.random() * (max - min);

const hexToRgba = (hex, alpha = 1) => {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((part) => part + part).join('')
    : normalized;
  const number = Number.parseInt(value, 16);
  const r = (number >> 16) & 255;
  const g = (number >> 8) & 255;
  const b = number & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export class SignalField {
  constructor(canvas, { reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.reducedMotion = reducedMotion;
    this.track = null;
    this.paper = '#f4efe5';
    this.colors = {
      primary: '#ffad42',
      secondary: '#ff5b2b',
      tertiary: '#6b3210',
      ink: '#080604'
    };

    this.mode = 'eclipse';
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.center = { x: 0, y: 0 };
    this.stageRect = null;
    this.levels = { bass: 0, mid: 0, high: 0, energy: 0 };
    this.energy = 0;
    this.clock = 0;
    this.dt = 0;
    this.beat = 0;
    this.shock = 0;
    this.flash = 0;
    this.glitch = 0;
    this.flare = 0;
    this.lastBass = 0;
    this.beatCooldown = 0;
    this.lastBeatAt = -4;
    this.running = false;
    this.raf = 0;
    this.lastFrame = 0;

    this.motes = [];
    this.shards = [];
    this.embers = [];
    this.smoke = [];
    this.digits = [];
    this.glints = [];
    this.ash = [];
    this.tracers = [];

    this.handleResize = this.handleResize.bind(this);
    this.frame = this.frame.bind(this);

    this.resize();
    window.addEventListener('resize', this.handleResize, { passive: true });
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.8);

    if (width === this.width && height === this.height && dpr === this.dpr) return;

    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const compact = width < 820;
    this.center = {
      x: width * (compact ? 0.55 : 0.64),
      y: height * (compact ? 0.31 : 0.46)
    };
    this.syncCenter();
    this.buildParticles();

    if (this.reducedMotion) this.drawStatic();
  }

  syncCenter() {
    const mark = document.querySelector('#markButton');
    if (mark) {
      const rect = mark.getBoundingClientRect();
      if (rect.width > 1 && rect.height > 1) {
        this.center = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };
      }
    }

    const stage = document.querySelector('#stage');
    if (stage) {
      const rect = stage.getBoundingClientRect();
      if (rect.width > 1 && rect.height > 1) {
        this.stageRect = {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        };
      }
    }
  }

  handleResize() {
    this.resize();
  }

  setTrack(track) {
    this.track = track;
    this.mode = track.fx.mode;
    this.colors = track.fx;
    this.clock = 0;
    this.energy = 0;
    this.beat = 0;
    this.shock = 0;
    this.flash = 0.85;
    this.glitch = 0;
    this.flare = 0;
    this.lastBass = 0;
    this.beatCooldown = 0;
    this.lastBeatAt = -1;
    this.syncCenter();
    this.buildParticles();
    if (this.reducedMotion || !this.running) this.drawStatic();
  }

  setLevels(levels) {
    this.levels = levels;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastFrame = performance.now();
    if (this.reducedMotion) {
      this.drawStatic();
      return;
    }
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  frame(now) {
    if (!this.running) return;
    const dt = clamp((now - this.lastFrame) / 1000, 0.001, 0.05);
    this.lastFrame = now;
    this.dt = dt;
    this.clock += dt;

    this.energy += (this.levels.energy - this.energy) * 0.1;
    this.beat = Math.max(0, this.beat - dt * 3.1);
    this.shock = Math.max(0, this.shock - dt * 1.1);
    this.flash = Math.max(0, this.flash - dt * 2.4);
    this.glitch = Math.max(0, this.glitch - dt * 3.6);
    this.flare = Math.max(0, this.flare - dt * 2.4);
    this.beatCooldown = Math.max(0, this.beatCooldown - dt);

    this.detectBeat(dt);
    this.draw(dt);

    this.raf = requestAnimationFrame(this.frame);
  }

  detectBeat(dt) {
    const bass = this.levels.bass;
    const rising = bass > 0.3 && bass - this.lastBass > 0.022;
    const pulseFallback = this.clock - this.lastBeatAt > 1.15 && this.energy > 0.14;
    if ((rising && this.beatCooldown === 0 && this.clock > 0.12) || pulseFallback) {
      this.triggerBeat();
    }
    this.lastBass = bass;
  }

  triggerBeat() {
    this.beat = 1;
    this.shock = 1;
    this.flash = 0.65;
    this.glitch = 1;
    this.beatCooldown = 0.2;
    this.lastBeatAt = this.clock;
    if (this.mode === 'ember') this.spawnEmberBurst(18);
    if (this.mode === 'tracer') this.spawnTracer();
    if (this.mode === 'eclipse') this.flare = 1;
    if (this.mode === 'chrome') this.flash = 0.8;
  }

  draw(dt) {
    if (!this.track) return;
    const { ctx, width: w, height: h, center: c } = this;
    ctx.clearRect(0, 0, w, h);

    const punch = 1 + this.energy * 0.014 + this.beat * 0.018;
    const shake = this.beat * 2;
    ctx.save();
    ctx.translate(
      c.x + (Math.random() - 0.5) * shake,
      c.y + (Math.random() - 0.5) * shake
    );
    ctx.scale(punch, punch);
    ctx.translate(-c.x, -c.y);

    this.drawBackdrop();

    switch (this.mode) {
      case 'dust':
        this.drawDustScene(dt);
        break;
      case 'ember':
        this.drawEmberScene(dt);
        break;
      case 'clock':
        this.drawClockScene(dt);
        break;
      case 'chrome':
        this.drawChromeScene(dt);
        break;
      case 'tracer':
        this.drawTracerScene(dt);
        break;
      case 'eclipse':
      default:
        this.drawEclipseScene(dt);
        break;
    }

    ctx.restore();
    this.drawReadability();
    this.drawScreenFlash();
  }

  drawStatic() {
    if (!this.track) return;
    this.dt = 0;
    this.energy = 0.28;
    this.beat = 0;
    this.shock = 0;
    this.flash = 0;
    this.glitch = 0;
    this.flare = 0;
    this.draw(0);
  }

  drawBackdrop() {
    const { ctx, width: w, height: h, center: c } = this;
    const primary = this.colors.primary;
    const secondary = this.colors.secondary;

    ctx.fillStyle = this.colors.ink;
    ctx.fillRect(0, 0, w, h);

    const radius = Math.max(w, h) * 0.78;
    const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, radius);
    glow.addColorStop(0, hexToRgba(primary, 0.16 + this.energy * 0.055));
    glow.addColorStop(0.28, hexToRgba(primary, 0.065));
    glow.addColorStop(0.62, hexToRgba(secondary, 0.025));
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    const top = ctx.createLinearGradient(0, 0, 0, h);
    top.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
    top.addColorStop(0.35, 'rgba(0, 0, 0, 0)');
    top.addColorStop(1, 'rgba(0, 0, 0, 0.24)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, w, h);
  }

  drawReadability() {
    const { ctx, width: w, height: h } = this;

    // Keep the lower-left title area legible over flames, grids and tracers.
    const left = ctx.createLinearGradient(0, 0, w * 0.42, 0);
    left.addColorStop(0, 'rgba(2, 2, 2, 0.47)');
    left.addColorStop(0.42, 'rgba(2, 2, 2, 0.12)');
    left.addColorStop(1, 'rgba(2, 2, 2, 0)');
    ctx.fillStyle = left;
    ctx.fillRect(0, 0, w * 0.46, h);

    const bottom = ctx.createLinearGradient(0, h * 0.47, 0, h);
    bottom.addColorStop(0, 'rgba(2, 2, 2, 0)');
    bottom.addColorStop(0.72, 'rgba(2, 2, 2, 0.14)');
    bottom.addColorStop(1, 'rgba(2, 2, 2, 0.36)');
    ctx.fillStyle = bottom;
    ctx.fillRect(0, h * 0.47, w, h * 0.53);

    const edges = ctx.createRadialGradient(
      this.center.x,
      this.center.y,
      Math.min(w, h) * 0.18,
      this.center.x,
      this.center.y,
      Math.max(w, h) * 0.72
    );
    edges.addColorStop(0, 'rgba(0, 0, 0, 0)');
    edges.addColorStop(0.64, 'rgba(0, 0, 0, 0.08)');
    edges.addColorStop(1, 'rgba(0, 0, 0, 0.48)');
    ctx.fillStyle = edges;
    ctx.fillRect(0, 0, w, h);
  }

  drawScreenFlash() {
    if (this.flash <= 0.01) return;
    const { ctx, width: w, height: h } = this;
    const g = ctx.createRadialGradient(
      this.center.x,
      this.center.y,
      0,
      this.center.x,
      this.center.y,
      Math.max(w, h) * 0.72
    );
    g.addColorStop(0, hexToRgba(this.colors.primary, 0.055 * this.flash));
    g.addColorStop(0.55, hexToRgba(this.colors.secondary, 0.018 * this.flash));
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  drawShockwave(radiusScale = 1, color = this.colors.primary) {
    if (this.shock <= 0) return;
    const { ctx, width: w, height: h, center: c } = this;
    const min = Math.min(w, h);
    const p = 1 - this.shock;
    const alpha = this.shock * 0.28;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = hexToRgba(color, alpha);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(c.x, c.y, min * (0.09 + p * 0.46 * radiusScale), 0, TAU);
    ctx.stroke();

    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = hexToRgba(this.paper, alpha * 0.55);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(c.x, c.y, min * (0.065 + p * 0.39 * radiusScale), 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  drawDustScene(dt) {
    const { ctx, width: w, height: h, center: c } = this;
    const min = Math.min(w, h);
    const primary = this.colors.primary;
    const secondary = this.colors.secondary;
    const t = this.clock;

    // Cathedral floor and converging aisles.
    ctx.save();
    ctx.translate(c.x, c.y + min * 0.23);
    const floor = ctx.createLinearGradient(0, 0, 0, min * 0.52);
    floor.addColorStop(0, hexToRgba(secondary, 0.1));
    floor.addColorStop(0.55, hexToRgba(primary, 0.035));
    floor.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = floor;
    ctx.fillRect(-w, 0, w * 2, min * 0.54);

    ctx.strokeStyle = hexToRgba(primary, 0.1);
    ctx.lineWidth = 0.8;
    for (let i = -8; i <= 8; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(i * w * 0.075, min * 0.45);
      ctx.stroke();
    }
    for (let i = 1; i <= 6; i += 1) {
      ctx.globalAlpha = 0.65 - i * 0.07;
      ctx.beginPath();
      ctx.ellipse(0, min * 0.07 * i, min * 0.1 * (1 + i * 0.22), min * 0.025 * i, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    // Five overhead spotlights.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 5; i += 1) {
      const x = w * (0.08 + i * 0.21) + Math.sin(t * 0.17 + i) * 12;
      const beam = ctx.createLinearGradient(x, 0, x + w * 0.06, h * 0.79);
      beam.addColorStop(0, hexToRgba(i === 2 ? this.paper : primary, 0.045));
      beam.addColorStop(0.55, hexToRgba(primary, 0.02));
      beam.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(x - 16, -20);
      ctx.lineTo(x + 34, -20);
      ctx.lineTo(x + w * 0.19, h * 0.79);
      ctx.lineTo(x - w * 0.16, h * 0.79);
      ctx.closePath();
      ctx.fill();
    }

    // A vertical shaft of light behind the emblem.
    const column = ctx.createLinearGradient(c.x - min * 0.06, 0, c.x + min * 0.06, h);
    column.addColorStop(0, hexToRgba(this.paper, 0));
    column.addColorStop(0.36, hexToRgba(primary, 0.085));
    column.addColorStop(0.82, hexToRgba(primary, 0.02));
    column.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = column;
    ctx.fillRect(c.x - min * 0.065, 0, min * 0.13, h);
    ctx.restore();

    // Heartbeat sonar rings and the edge of a broken arena halo.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const base = min * 0.16;
    for (let i = 0; i < 5; i += 1) {
      const phase = (t * 0.14 + i / 5) % 1;
      ctx.strokeStyle = hexToRgba(primary, (1 - phase) * (0.24 + this.energy * 0.24));
      ctx.lineWidth = i === 0 ? 1.6 : 0.9;
      ctx.beginPath();
      ctx.arc(c.x, c.y, base * (0.55 + phase * 2.65), 0, TAU);
      ctx.stroke();
    }
    ctx.strokeStyle = hexToRgba(this.paper, 0.16);
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i += 1) {
      const start = t * 0.045 + i * 1.54;
      ctx.beginPath();
      ctx.arc(c.x, c.y, min * 0.36, start, start + 0.54);
      ctx.stroke();
    }
    ctx.restore();

    // Dust.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const p of this.motes) {
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      if (p.y > h + 8) {
        p.y = -8;
        p.x = random(0, w);
      }
      if (p.x < -8) p.x = w + 8;
      if (p.x > w + 8) p.x = -8;
      const shimmer = 0.45 + Math.sin(t * 0.7 + p.phase) * 0.35;
      ctx.fillStyle = hexToRgba(primary, p.alpha * shimmer * (0.5 + this.energy));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // Slivers of arena glass.
    ctx.save();
    for (const p of this.shards) {
      p.y += p.vy * dt * 60 * (0.65 + this.energy * 0.5);
      p.x += p.vx * dt * 60;
      p.rotation += p.spin * dt;
      if (p.y > h + 30) {
        p.y = -30;
        p.x = random(0, w);
      }
      const shimmer = 0.58 + Math.sin(t * 0.8 + p.phase) * 0.42;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      const glass = ctx.createLinearGradient(-p.size, 0, p.size, 0);
      glass.addColorStop(0, hexToRgba(this.paper, 0.02));
      glass.addColorStop(0.5, hexToRgba(this.paper, p.alpha * shimmer));
      glass.addColorStop(1, hexToRgba(primary, p.alpha * 0.45 * shimmer));
      ctx.fillStyle = glass;
      ctx.strokeStyle = hexToRgba(primary, 0.16 * shimmer);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(-p.size, 0);
      ctx.lineTo(-p.size * 0.18, -p.height);
      ctx.lineTo(p.size, 0);
      ctx.lineTo(p.size * 0.2, p.height);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    this.drawShockwave(1.1);
  }

  drawEmberScene(dt) {
    const { ctx, width: w, height: h, center: c } = this;
    const min = Math.min(w, h);
    const primary = this.colors.primary;
    const secondary = this.colors.secondary;
    const t = this.clock;
    const baseY = h * 0.88;

    // Heat bloom.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const bloom = ctx.createRadialGradient(c.x, baseY, 0, c.x, baseY, min * 0.78);
    bloom.addColorStop(0, hexToRgba(secondary, 0.14 + this.energy * 0.08));
    bloom.addColorStop(0.4, hexToRgba(primary, 0.055));
    bloom.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, w, h);

    // Smoke columns, normal-blended so they actually read as darkness.
    ctx.globalCompositeOperation = 'source-over';
    for (const p of this.smoke) {
      p.y -= p.vy * dt * 60;
      if (p.y < -p.size) {
        p.y = h + p.size;
        p.x = random(0, w);
      }
      const smoke = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      smoke.addColorStop(0, `rgba(9, 4, 3, ${p.alpha * 0.75})`);
      smoke.addColorStop(0.62, `rgba(9, 4, 3, ${p.alpha * 0.35})`);
      smoke.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = smoke;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';

    // A central pyre, rising in full view behind the emblem.
    const pyreBase = h * 0.83;
    const pyreTop = c.y - min * 0.12;
    const pyreWidth = min * (0.12 + this.energy * 0.02 + this.beat * 0.02);
    const fireBand = ctx.createLinearGradient(0, pyreBase - min * 0.16, 0, pyreBase + 16);
    fireBand.addColorStop(0, hexToRgba(secondary, 0));
    fireBand.addColorStop(0.55, hexToRgba(primary, 0.08));
    fireBand.addColorStop(0.82, hexToRgba(secondary, 0.14));
    fireBand.addColorStop(1, hexToRgba(secondary, 0));
    ctx.fillStyle = fireBand;
    ctx.fillRect(0, pyreBase - min * 0.16, w, min * 0.2);
    const pyreBaseGlow = ctx.createRadialGradient(
      c.x,
      pyreBase,
      0,
      c.x,
      pyreBase,
      pyreWidth * 2.2
    );
    pyreBaseGlow.addColorStop(0, hexToRgba(secondary, 0.34));
    pyreBaseGlow.addColorStop(0.4, hexToRgba(primary, 0.14));
    pyreBaseGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = pyreBaseGlow;
    ctx.fillRect(c.x - pyreWidth * 2.4, pyreBase - pyreWidth * 2.4, pyreWidth * 4.8, pyreWidth * 4.8);

    const pyre = ctx.createLinearGradient(c.x, pyreBase, c.x, pyreTop);
    pyre.addColorStop(0, hexToRgba(secondary, 0.22));
    pyre.addColorStop(0.25, hexToRgba(primary, 0.16));
    pyre.addColorStop(0.65, hexToRgba(secondary, 0.07));
    pyre.addColorStop(1, hexToRgba(secondary, 0));
    ctx.fillStyle = pyre;
    ctx.beginPath();
    ctx.moveTo(c.x - pyreWidth, pyreBase);
    ctx.bezierCurveTo(
      c.x - pyreWidth * 0.9,
      pyreBase - min * 0.27,
      c.x - pyreWidth * 0.28,
      pyreTop + min * 0.16,
      c.x + Math.sin(t * 0.7) * min * 0.02,
      pyreTop
    );
    ctx.bezierCurveTo(
      c.x + pyreWidth * 0.5,
      pyreTop + min * 0.22,
      c.x + pyreWidth * 0.88,
      pyreBase - min * 0.24,
      c.x + pyreWidth,
      pyreBase
    );
    ctx.closePath();
    ctx.fill();

    // Ragged flame tongues climbing the pyre.
    for (let i = 0; i < 8; i += 1) {
      const offset = ((i + 0.5) / 8 - 0.5) * pyreWidth * 1.15;
      const height = (pyreBase - pyreTop) * (0.48 + 0.36 * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 1.8)));
      const tongue = ctx.createLinearGradient(c.x + offset, pyreBase, c.x + offset, pyreBase - height);
      tongue.addColorStop(0, hexToRgba(secondary, 0));
      tongue.addColorStop(0.35, hexToRgba(primary, 0.2));
      tongue.addColorStop(0.8, hexToRgba(secondary, 0.08));
      tongue.addColorStop(1, hexToRgba(secondary, 0));
      ctx.fillStyle = tongue;
      ctx.beginPath();
      ctx.moveTo(c.x + offset - 15, pyreBase);
      ctx.quadraticCurveTo(
        c.x + offset - 8 + Math.sin(t * 2.1 + i) * 10,
        pyreBase - height * 0.56,
        c.x + offset + Math.sin(t * 1.5 + i * 2) * 27,
        pyreBase - height
      );
      ctx.quadraticCurveTo(
        c.x + offset + 14,
        pyreBase - height * 0.4,
        c.x + offset + 18,
        pyreBase
      );
      ctx.closePath();
      ctx.fill();
    }

    // Sparks lifted out of the pyre.
    for (let i = 0; i < 32; i += 1) {
      const phase = (t * (0.2 + (i % 4) * 0.04) + i * 0.137) % 1;
      const sx = c.x + Math.sin(i * 2.3 + t * 0.4) * pyreWidth * (1.3 - phase * 0.8);
      const sy = pyreBase - phase * (pyreBase - pyreTop) * 1.12;
      const spark = (1 - phase) * (0.35 + this.energy * 0.4);
      ctx.fillStyle = hexToRgba(i % 3 === 0 ? this.paper : secondary, spark);
      ctx.beginPath();
      ctx.arc(sx, sy, 0.8 + (i % 4) * 0.35, 0, TAU);
      ctx.fill();
    }

    const pyreCore = ctx.createLinearGradient(c.x, pyreBase, c.x, pyreTop + min * 0.22);
    pyreCore.addColorStop(0, hexToRgba(this.paper, 0.2));
    pyreCore.addColorStop(0.55, hexToRgba(secondary, 0.16));
    pyreCore.addColorStop(1, hexToRgba(secondary, 0));
    ctx.fillStyle = pyreCore;
    ctx.beginPath();
    ctx.moveTo(c.x - pyreWidth * 0.3, pyreBase);
    ctx.quadraticCurveTo(
      c.x - pyreWidth * 0.2,
      pyreBase - min * 0.28,
      c.x + Math.sin(t * 1.1) * min * 0.03,
      pyreTop + min * 0.32
    );
    ctx.quadraticCurveTo(
      c.x + pyreWidth * 0.28,
      pyreBase - min * 0.2,
      c.x + pyreWidth * 0.3,
      pyreBase
    );
    ctx.closePath();
    ctx.fill();

    // Fire crown licking around the emblem.
    for (let i = 0; i < 9; i += 1) {
      const angle = (i / 9) * TAU + t * 0.08;
      const reach = min * (0.22 + Math.sin(t * 0.9 + i * 1.7) * 0.025 + this.beat * 0.025);
      ctx.strokeStyle = hexToRgba(i % 2 ? secondary : primary, 0.28 + this.beat * 0.2);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(c.x, c.y, reach, angle, angle + 0.22);
      ctx.stroke();
    }

    // A wall of fire along the lower edge.
    const flames = this.width < 820 ? 14 : 26;
    for (let i = 0; i < flames; i += 1) {
      const x = (i + 0.5) / flames * w + Math.sin(t * 0.55 + i * 1.9) * w * 0.008;
      const flameHeight = min * (
        0.085
        + 0.1 * (0.5 + 0.5 * Math.sin(t * 1.15 + i * 1.41))
        + this.energy * 0.1
        + this.beat * 0.065
      );
      const sway = Math.sin(t * 1.7 + i) * w * 0.012;
      const flame = ctx.createLinearGradient(x, baseY, x, baseY - flameHeight);
      flame.addColorStop(0, hexToRgba(secondary, 0));
      flame.addColorStop(0.18, hexToRgba(primary, 0.32));
      flame.addColorStop(0.55, hexToRgba(secondary, 0.2));
      flame.addColorStop(1, hexToRgba(secondary, 0));
      ctx.fillStyle = flame;
      ctx.beginPath();
      ctx.moveTo(x - 32, baseY + 10);
      ctx.quadraticCurveTo(x - 18, baseY - flameHeight * 0.46, x + sway, baseY - flameHeight);
      ctx.quadraticCurveTo(x + 26, baseY - flameHeight * 0.38, x + 34, baseY + 10);
      ctx.closePath();
      ctx.fill();

      const core = ctx.createLinearGradient(x, baseY, x, baseY - flameHeight * 0.62);
      core.addColorStop(0, hexToRgba(this.paper, 0.22));
      core.addColorStop(0.6, hexToRgba(secondary, 0.15));
      core.addColorStop(1, hexToRgba(secondary, 0));
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.moveTo(x - 8, baseY + 6);
      ctx.quadraticCurveTo(x + sway * 0.5, baseY - flameHeight * 0.38, x + 3, baseY - flameHeight * 0.68);
      ctx.quadraticCurveTo(x + 12, baseY - flameHeight * 0.24, x + 14, baseY + 6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Fire arcs spiralling around the emblem.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.translate(c.x, c.y);
    for (let i = 0; i < 4; i += 1) {
      const a = t * (0.22 + i * 0.06) + i * 2.2;
      ctx.strokeStyle = hexToRgba(i === 1 ? secondary : primary, 0.32 - i * 0.045);
      ctx.lineWidth = 1.8 - i * 0.25;
      ctx.beginPath();
      ctx.arc(0, 0, min * (0.22 + i * 0.052) * (1 + this.beat * 0.04), a, a + 1.5);
      ctx.stroke();
    }
    ctx.restore();

    // Rising embers.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.embers) {
      const px = p.x;
      const py = p.y;
      p.x += (p.vx + Math.sin(t * 0.8 + p.phase) * p.drift * 0.11) * dt * 60;
      p.y += p.vy * dt * 60 * (1 + this.energy * 0.38);
      p.life -= dt * 0.12;
      if (p.y < -20 || p.life <= 0) {
        p.x = random(0, w);
        p.y = h + random(4, 80);
        p.life = random(0.55, 1.2);
      }
      const alpha = p.alpha * clamp(p.life, 0, 1);
      const trail = ctx.createLinearGradient(px, py, p.x, p.y);
      trail.addColorStop(0, hexToRgba(secondary, 0));
      trail.addColorStop(1, hexToRgba(primary, alpha));
      ctx.strokeStyle = trail;
      ctx.lineWidth = p.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.restore();

    // A sharp horizon line.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = hexToRgba(secondary, 0.16 + this.energy * 0.12);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.67);
    ctx.lineTo(w, h * 0.67);
    ctx.stroke();
    ctx.restore();

    this.drawShockwave(1.25, secondary);
  }

  drawClockScene(dt) {
    const { ctx, width: w, height: h, center: c } = this;
    const min = Math.min(w, h);
    const primary = this.colors.primary;
    const secondary = this.colors.secondary;
    const t = this.clock;

    // A perspective floor made of time lines.
    ctx.save();
    ctx.translate(c.x, c.y + min * 0.24);
    ctx.strokeStyle = hexToRgba(primary, 0.105);
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 14; i += 1) {
      const y = Math.pow(i / 14, 1.8) * min * 0.44;
      ctx.globalAlpha = 0.2 + i * 0.035;
      ctx.beginPath();
      ctx.moveTo(-w * 0.7, y);
      ctx.lineTo(w * 0.7, y);
      ctx.stroke();
    }
    for (let i = -7; i <= 7; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(i * w * 0.12, min * 0.46);
      ctx.stroke();
    }
    ctx.restore();

    // A big digital timestamp burning through the room.
    const stageRight = this.stageRect ? this.stageRect.right : w * 0.9;
    const stageLeft = this.stageRect ? this.stageRect.left : 0;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.font = '400 10vw "Anton", "Arial Narrow", sans-serif';
    ctx.fillStyle = hexToRgba(primary, 0.055);
    ctx.textAlign = 'right';
    ctx.fillText('T-00:29', stageRight - 26, h * 0.23);
    ctx.font = '500 11px "IBM Plex Mono", monospace';
    ctx.fillStyle = hexToRgba(primary, 0.32);
    ctx.fillText('SYNC / 60.00', stageRight - 26, h * 0.27);
    ctx.textAlign = 'left';
    ctx.fillStyle = hexToRgba(primary, 0.24);
    ctx.fillText('00:29:13', stageLeft + 32, h * 0.21);
    ctx.restore();

    // A tunnel of rotating clock rings.
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 10; i += 1) {
      const radius = min * (0.095 + i * 0.04);
      const rotation = t * (0.16 + i * 0.022) * (i % 2 ? -1 : 1);
      ctx.strokeStyle = hexToRgba(i % 3 === 0 ? secondary : primary, 0.34 - i * 0.017);
      ctx.lineWidth = i === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.arc(0, 0, radius, rotation, rotation + TAU * (0.66 + i * 0.03));
      ctx.stroke();

      ctx.globalAlpha = 0.55;
      for (let tick = 0; tick < 16; tick += 1) {
        const a = rotation + (tick / 16) * TAU;
        const r1 = radius * 0.95;
        const r2 = radius * (i % 4 === 0 ? 1.055 : 1.012);
        ctx.strokeStyle = hexToRgba(this.paper, 0.18);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    // Radar sweep and speed spokes.
    const sweepAngle = t * 0.62;
    ctx.fillStyle = hexToRgba(primary, 0.055);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, min * 0.55, sweepAngle - 0.22, sweepAngle);
    ctx.closePath();
    ctx.fill();
    for (let i = 0; i < 18; i += 1) {
      const a = (i / 18) * TAU + t * 0.03;
      const r1 = min * (0.29 + (i % 3) * 0.018);
      const r2 = min * (0.44 + (i % 5) * 0.012);
      ctx.strokeStyle = hexToRgba(primary, 0.08 + (i % 4) * 0.015);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      ctx.stroke();
    }

    // Clock hands and a central pivot.
    ctx.strokeStyle = hexToRgba(this.paper, 0.72);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(
      Math.cos(-Math.PI / 2 + t * 1.4) * min * 0.27,
      Math.sin(-Math.PI / 2 + t * 1.4) * min * 0.27
    );
    ctx.stroke();
    ctx.strokeStyle = hexToRgba(primary, 0.95);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(
      Math.cos(-Math.PI / 2 + t * 0.5) * min * 0.17,
      Math.sin(-Math.PI / 2 + t * 0.5) * min * 0.17
    );
    ctx.stroke();
    ctx.fillStyle = hexToRgba(primary, 0.95);
    ctx.beginPath();
    ctx.arc(0, 0, 2.8 + this.beat * 3, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Orbiting dashes.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const p of this.motes) {
      p.angle += p.speed * 60 * dt * (1 + this.energy * 2.2);
      const r = p.radius * (1 + Math.sin(t * 0.5 + p.phase) * 0.02);
      const x = c.x + Math.cos(p.angle) * r;
      const y = c.y + Math.sin(p.angle) * r * 0.76;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.angle + Math.PI / 2);
      ctx.fillStyle = hexToRgba(p.alpha > 0.45 ? secondary : primary, p.alpha * (0.55 + this.energy));
      ctx.fillRect(-p.size * 1.7, -p.size * 0.42, p.size * 3.4, p.size * 0.84);
      ctx.restore();
    }
    ctx.restore();

    // Timecode fragments rising in the dark.
    ctx.save();
    ctx.font = '500 9px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    for (const p of this.digits) {
      p.y -= p.speed * dt * 60;
      if (p.y < -20) {
        p.y = h + 20;
        p.x = random(0, w);
      }
      ctx.fillStyle = hexToRgba(primary, p.alpha * (0.55 + this.energy));
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.restore();

    // Glitch slices on harder transients.
    if (this.glitch > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 4; i += 1) {
        const y = ((t * 240 + i * 173) % h);
        const sliceW = w * (0.12 + ((i * 0.17 + this.glitch * 0.2) % 0.45));
        ctx.fillStyle = hexToRgba(primary, 0.035 + this.glitch * 0.04);
        ctx.fillRect((i % 2 === 0 ? 0 : w - sliceW), y, sliceW, 1.5 + this.glitch * 2);
      }
      ctx.restore();
    }

    this.drawShockwave(0.9);
  }

  drawChromeScene(dt) {
    const { ctx, width: w, height: h, center: c } = this;
    const min = Math.min(w, h);
    const primary = this.colors.primary;
    const secondary = this.colors.secondary;
    const t = this.clock;

    // Sweeping diagonal lasers.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 5; i += 1) {
      const offset = ((t * (0.06 + i * 0.012) + i * 0.25) % 1.4) - 0.2;
      const x = w * offset;
      const beam = ctx.createLinearGradient(x, 0, x + w * 0.38, h);
      beam.addColorStop(0, hexToRgba(this.paper, 0));
      beam.addColorStop(0.28, hexToRgba(primary, 0.045 + i * 0.01));
      beam.addColorStop(0.52, hexToRgba(secondary, 0.085));
      beam.addColorStop(1, hexToRgba(primary, 0));
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + w * 0.08, 0);
      ctx.lineTo(x + w * 0.48, h);
      ctx.lineTo(x + w * 0.25, h);
      ctx.closePath();
      ctx.fill();
    }

    // Polished floor.
    ctx.strokeStyle = hexToRgba(primary, 0.14);
    ctx.lineWidth = 0.8;
    const floorY = h * 0.75;
    for (let i = 0; i < 10; i += 1) {
      const y = floorY + Math.pow(i / 10, 1.7) * h * 0.3;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let i = -8; i <= 8; i += 1) {
      ctx.beginPath();
      ctx.moveTo(c.x, floorY);
      ctx.lineTo(c.x + i * w * 0.14, h);
      ctx.stroke();
    }
    ctx.restore();

    // Huge prism planes make the stage feel like a mirrored room.
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(Math.sin(t * 0.04) * 0.06);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 3; i += 1) {
      const angle = i * (TAU / 3) + t * 0.018;
      const size = min * (0.38 + i * 0.04 + this.energy * 0.03);
      ctx.save();
      ctx.rotate(angle);
      const plane = ctx.createLinearGradient(-size * 0.6, -size, size, size);
      plane.addColorStop(0, hexToRgba(this.paper, 0.07));
      plane.addColorStop(0.45, hexToRgba(primary, 0.045));
      plane.addColorStop(0.7, hexToRgba(secondary, 0.028));
      plane.addColorStop(1, hexToRgba(primary, 0));
      ctx.fillStyle = plane;
      ctx.strokeStyle = hexToRgba(this.paper, 0.18);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.5, size * 0.42);
      ctx.lineTo(-size * 0.5, size * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // Chrome shards with moving spectral highlights.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const p of this.shards) {
      p.rotation += p.spin * dt * (0.7 + this.energy);
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      if (p.x > w + p.size) p.x = -p.size;
      if (p.y > h + p.size) p.y = -p.size;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      const fill = ctx.createLinearGradient(-p.size, -p.size * 0.5, p.size, p.size * 0.5);
      fill.addColorStop(0, hexToRgba(this.paper, p.alpha * 0.58));
      fill.addColorStop(0.25, hexToRgba(primary, p.alpha * 0.44));
      fill.addColorStop(0.52, hexToRgba(this.paper, p.alpha * 0.13));
      fill.addColorStop(1, hexToRgba(secondary, 0));
      ctx.fillStyle = fill;
      ctx.strokeStyle = hexToRgba(this.paper, p.alpha * 0.42);
      ctx.lineWidth = 0.65;
      ctx.beginPath();
      ctx.moveTo(0, -p.size);
      ctx.lineTo(p.size * 0.54, 0);
      ctx.lineTo(0, p.size);
      ctx.lineTo(-p.size * 0.54, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // Prism beams around the emblem.
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 7; i += 1) {
      const angle = t * 0.055 + i * (TAU / 7);
      const reach = min * (0.35 + this.energy * 0.07);
      ctx.strokeStyle = hexToRgba(i % 2 ? this.paper : primary, 0.42);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * reach, Math.sin(angle) * reach);
      ctx.stroke();
    }

    ctx.strokeStyle = hexToRgba(primary, 0.78);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(0, 0, min * 0.27, t * 0.16, t * 0.16 + TAU * 0.72);
    ctx.stroke();
    ctx.strokeStyle = hexToRgba(this.paper, 0.52);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, min * 0.3, -t * 0.1, -t * 0.1 + TAU * 0.48);
    ctx.stroke();
    ctx.strokeStyle = hexToRgba(this.paper, 0.06 + this.flash * 0.12);
    ctx.lineWidth = min * 0.012;
    ctx.beginPath();
    ctx.arc(0, 0, min * 0.345, 0, TAU);
    ctx.stroke();

    const reflection = ctx.createLinearGradient(-min * 0.3, 0, min * 0.3, 0);
    reflection.addColorStop(0, 'rgba(0, 0, 0, 0)');
    reflection.addColorStop(0.5, hexToRgba(this.paper, 0.16));
    reflection.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = reflection;
    ctx.fillRect(-min * 0.34, min * 0.22, min * 0.68, 2);
    ctx.restore();

    // Glints.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const p of this.glints) {
      const pulse = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 0.9 + p.phase), 4);
      ctx.translate(p.x, p.y);
      ctx.strokeStyle = hexToRgba(this.paper, p.alpha * pulse);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-p.size, 0);
      ctx.lineTo(p.size, 0);
      ctx.moveTo(0, -p.size);
      ctx.lineTo(0, p.size);
      ctx.stroke();
      ctx.translate(-p.x, -p.y);
    }
    ctx.restore();

    this.drawShockwave(0.8, this.paper);
  }

  drawTracerScene(dt) {
    const { ctx, width: w, height: h, center: c } = this;
    const min = Math.min(w, h);
    const primary = this.colors.primary;
    const secondary = this.colors.secondary;
    const t = this.clock;

    // Tactical perspective grid.
    ctx.save();
    ctx.strokeStyle = hexToRgba(primary, 0.16);
    ctx.lineWidth = 0.8;
    for (let i = 1; i < 12; i += 1) {
      const y = c.y + Math.pow(i / 12, 1.7) * h * 0.5;
      ctx.globalAlpha = 0.28 + i * 0.035;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let i = -10; i <= 10; i += 1) {
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + i * w * 0.09, h);
      ctx.stroke();
    }
    ctx.restore();

    // Two long sight lines aimed at the emblem.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 2; i += 1) {
      const startX = i === 0 ? -w * 0.05 : w * 1.05;
      const startY = h * (0.22 + i * 0.45);
      const drawX = c.x + (i === 0 ? 1 : -1) * min * 0.18;
      const drawY = c.y + (i === 0 ? 1 : -1) * min * 0.05;
      const line = ctx.createLinearGradient(startX, startY, drawX, drawY);
      line.addColorStop(0, hexToRgba(primary, 0));
      line.addColorStop(0.65, hexToRgba(primary, 0.2));
      line.addColorStop(1, hexToRgba(this.paper, 0.55));
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(drawX, drawY);
      ctx.stroke();
    }
    ctx.restore();

    // Searchlight cones from the lower corners.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const lights = [
      { x: w * 0.04, y: h, color: primary, angle: -0.36 },
      { x: w * 0.96, y: h, color: secondary, angle: 0.36 }
    ];
    for (const light of lights) {
      const beam = ctx.createLinearGradient(light.x, light.y, c.x, c.y);
      beam.addColorStop(0, hexToRgba(light.color, 0.11));
      beam.addColorStop(0.7, hexToRgba(light.color, 0.022));
      beam.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(light.x, light.y);
      ctx.lineTo(light.x + Math.sin(light.angle) * w * 0.4, 0);
      ctx.lineTo(light.x + Math.sin(light.angle) * w * 0.4 + w * 0.09, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // A long-exposure tracer that is always travelling toward the lock.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const exposure = (t * 0.34) % 1;
    const fromLeft = Math.sin(t * 0.18) > 0;
    const startX = fromLeft ? -w * 0.12 : w * 1.12;
    const startY = h * (0.18 + (Math.sin(t * 0.11) + 1) * 0.16);
    const headX = startX + (c.x - startX) * exposure;
    const headY = startY + (c.y - startY) * exposure;
    const longTrail = ctx.createLinearGradient(startX, startY, headX, headY);
    longTrail.addColorStop(0, hexToRgba(primary, 0));
    longTrail.addColorStop(0.82, hexToRgba(primary, 0.2));
    longTrail.addColorStop(1, hexToRgba(this.paper, 0.58));
    ctx.strokeStyle = longTrail;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(headX, headY);
    ctx.stroke();
    ctx.fillStyle = hexToRgba(this.paper, 0.4);
    ctx.beginPath();
    ctx.arc(headX, headY, 1.6, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Reticle rings and locking brackets.
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.globalCompositeOperation = 'screen';
    ctx.rotate(t * 0.055);
    ctx.strokeStyle = hexToRgba(primary, 0.64);
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i += 1) {
      const angle = i * (TAU / 4) + 0.12;
      ctx.beginPath();
      ctx.arc(0, 0, min * 0.25, angle, angle + 0.46);
      ctx.stroke();
    }
    ctx.strokeStyle = hexToRgba(this.paper, 0.34);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, min * 0.315, 0, TAU);
    ctx.stroke();
    ctx.rotate(-t * 0.055);

    // Four corner brackets framing the lock.
    for (let i = 0; i < 4; i += 1) {
      const a = i * (Math.PI / 2);
      const x = Math.cos(a) * min * 0.18;
      const y = Math.sin(a) * min * 0.18;
      const s = min * 0.035;
      ctx.strokeStyle = hexToRgba(this.paper, 0.32);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - s, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y - s);
      ctx.stroke();
    }

    // Crosshair.
    const reach = min * 0.17;
    ctx.strokeStyle = hexToRgba(this.paper, 0.54);
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i += 1) {
      const a = i * (Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * reach, Math.sin(a) * reach);
      ctx.lineTo(Math.cos(a) * (reach - min * 0.07), Math.sin(a) * (reach - min * 0.07));
      ctx.stroke();
    }
    ctx.fillStyle = hexToRgba(primary, 0.82 + this.energy * 0.15);
    ctx.beginPath();
    ctx.arc(0, 0, 2.4, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Tracers, in flight.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = this.tracers.length - 1; i >= 0; i -= 1) {
      const tracer = this.tracers[i];
      tracer.age += dt;
      const p = clamp(tracer.age / tracer.duration, 0, 1);
      const x = tracer.x0 + (tracer.x1 - tracer.x0) * p;
      const y = tracer.y0 + (tracer.y1 - tracer.y0) * p;
      const alpha = Math.sin(p * Math.PI) * 0.7;
      const trail = ctx.createLinearGradient(tracer.x0, tracer.y0, x, y);
      trail.addColorStop(0, hexToRgba(primary, 0));
      trail.addColorStop(0.76, hexToRgba(primary, alpha * 0.35));
      trail.addColorStop(1, hexToRgba(this.paper, alpha));
      ctx.strokeStyle = trail;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(tracer.x0, tracer.y0);
      ctx.lineTo(x, y);
      ctx.stroke();

      if (p > 0.94) {
        const shock = 1 - (p - 0.94) / 0.06;
        ctx.strokeStyle = hexToRgba(this.paper, shock * 0.5);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(tracer.x1, tracer.y1, min * (0.03 + (1 - shock) * 0.16), 0, TAU);
        ctx.stroke();
      }
      if (p >= 1) this.tracers.splice(i, 1);
    }
    ctx.restore();

    // A slow round still crossing the frame.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const travel = (t * 0.08) % 1;
    const bulletX = w * (-0.08 + travel * 1.16);
    const bulletY = h * (0.32 + Math.sin(t * 0.3) * 0.035);
    const bullet = ctx.createRadialGradient(bulletX, bulletY, 0, bulletX, bulletY, 34);
    bullet.addColorStop(0, hexToRgba(this.paper, 0.95));
    bullet.addColorStop(0.2, hexToRgba(primary, 0.38));
    bullet.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bullet;
    ctx.fillRect(bulletX - 40, bulletY - 40, 80, 80);
    ctx.strokeStyle = hexToRgba(primary, 0.34);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bulletX - 240, bulletY);
    ctx.lineTo(bulletX, bulletY);
    ctx.stroke();
    ctx.restore();

    // Sweeping scanline.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const scanY = (t * 110) % h;
    const scan = ctx.createLinearGradient(0, scanY - 3, 0, scanY + 3);
    scan.addColorStop(0, 'rgba(0, 0, 0, 0)');
    scan.addColorStop(0.5, hexToRgba(primary, 0.2));
    scan.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = scan;
    ctx.fillRect(0, scanY - 3, w, 6);
    ctx.restore();

    // HUD labels, kept inside the stage frame.
    const hudLeft = (this.stageRect ? this.stageRect.left : 0) + 28;
    const hudRight = (this.stageRect ? this.stageRect.right : w) - 28;
    ctx.save();
    ctx.font = '500 9px "IBM Plex Mono", monospace';
    ctx.fillStyle = hexToRgba(primary, 0.48);
    ctx.fillText('RANGE / 412M', hudLeft, h * 0.225);
    ctx.fillText('WIND / 0.3', hudLeft, h * 0.225 + 16);
    ctx.fillText('T-00:01', hudLeft, h * 0.225 + 32);
    ctx.textAlign = 'right';
    ctx.fillStyle = hexToRgba(this.paper, 0.38);
    ctx.fillText('LOCKED / HEARTBEAT', hudRight, h * 0.225);
    ctx.fillText('ONE BREATH', hudRight, h * 0.225 + 16);
    ctx.restore();

    this.drawShockwave(0.72, this.paper);
  }

  drawEclipseScene(dt) {
    const { ctx, width: w, height: h, center: c } = this;
    const min = Math.min(w, h);
    const primary = this.colors.primary;
    const secondary = this.colors.secondary;
    const t = this.clock;
    const core = min * (0.225 + this.energy * 0.012 + this.beat * 0.012);

    // Corona field.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const corona = ctx.createRadialGradient(c.x, c.y, core * 0.72, c.x, c.y, min * 0.82);
    corona.addColorStop(0, hexToRgba(primary, 0.18 + this.flare * 0.08));
    corona.addColorStop(0.22, hexToRgba(primary, 0.09));
    corona.addColorStop(0.5, hexToRgba(secondary, 0.035));
    corona.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = corona;
    ctx.fillRect(0, 0, w, h);

    // Solar rays.
    ctx.translate(c.x, c.y);
    for (let i = 0; i < 28; i += 1) {
      const angle = (i / 28) * TAU + t * 0.017;
      const length = core * (1.16 + (i % 3) * 0.08 + Math.sin(t * 0.7 + i) * 0.07 + this.flare * 0.12);
      ctx.strokeStyle = hexToRgba(
        i % 4 === 0 ? this.paper : primary,
        (0.035 + (i % 5 === 0 ? 0.06 : 0)) * (1 + this.flare)
      );
      ctx.lineWidth = i % 5 === 0 ? 1.2 : 0.55;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * core * 1.02, Math.sin(angle) * core * 1.02);
      ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
      ctx.stroke();
    }

    // Rotating prominences around the rim.
    for (let i = 0; i < 4; i += 1) {
      const angle = i * (TAU / 4) + 0.35;
      const rotate = t * 0.02;
      ctx.strokeStyle = hexToRgba(i % 2 ? secondary : primary, 0.32 + this.energy * 0.2);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, core * (1.055 + i * 0.018), angle + rotate, angle + rotate + 0.34);
      ctx.stroke();
    }

    // The dark body of the sun.
    const body = ctx.createRadialGradient(
      -core * 0.18,
      -core * 0.18,
      0,
      0,
      0,
      core * 0.97
    );
    body.addColorStop(0, 'rgba(5, 3, 2, 0.98)');
    body.addColorStop(0.76, 'rgba(7, 4, 2, 0.98)');
    body.addColorStop(0.95, hexToRgba(this.colors.tertiary, 0.28));
    body.addColorStop(1, hexToRgba(primary, 0));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(0, 0, core, 0, TAU);
    ctx.fill();

    // A thin burning rim.
    ctx.strokeStyle = hexToRgba(primary, 0.82);
    ctx.lineWidth = 1.2 + this.flare * 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, core * 0.988, 0, TAU);
    ctx.stroke();

    // Lens flare.
    const flare = ctx.createLinearGradient(-w * 0.45, c.y, w * 0.45, c.y);
    flare.addColorStop(0, 'rgba(0, 0, 0, 0)');
    flare.addColorStop(0.48, hexToRgba(primary, 0.025 + this.flare * 0.04));
    flare.addColorStop(0.54, hexToRgba(this.paper, 0.06 + this.flare * 0.04));
    flare.addColorStop(0.6, hexToRgba(primary, 0.02));
    flare.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = flare;
    ctx.fillRect(-w, -2, w * 2, 4);
    ctx.restore();

    // Broken arena ellipse and molten fissures.
    ctx.save();
    ctx.strokeStyle = hexToRgba(primary, 0.15 + this.energy * 0.1);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + min * 0.31, min * 0.46, min * 0.12, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 7; i += 1) {
      const startX = (i / 6) * w;
      const y = h * (0.79 + (i % 3) * 0.04);
      const wobble = Math.sin(t * 0.2 + i) * 12;
      ctx.strokeStyle = hexToRgba(secondary, 0.08);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(startX, h);
      ctx.lineTo(startX + wobble, y + 22);
      ctx.lineTo(startX + wobble * 1.2, y);
      ctx.stroke();
      ctx.strokeStyle = hexToRgba(primary, 0.42);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(startX, h);
      ctx.lineTo(startX + wobble, y + 22);
      ctx.lineTo(startX + wobble * 1.2, y);
      ctx.stroke();
    }
    ctx.restore();

    // Ash falling; embers rising.
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const p of this.ash) {
      p.x += (p.vx + Math.sin(t * 0.3 + p.phase) * 0.08) * dt * 60;
      p.y += p.vy * dt * 60;
      if (p.y > h + 20) {
        p.y = -20;
        p.x = random(0, w);
      }
      ctx.fillStyle = hexToRgba(p.alpha > 0.25 ? secondary : primary, p.alpha * (0.6 + this.energy));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TAU);
      ctx.fill();
    }
    for (const p of this.embers) {
      const px = p.x;
      const py = p.y;
      p.y += p.vy * dt * 60 * (1 + this.energy * 0.45);
      p.x += Math.sin(t * 0.55 + p.phase) * p.drift * dt * 60;
      if (p.y < -10) {
        p.y = h + 10;
        p.x = random(0, w);
      }
      ctx.strokeStyle = hexToRgba(primary, p.alpha * 0.5);
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.restore();

    this.drawShockwave(1.45);
  }

  buildParticles() {
    const compact = this.width < 820;
    const mode = this.mode;

    this.motes = [];
    this.shards = [];
    this.embers = [];
    this.smoke = [];
    this.digits = [];
    this.glints = [];
    this.ash = [];
    this.tracers = [];

    const makeMote = (kind = 'dust') => {
      if (kind === 'orbit') {
        return {
          angle: random(0, TAU),
          radius: random(0.16, 0.52) * Math.min(this.width, this.height),
          speed: random(0.0002, 0.0006),
          size: random(0.8, 2.8),
          phase: random(0, TAU),
          alpha: random(0.16, 0.58)
        };
      }
      return {
        x: random(0, this.width),
        y: random(-this.height * 0.1, this.height),
        vx: random(-0.12, 0.12),
        vy: random(0.08, 0.5),
        size: random(0.4, 1.6),
        alpha: random(0.12, 0.52),
        phase: random(0, TAU)
      };
    };

    const makeShard = (kind = 'glass') => ({
      x: random(0, this.width),
      y: random(-this.height * 0.2, this.height),
      vx: random(-0.18, 0.18),
      vy: kind === 'glass' ? random(0.08, 0.5) : random(0.02, 0.16),
      size: random(10, kind === 'glass' ? 28 : 44),
      height: random(12, 44),
      rotation: random(0, TAU),
      spin: random(-0.006, 0.006),
      alpha: random(0.06, 0.3),
      phase: random(0, TAU)
    });

    const makeEmber = () => ({
      x: random(0, this.width),
      y: random(this.height * 0.7, this.height + 80),
      vx: random(-0.18, 0.18),
      vy: random(-0.95, -0.28),
      size: random(0.8, 3),
      drift: random(0.2, 0.7),
      alpha: random(0.28, 0.92),
      phase: random(0, TAU),
      life: random(0.4, 1.2)
    });

    const makeSmoke = () => ({
      x: random(0, this.width),
      y: random(this.height * 0.15, this.height * 0.9),
      size: random(this.width * 0.05, this.width * 0.16),
      vy: random(0.1, 0.4),
      alpha: random(0.05, 0.18),
      phase: random(0, TAU)
    });

    if (mode === 'dust') {
      this.motes = Array.from({ length: compact ? 52 : 96 }, () => makeMote('dust'));
      this.shards = Array.from({ length: compact ? 10 : 18 }, () => makeShard('glass'));
    } else if (mode === 'ember') {
      this.embers = Array.from({ length: compact ? 54 : 100 }, makeEmber);
      this.smoke = Array.from({ length: compact ? 5 : 9 }, makeSmoke);
    } else if (mode === 'clock') {
      this.motes = Array.from({ length: compact ? 28 : 48 }, () => makeMote('orbit'));
      this.digits = Array.from({ length: compact ? 10 : 20 }, () => ({
        x: random(0, this.width),
        y: random(0, this.height),
        speed: random(0.15, 0.6),
        alpha: random(0.08, 0.25),
        text: ['00:03', 'T-12', '00:07', '01:11', '00:29', '13.37', 'T-04', '00:01'][
          Math.floor(random(0, 8))
        ]
      }));
    } else if (mode === 'chrome') {
      this.shards = Array.from({ length: compact ? 14 : 26 }, () => makeShard('chrome'));
      this.glints = Array.from({ length: compact ? 10 : 20 }, () => ({
        x: random(0, this.width),
        y: random(0, this.height),
        size: random(2, 11),
        alpha: random(0.16, 0.46),
        phase: random(0, TAU)
      }));
    } else if (mode === 'tracer') {
      this.motes = Array.from({ length: compact ? 24 : 38 }, () => makeMote('dust'));
      this.glints = Array.from({ length: compact ? 8 : 14 }, () => ({
        x: random(0, this.width),
        y: random(0, this.height * 0.7),
        size: random(2, 7),
        alpha: random(0.08, 0.24),
        phase: random(0, TAU)
      }));
    } else {
      this.ash = Array.from({ length: compact ? 48 : 90 }, () => ({
        x: random(0, this.width),
        y: random(-this.height * 0.2, this.height),
        vx: random(-0.12, 0.2),
        vy: random(0.1, 0.4),
        size: random(0.4, 1.6),
        alpha: random(0.08, 0.36),
        phase: random(0, TAU)
      }));
      this.embers = Array.from({ length: compact ? 22 : 42 }, makeEmber);
    }
  }

  spawnEmberBurst(count) {
    const extra = [];
    for (let i = 0; i < count; i += 1) {
      extra.push({
        x: random(this.width * 0.1, this.width * 0.9),
        y: this.height + random(-10, 30),
        vx: random(-0.55, 0.55),
        vy: random(-1.9, -0.6),
        size: random(0.7, 2.4),
        drift: random(0.2, 0.9),
        alpha: random(0.3, 0.9),
        phase: random(0, TAU),
        life: random(0.45, 1.25)
      });
    }
    this.embers.push(...extra);
    if (this.embers.length > 150) this.embers.splice(0, this.embers.length - 150);
  }

  spawnTracer() {
    const { width: w, height: h, center: c } = this;
    const fromLeft = Math.random() > 0.5;
    this.tracers.push({
      x0: fromLeft ? -w * 0.06 : w * 1.06,
      y0: h * random(0.18, 0.68),
      x1: c.x + random(-90, 90),
      y1: c.y + random(-70, 70),
      age: 0,
      duration: random(0.22, 0.45)
    });
    if (this.tracers.length > 5) this.tracers.shift();
  }

  destroy() {
    this.stop();
    window.removeEventListener('resize', this.handleResize);
  }
}
