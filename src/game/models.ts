import * as THREE from "three";
import type { ArenaId, WeaponId } from "./constants";
import { ARENAS, GUN_SKINS } from "./constants";

// All models below are 100% procedural — built from Three.js primitives. No external assets.

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.55, ...opts });
}
function glowMat(color: number, intensity = 1.6) {
  return new THREE.MeshStandardMaterial({ color: 0x0a0a0a, emissive: color, emissiveIntensity: intensity, roughness: 0.3, metalness: 0.1 });
}
function box(w: number, h: number, d: number, m: THREE.Material) {
  const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  g.castShadow = false; g.receiveShadow = false;
  return g;
}
function cyl(rt: number, rb: number, h: number, m: THREE.Material, seg = 10) {
  const g = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  g.castShadow = false;
  return g;
}
function sph(r: number, m: THREE.Material, seg = 12) {
  const g = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg - 2)), m);
  g.castShadow = false;
  return g;
}

export function skinById(id: string) {
  return GUN_SKINS.find((s) => s.id === id) ?? GUN_SKINS[0];
}

// ── VIEWMODEL GUNS (first-person, bottom-right of camera) ──
export function buildGunMesh(weapon: WeaponId, skinId: string): THREE.Group {
  const skin = skinById(skinId);
  const g = new THREE.Group();
  const body = mat(0x1b2430, { roughness: 0.35, metalness: 0.75 });
  const dark = mat(0x0b0f16, { roughness: 0.5, metalness: 0.6 });
  const primary = mat(skin.primary, { roughness: 0.3, metalness: 0.7 });
  const glow = glowMat(skin.glow, 2.2);

  const add = (m: THREE.Mesh, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); g.add(m); return m; };

  if (weapon === "blade") {
    const hilt = add(cyl(0.025, 0.03, 0.22, dark), 0, 0, 0);
    hilt.rotation.x = Math.PI / 2;
    const guard = add(box(0.1, 0.03, 0.03, primary), 0, 0, -0.12);
    void guard;
    const bladeMesh = add(box(0.035, 0.055, 0.85, glow), 0, 0.01, -0.55);
    void bladeMesh;
    const tip = add(box(0.02, 0.03, 0.12, glow), 0, 0.01, -1.02);
    tip.rotation.y = Math.PI / 4;
    const coil = add(box(0.07, 0.07, 0.06, primary), 0, -0.01, -0.02);
    void coil;
  } else if (weapon === "scatter") {
    add(box(0.09, 0.1, 0.5, body), 0, 0, -0.25);
    const barrel1 = add(cyl(0.032, 0.032, 0.55, dark), -0.028, 0.02, -0.55);
    barrel1.rotation.x = Math.PI / 2;
    const barrel2 = add(cyl(0.032, 0.032, 0.55, dark), 0.028, 0.02, -0.55);
    barrel2.rotation.x = Math.PI / 2;
    add(box(0.03, 0.03, 0.4, glow), -0.028, -0.03, -0.4);
    add(box(0.03, 0.03, 0.4, glow), 0.028, -0.03, -0.4);
    const pump = add(box(0.11, 0.07, 0.16, primary), 0, -0.045, -0.45);
    pump.name = "pump";
    add(box(0.07, 0.16, 0.09, dark), 0, -0.12, 0.08);
    add(box(0.05, 0.06, 0.12, dark), 0, -0.1, -0.05);
  } else if (weapon === "rail") {
    add(box(0.08, 0.09, 0.7, body), 0, 0, -0.3);
    const rail1 = add(box(0.02, 0.02, 0.6, glow), -0.05, 0.01, -0.55);
    void rail1;
    const rail2 = add(box(0.02, 0.02, 0.6, glow), 0.05, 0.01, -0.55);
    void rail2;
    const tip = add(cyl(0.035, 0.045, 0.14, primary), 0, 0.01, -0.95);
    tip.rotation.x = Math.PI / 2;
    add(box(0.06, 0.12, 0.25, dark), 0, -0.06, 0.15); // stock
    const scope = add(cyl(0.035, 0.035, 0.2, dark), 0, 0.09, -0.2);
    scope.rotation.x = Math.PI / 2;
    const lens = add(cyl(0.03, 0.03, 0.01, glow), 0, 0.09, -0.1);
    lens.rotation.x = Math.PI / 2;
    add(box(0.07, 0.14, 0.08, dark), 0, -0.11, -0.02);
  } else if (weapon === "thumper") {
    const drum = add(cyl(0.09, 0.09, 0.22, primary), 0, -0.02, -0.3);
    drum.rotation.x = Math.PI / 2;
    add(box(0.09, 0.09, 0.45, body), 0, 0.04, -0.25);
    const barrel = add(cyl(0.055, 0.06, 0.3, dark), 0, 0.04, -0.6);
    barrel.rotation.x = Math.PI / 2;
    const ring = add(box(0.13, 0.02, 0.02, glow), 0, 0.04, -0.48);
    void ring;
    add(box(0.07, 0.15, 0.09, dark), 0, -0.12, 0.05);
  } else {
    // rifle + smg share platform
    const long = weapon === "rifle";
    add(box(0.085, 0.1, long ? 0.62 : 0.45, body), 0, 0, -0.3);
    const barrel = add(cyl(0.024, 0.028, long ? 0.4 : 0.25, dark), 0, 0.015, long ? -0.75 : -0.6);
    barrel.rotation.x = Math.PI / 2;
    add(box(0.02, 0.02, long ? 0.5 : 0.35, glow), -0.052, 0, -0.35);
    add(box(0.02, 0.02, long ? 0.5 : 0.35, glow), 0.052, 0, -0.35);
    const magMesh = add(box(0.06, long ? 0.16 : 0.2, 0.09, primary), 0, -0.12, -0.28);
    magMesh.rotation.x = 0.15;
    add(box(0.07, 0.13, 0.1, dark), 0, -0.1, 0.05);
    const sight = add(box(0.02, 0.05, 0.06, dark), 0, 0.075, -0.15);
    void sight;
    add(box(0.012, 0.012, 0.012, glow), 0, 0.1, -0.15);
    if (!long) {
      const grip = add(box(0.05, 0.1, 0.06, dark), 0, -0.1, -0.45);
      grip.rotation.x = -0.3;
    }
  }
  // muzzle anchor
  const muzzle = new THREE.Object3D();
  muzzle.name = "muzzle";
  muzzle.position.set(0, weapon === "blade" ? 0.01 : 0.02, weapon === "rail" ? -1.05 : weapon === "blade" ? -1.05 : -0.85);
  g.add(muzzle);
  g.traverse((o) => { if (o instanceof THREE.Mesh) { o.frustumCulled = false; } });
  return g;
}

