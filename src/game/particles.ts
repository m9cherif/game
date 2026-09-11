import * as THREE from "three";

// Pooled GPU-friendly particle system using Points + per-particle velocity/life in JS.
// Cap ~1200 particles, single draw call per burst pool. 60fps safe.
interface P { alive: boolean; life: number; maxLife: number; vx: number; vy: number; vz: number; size: number; grav: number; drag: number; }

export class ParticleSystem {
  points: THREE.Points;
  geo: THREE.BufferGeometry;
  posAttr: THREE.BufferAttribute;
  colAttr: THREE.BufferAttribute;
  parts: P[] = [];
  max: number;
  cursor = 0;
  colors = new Float32Array(0);
  positions = new Float32Array(0);

  constructor(scene: THREE.Scene, max = 1200) {
    this.max = max;
    this.positions = new Float32Array(max * 3);
    this.colors = new Float32Array(max * 3);
    for (let i = 0; i < max; i++) {
      this.parts.push({ alive: false, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, size: 1, grav: 0, drag: 0 });
      this.positions[i * 3 + 1] = -100;
    }
    this.geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.positions, 3);
    this.colAttr = new THREE.BufferAttribute(this.colors, 3);
    this.geo.setAttribute("position", this.posAttr);
    this.geo.setAttribute("color", this.colAttr);
    const m = new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    this.points = new THREE.Points(this.geo, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  spawn(x: number, y: number, z: number, count: number, color: THREE.ColorRepresentation, opts: Partial<{ speed: number; up: number; life: number; grav: number; drag: number; spread: number }> = {}) {
    const c = new THREE.Color(color);
    const speed = opts.speed ?? 6;
    const life = opts.life ?? 0.7;
    const spread = opts.spread ?? 1;
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const p = this.parts[i];
      p.alive = true; p.life = 0; p.maxLife = life * (0.5 + Math.random() * 0.8);
      p.grav = opts.grav ?? 9; p.drag = opts.drag ?? 2;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const sp = speed * (0.3 + Math.random() * 0.9) * spread;
      p.vx = Math.sin(ph) * Math.cos(th) * sp;
      p.vy = Math.abs(Math.cos(ph)) * sp * 0.9 + (opts.up ?? 2);
      p.vz = Math.sin(ph) * Math.sin(th) * sp;
      this.positions[i * 3] = x; this.positions[i * 3 + 1] = y; this.positions[i * 3 + 2] = z;
      const v = 0.7 + Math.random() * 0.5;
      this.colors[i * 3] = Math.min(1, c.r * v + 0.15);
      this.colors[i * 3 + 1] = Math.min(1, c.g * v + 0.15);
      this.colors[i * 3 + 2] = Math.min(1, c.b * v + 0.15);
    }
  }

  burst(pos: THREE.Vector3, color: THREE.ColorRepresentation, count = 22, speed = 8) {
    this.spawn(pos.x, pos.y, pos.z, count, color, { speed, life: 0.8, grav: 10 });
  }
  sparks(pos: THREE.Vector3, color = 0xffd166, count = 10) {
    this.spawn(pos.x, pos.y, pos.z, count, color, { speed: 10, life: 0.35, grav: 6 });
  }
  blood(pos: THREE.Vector3, color = 0x22d3ee) {
    this.spawn(pos.x, pos.y, pos.z, 26, color, { speed: 7, life: 0.7, grav: 11 });
  }
  explosion(pos: THREE.Vector3) {
    this.spawn(pos.x, pos.y + 0.3, pos.z, 60, 0xffb703, { speed: 12, life: 0.9, grav: 8 });
    this.spawn(pos.x, pos.y + 0.5, pos.z, 30, 0xff4d00, { speed: 8, life: 1.1, grav: 6 });
    this.spawn(pos.x, pos.y + 0.8, pos.z, 20, 0xffffff, { speed: 15, life: 0.4, grav: 2 });
  }
  muzzle(pos: THREE.Vector3, color = 0x67e8f9) {
    this.spawn(pos.x, pos.y, pos.z, 5, color, { speed: 4, life: 0.15, grav: 0, drag: 4 });
  }
  trail(pos: THREE.Vector3, color: THREE.ColorRepresentation) {
    this.spawn(pos.x, pos.y, pos.z, 2, color, { speed: 0.5, life: 0.4, grav: 0, drag: 1 });
  }
  ring(_pos: THREE.Vector3, _color: THREE.ColorRepresentation) { /* reserved for shockwave mesh */ }

  update(dt: number) {
    const d = Math.min(dt, 0.05);
    for (let i = 0; i < this.max; i++) {
      const p = this.parts[i];
      if (!p.alive) continue;
      p.life += d;
      if (p.life >= p.maxLife) { p.alive = false; this.positions[i * 3 + 1] = -100; continue; }
      const dragF = 1 - Math.min(0.9, p.drag * d);
      p.vx *= dragF; p.vz *= dragF;
      p.vy = p.vy * dragF - p.grav * d;
      this.positions[i * 3] += p.vx * d;
      this.positions[i * 3 + 1] += p.vy * d;
      this.positions[i * 3 + 2] += p.vz * d;
      if (this.positions[i * 3 + 1] < 0.02) { this.positions[i * 3 + 1] = 0.02; p.vy *= -0.4; }
      const fade = 1 - p.life / p.maxLife;
      // fade color toward black (additive => fades out)
      const f = fade * fade;
      // store original? approximate by scaling current
      this.colors[i * 3] *= (0.92 + f * 0.06);
      this.colors[i * 3 + 1] *= (0.92 + f * 0.06);
      this.colors[i * 3 + 2] *= (0.92 + f * 0.06);
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.points);
    this.geo.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

// Floating damage numbers via HTML pool (cheap, no canvas textures)
export class DamageNumbers {
  pool: HTMLDivElement[] = [];
  container: HTMLElement | null = null;
  idx = 0;
  init(container: HTMLElement) {
    this.container = container;
    for (let i = 0; i < 24; i++) {
      const el = document.createElement("div");
      el.className = "dmg-num";
      el.style.display = "none";
      container.appendChild(el);
      this.pool.push(el);
    }
  }
  show(screenX: number, screenY: number, text: string, cls = "") {
    if (!this.container) return;
    const el = this.pool[this.idx++ % this.pool.length];
    el.className = `dmg-num ${cls}`;
    el.textContent = text;
    el.style.display = "block";
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
    window.setTimeout(() => { el.style.display = "none"; }, 750);
  }
  dispose() { for (const el of this.pool) el.remove(); this.pool = []; }
}
