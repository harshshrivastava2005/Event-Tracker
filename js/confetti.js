/**
 * confetti.js - Lightweight Zero-Dependency Celebration Particle Engine
 * Runs a joyful particle explosion on event completion or "Mark Done" action
 */

let canvas = null;
let ctx = null;
let particles = [];
let animationId = null;

const COLORS = [
  '#4f46e5', '#6366f1', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#10b981', '#06b6d4'
];

function initCanvas() {
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'celebration-confetti-canvas';
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
  }

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

class ConfettiParticle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * 8 + 6;
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    // Random velocity
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 12 + 6;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed - 5; // upward bias
    this.rotation = Math.random() * 360;
    this.rotationSpeed = (Math.random() - 0.5) * 15;
    this.gravity = 0.28;
    this.drag = 0.985;
    this.opacity = 1;
    this.decay = Math.random() * 0.012 + 0.008;
    this.shape = Math.random() > 0.4 ? 'rect' : 'circle';
  }

  update() {
    this.vx *= this.drag;
    this.vy *= this.drag;
    this.vy += this.gravity;
    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.rotationSpeed;
    this.opacity -= this.decay;
  }

  draw(context) {
    if (this.opacity <= 0) return;
    context.save();
    context.translate(this.x, this.y);
    context.rotate((this.rotation * Math.PI) / 180);
    context.globalAlpha = Math.max(0, this.opacity);
    context.fillStyle = this.color;

    if (this.shape === 'rect') {
      context.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2);
    } else {
      context.beginPath();
      context.arc(0, 0, this.size / 2.5, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }
}

function loop() {
  if (!ctx || !canvas) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.update();
    p.draw(ctx);

    if (p.opacity <= 0 || p.y > canvas.height + 20) {
      particles.splice(i, 1);
    }
  }

  if (particles.length > 0) {
    animationId = requestAnimationFrame(loop);
  } else {
    // Teardown
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
      canvas = null;
      ctx = null;
    }
  }
}

/**
 * Trigger celebration confetti burst at specified coordinates or center of screen
 */
export function fireCelebrationConfetti(originX = null, originY = null) {
  initCanvas();

  const x = originX !== null ? originX : window.innerWidth / 2;
  const y = originY !== null ? originY : window.innerHeight / 2.5;

  const count = 120;
  for (let i = 0; i < count; i++) {
    particles.push(new ConfettiParticle(x, y));
  }

  if (!animationId) {
    animationId = requestAnimationFrame(loop);
  }
}