// ── HUMANOID BOT (enemies + remote players share rig) ──
export interface Humanoid { group: THREE.Group; head: THREE.Mesh; torso: THREE.Mesh; legL: THREE.Mesh; legR: THREE.Mesh; armL: THREE.Mesh; armR: THREE.Mesh; visor: THREE.Mesh; gun: THREE.Group; }

export function buildHumanoid(primary: number, secondary: number, glow: number, scale = 1): Humanoid {
  const group = new THREE.Group();
  const pm = mat(primary, { roughness: 0.4, metalness: 0.6 });
  const sm = mat(secondary, { roughness: 0.55, metalness: 0.5 });
  const dm = mat(0x111722, { roughness: 0.5, metalness: 0.6 });
  const gm = glowMat(glow, 2.0);

  const torso = box(0.55, 0.7, 0.32, pm); torso.position.y = 1.25; group.add(torso);
  const chest = box(0.3, 0.12, 0.05, gm); chest.position.set(0, 1.35, 0.18); group.add(chest);
  const belt = box(0.57, 0.1, 0.34, dm); belt.position.y = 0.88; group.add(belt);
  const head = box(0.34, 0.32, 0.34, sm); head.position.y = 1.82; group.add(head);
  const visor = box(0.28, 0.1, 0.05, gm); visor.position.set(0, 1.84, 0.18); group.add(visor);
  const crest = box(0.08, 0.14, 0.3, dm); crest.position.set(0, 2.02, -0.02); group.add(crest);
  const mkArm = (x: number) => { const a = box(0.16, 0.62, 0.16, sm); a.position.set(x, 1.25, 0); a.geometry.translate(0, -0.18, 0); group.add(a); return a; };
  const armL = mkArm(-0.38); const armR = mkArm(0.38);
  const gloveL = box(0.17, 0.14, 0.17, dm); gloveL.position.set(-0.38, 0.78, 0); group.add(gloveL);
  const gloveR = box(0.17, 0.14, 0.17, dm); gloveR.position.set(0.38, 0.78, 0); group.add(gloveR);
  const mkLeg = (x: number) => { const l = box(0.2, 0.8, 0.2, dm); l.position.set(x, 0.82, 0); l.geometry.translate(0, -0.4, 0); group.add(l); return l; };
  const legL = mkLeg(-0.15); const legR = mkLeg(0.15);
  const padL = box(0.22, 0.12, 0.22, pm); padL.position.set(-0.15, 0.62, 0); group.add(padL);
  const padR = box(0.22, 0.12, 0.22, pm); padR.position.set(0.15, 0.62, 0); group.add(padR);
  // gun in right hand
  const gun = new THREE.Group();
  const gb = box(0.1, 0.12, 0.6, dm); gun.add(gb);
  const gg = box(0.11, 0.04, 0.4, gm); gg.position.y = 0.04; gun.add(gg);
  gun.position.set(0.38, 0.95, -0.3);
  group.add(gun);
  group.scale.setScalar(scale);
  group.traverse((o) => { if (o instanceof THREE.Mesh) o.frustumCulled = false; });
  return { group, head, torso, legL, legR, armL, armR, visor, gun };
}

export function animateHumanoid(h: Humanoid, t: number, moving: boolean, aiming = false) {
  const s = moving ? Math.sin(t * 11) * 0.55 : Math.sin(t * 2) * 0.04;
  h.legL.rotation.x = s;
  h.legR.rotation.x = -s;
  h.armL.rotation.x = moving ? -s * 0.7 : Math.sin(t * 2 + 1) * 0.06;
  h.armR.rotation.x = aiming ? -1.35 : (moving ? s * 0.7 : Math.sin(t * 2) * 0.06);
  h.group.position.y += 0; // keep grounded; bob handled by caller
  (h.visor.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.6 + Math.sin(t * 5) * 0.5;
}

// ── HUNTER DRONE (survival / orb chasers) ──
export interface Drone { group: THREE.Group; eye: THREE.Mesh; ring: THREE.Mesh; rotorL: THREE.Mesh; rotorR: THREE.Mesh; }
export function buildDrone(glow = 0xff3b5c): Drone {
  const group = new THREE.Group();
  const dm = mat(0x1a2230, { roughness: 0.35, metalness: 0.8 });
  const gm = glowMat(glow, 2.4);
  const core = sph(0.32, dm, 14); core.position.y = 0; group.add(core);
  const shell = box(0.7, 0.18, 0.7, dm); group.add(shell);
  const eye = sph(0.16, gm, 12); eye.position.set(0, 0.02, 0.3); group.add(eye);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.045, 8, 20), gm);
  ring.rotation.x = Math.PI / 2; ring.position.y = -0.05; group.add(ring);
  const mkRotor = (x: number) => {
    const arm = box(0.5, 0.06, 0.1, dm); arm.position.set(x, 0.14, 0); group.add(arm);
    const r = box(0.7, 0.02, 0.08, mat(0x0b0f16)); r.position.set(x * 1.6, 0.2, 0); group.add(r);
    const tipL = box(0.06, 0.025, 0.085, gm); tipL.position.set(x * 1.6 - 0.32, 0.2, 0); group.add(tipL);
    const tipR = box(0.06, 0.025, 0.085, gm); tipR.position.set(x * 1.6 + 0.32, 0.2, 0); group.add(tipR);
    return r;
  };
  const rotorL = mkRotor(-0.5); const rotorR = mkRotor(0.5);
  const spike = cyl(0.03, 0.08, 0.3, dm); spike.position.y = -0.32; group.add(spike);
  const under = sph(0.06, gm, 8); under.position.y = -0.48; group.add(under);
  group.traverse((o) => { if (o instanceof THREE.Mesh) o.frustumCulled = false; });
  return { group, eye, ring, rotorL, rotorR };
}

// ── JUGGERNAUT BOSS ──
export interface Boss { group: THREE.Group; core: THREE.Mesh; armL: THREE.Group; armR: THREE.Group; head: THREE.Mesh; }
export function buildJuggernaut(): Boss {
  const group = new THREE.Group();
  const armor = mat(0x2a1030, { roughness: 0.4, metalness: 0.8 });
  const dark = mat(0x0d0a14, { roughness: 0.5, metalness: 0.7 });
  const gm = glowMat(0xff2d78, 2.4);
  const torso = box(1.7, 1.9, 1.1, armor); torso.position.y = 2.6; group.add(torso);
  const core = sph(0.42, gm, 16); core.position.set(0, 2.7, 0.58); group.add(core);
  const ringT = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.08, 8, 24), dark);
  ringT.position.set(0, 2.7, 0.56); group.add(ringT);
  const head = box(0.7, 0.55, 0.7, dark); head.position.y = 3.9; group.add(head);
  const visor = box(0.55, 0.14, 0.08, gm); visor.position.set(0, 3.92, 0.36); group.add(visor);
  const mkArm = (x: number) => {
    const a = new THREE.Group();
    const upper = box(0.55, 1.2, 0.55, armor); upper.position.y = -0.5; a.add(upper);
    const fist = box(0.7, 0.7, 0.7, dark); fist.position.y = -1.4; a.add(fist);
    const kn = box(0.74, 0.18, 0.74, gm); kn.position.y = -1.35; a.add(kn);
    a.position.set(x, 3.2, 0);
    group.add(a);
    return a;
  };
  const armL = mkArm(-1.2); const armR = mkArm(1.2);
  const mkLeg = (x: number) => {
    const l = box(0.6, 1.7, 0.6, dark); l.position.set(x, 0.85, 0); group.add(l);
    const shin = box(0.64, 0.3, 0.64, gm); shin.position.set(x, 0.5, 0); group.add(shin);
    const foot = box(0.9, 0.3, 1.2, armor); foot.position.set(x, 0.15, -0.1); group.add(foot);
  };
  mkLeg(-0.55); mkLeg(0.55);
  const pack1 = box(0.5, 1.2, 0.4, dark); pack1.position.set(-0.6, 3.0, -0.7); group.add(pack1);
  const pack2 = box(0.5, 1.2, 0.4, dark); pack2.position.set(0.6, 3.0, -0.7); group.add(pack2);
  const ex1 = cyl(0.12, 0.16, 0.4, gm); ex1.position.set(-0.6, 3.75, -0.7); group.add(ex1);
  const ex2 = cyl(0.12, 0.16, 0.4, gm); ex2.position.set(0.6, 3.75, -0.7); group.add(ex2);
  group.traverse((o) => { if (o instanceof THREE.Mesh) o.frustumCulled = false; });
  return { group, core, armL, armR, head };
}

// ── TARGET (time attack) ──
export function buildTarget(): THREE.Group {
  const g = new THREE.Group();
  const pole = cyl(0.05, 0.07, 1.4, mat(0x334155)); pole.position.y = 0.7; g.add(pole);
  const board = cyl(0.55, 0.55, 0.12, mat(0xf8fafc), 20);
  board.rotation.x = Math.PI / 2; board.position.y = 1.7; g.add(board);
  const r1 = cyl(0.42, 0.42, 0.13, mat(0xef4444), 20); r1.rotation.x = Math.PI / 2; r1.position.y = 1.7; g.add(r1);
  const r2 = cyl(0.26, 0.26, 0.14, mat(0xf8fafc), 18); r2.rotation.x = Math.PI / 2; r2.position.y = 1.7; g.add(r2);
  const r3 = cyl(0.12, 0.12, 0.15, glowMat(0xfacc15, 1.8), 14); r3.rotation.x = Math.PI / 2; r3.position.y = 1.7; g.add(r3);
  g.traverse((o) => { if (o instanceof THREE.Mesh) o.frustumCulled = false; });
  return g;
}

// ── ORB (orb rush) ──
export function buildOrb(color = 0xa78bfa): THREE.Group {
  const g = new THREE.Group();
  const core = sph(0.3, glowMat(color, 2.6), 16); g.add(core);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.035, 8, 24), glowMat(color, 1.6));
  halo.rotation.x = Math.PI / 2.4; g.add(halo);
  const halo2 = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.02, 8, 24), glowMat(0xffffff, 1.0));
  halo2.rotation.x = -Math.PI / 3; g.add(halo2);
  const base = cyl(0.18, 0.26, 0.12, mat(0x1e293b)); base.position.y = -0.75; g.add(base);
  const beam = cyl(0.03, 0.03, 1.1, glowMat(color, 1.2)); beam.position.y = -0.2; g.add(beam);
  g.position.y = 1.1;
  g.traverse((o) => { if (o instanceof THREE.Mesh) o.frustumCulled = false; });
  return g;
}

// ── ARENA ──
export interface ArenaBuild { group: THREE.Group; colliders: THREE.Box3[]; spawns: THREE.Vector3[]; size: number; centerProp: THREE.Group; }
export function buildArena(id: ArenaId, seed = 7): ArenaBuild {
  const def = ARENAS.find((a) => a.id === id) ?? ARENAS[0];
  const group = new THREE.Group();
  const size = 64;
  const half = size / 2;

  // floor
  const floorGeo = new THREE.PlaneGeometry(size, size, 1, 1);
  const floorMat = new THREE.MeshStandardMaterial({ color: def.floor, roughness: 0.85, metalness: 0.2 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = false; group.add(floor);
  // grid overlay
  const grid = new THREE.GridHelper(size, 32, def.grid, def.grid);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.35;
  grid.position.y = 0.02; group.add(grid);
  // glowing border
  const borderMat = glowMat(def.accent, 1.8);
  const mkWallGlow = (w: number, x: number, z: number, ry: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.18, 0.18), borderMat);
    m.position.set(x, 0.35, z); m.rotation.y = ry; group.add(m);
  };
  mkWallGlow(size, 0, -half, 0); mkWallGlow(size, 0, half, 0);
  mkWallGlow(size, -half, 0, Math.PI / 2); mkWallGlow(size, half, 0, Math.PI / 2);

  // perimeter walls (low, visible)
  const wallMat = mat(0x101828, { roughness: 0.6, metalness: 0.5 });
  const wallH = 4;
  const mkWall = (w: number, x: number, z: number, ry: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, 1), wallMat);
    m.position.set(x, wallH / 2, z); m.rotation.y = ry; group.add(m);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 1.1), borderMat);
    top.position.set(x, wallH + 0.06, z); top.rotation.y = ry; group.add(top);
  };
  mkWall(size + 2, 0, -half, 0); mkWall(size + 2, 0, half, 0);
  mkWall(size + 2, -half, 0, Math.PI / 2); mkWall(size + 2, half, 0, Math.PI / 2);

  const colliders: THREE.Box3[] = [];
  const addCollider = (x: number, z: number, w: number, d: number, h = 3) => {
    colliders.push(new THREE.Box3(new THREE.Vector3(x - w / 2, 0, z - d / 2), new THREE.Vector3(x + w / 2, h, z + d / 2)));
  };

  // deterministic pseudo-random
  let s = seed * 9973 + 12345;
  const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };

  // obstacle crates + pillars + covers
  const crateMat = mat(0x1e293b, { roughness: 0.6, metalness: 0.4 });
  const crateGlow = glowMat(def.accent, 1.4);
  const spots: { x: number; z: number; w: number; d: number; h: number; pillar?: boolean }[] = [];
  // symmetric layout for fairness
  const quads: [number, number][] = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
  for (const [qx, qz] of quads) {
    spots.push({ x: qx * 10, z: qz * 10, w: 3.4, d: 3.4, h: 1.6 });
    spots.push({ x: qx * 20, z: qz * 6, w: 5, d: 1.4, h: 1.3 });
    spots.push({ x: qx * 6, z: qz * 21, w: 1.4, d: 5, h: 1.3 });
    spots.push({ x: qx * 23, z: qz * 23, w: 2.2, d: 2.2, h: 5.5, pillar: true });
  }
  spots.push({ x: 0, z: -14, w: 6, d: 1.6, h: 1.4 });
  spots.push({ x: 0, z: 14, w: 6, d: 1.6, h: 1.4 });
  spots.push({ x: -14, z: 0, w: 1.6, d: 6, h: 1.4 });
  spots.push({ x: 14, z: 0, w: 1.6, d: 6, h: 1.4 });

  for (const sp of spots) {
    const jitter = (rand() - 0.5) * 1.2;
    const x = sp.x + jitter, z = sp.z + (rand() - 0.5) * 1.2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(sp.w, sp.h, sp.d), sp.pillar ? wallMat : crateMat);
    m.position.set(x, sp.h / 2, z); group.add(m);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(sp.w + 0.08, 0.1, sp.d + 0.08), crateGlow);
    trim.position.set(x, sp.h + 0.05, z); group.add(trim);
    if (!sp.pillar) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(sp.w + 0.06, 0.14, sp.d + 0.06), crateGlow);
      stripe.position.set(x, 0.25, z); group.add(stripe);
    }
    addCollider(x, z, sp.w, sp.d, sp.h);
  }

  // center structure: floating obelisk / reactor
  const centerProp = new THREE.Group();
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 0.5, 8), wallMat);
  plat.position.y = 0.25; centerProp.add(plat);
  const obelisk = new THREE.Mesh(new THREE.OctahedronGeometry(1.8, 0), glowMat(def.accent, 2.0));
  obelisk.position.y = 4.2; obelisk.name = "obelisk"; centerProp.add(obelisk);
  const obBase = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 2.6, 6), crateMat);
  obBase.position.y = 1.6; centerProp.add(obBase);
  for (let i = 0; i < 4; i++) {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.2, 0.5), wallMat);
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    pylon.position.set(Math.cos(a) * 3.4, 1.6, Math.sin(a) * 3.4);
    centerProp.add(pylon);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.2, 0.56), crateGlow);
    tip.position.set(Math.cos(a) * 3.4, 3.3, Math.sin(a) * 3.4);
    centerProp.add(tip);
  }
  group.add(centerProp);
  addCollider(0, 0, 7.5, 7.5, 1.2);

  // corner jump pads (visual)
  for (const [qx, qz] of quads) {
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.25, 16), glowMat(def.grid, 1.0));
    pad.position.set(qx * 27, 0.12, qz * 27); group.add(pad);
  }

  // stars in sky
  const starGeo = new THREE.BufferGeometry();
  const starCount = 350;
  const pos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const a = rand() * Math.PI * 2;
    const r = 90 + rand() * 120;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = 12 + rand() * 90;
    pos[i * 3 + 2] = Math.sin(a) * r;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, transparent: true, opacity: 0.8, sizeAttenuation: true }));
  group.add(stars);

  // spawn points ring
  const spawns: THREE.Vector3[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    spawns.push(new THREE.Vector3(Math.cos(a) * 26, 0, Math.sin(a) * 26));
  }
  return { group, colliders, spawns, size, centerProp };
}
