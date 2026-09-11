import * as THREE from "three";
import type { ArenaId, WeaponId } from "./constants";
import { ARENAS, GUN_SKINS } from "./constants";

// ── helpers ──
function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.6, ...opts });
}
function glowMat(color: number, intensity = 1.8) {
  return new THREE.MeshStandardMaterial({ color: 0x080808, emissive: color, emissiveIntensity: intensity, roughness: 0.25, metalness: 0.15 });
}
function darkMat() { return mat(0x0c121c, { roughness: 0.5, metalness: 0.75 }); }
function box(w: number, h: number, d: number, m: THREE.Material) {
  const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  g.castShadow = false; g.receiveShadow = false;
  return g;
}
function cyl(rt: number, rb: number, h: number, m: THREE.Material, seg = 12) {
  const g = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg));
  g.castShadow = false;
  return g;
}
function sph(r: number, m: THREE.Material, seg = 14, segH?: number) {
  const g = new THREE.Mesh(new THREE.SphereGeometry(r, seg, segH ?? Math.max(8, seg - 3)));
  g.castShadow = false;
  return g;
}
function ring(r: number, tube: number, m: THREE.Material, seg = 24) {
  const g = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, seg), m);
  return g;
}
function cone(r: number, h: number, m: THREE.Material, seg = 12) {
  const g = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg));
  return g;
}

export function skinById(id: string) { return GUN_SKINS.find((s) => s.id === id) ?? GUN_SKINS[0]; }

// ── FIRST-PERSON ARMS ──
// Returns a pair of sleeve+glove arms that sit in front of the camera and hold the gun.
export function buildArms(suitPrimary: number, suitGlow: number): { group: THREE.Group; handL: THREE.Group; handR: THREE.Group } {
  const group = new THREE.Group();
  const suit = mat(suitPrimary, { roughness: 0.55, metalness: 0.5 });
  const suitDark = mat(0x0a0f18, { roughness: 0.6, metalness: 0.55 });
  const glove = mat(0x141c2a, { roughness: 0.4, metalness: 0.75 });
  const gm = glowMat(suitGlow, 2.0);

  const buildArm = (side: 1 | -1) => {
    const arm = new THREE.Group();
    // upper sleeve cylinder (emerges from bottom of camera)
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.35, 10), suit);
    upper.position.set(side * 0.08, -0.42, -0.12);
    upper.rotation.z = side * 0.2;
    arm.add(upper);
    // seam trim
    const trim = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 10), gm);
    trim.position.set(side * 0.08, -0.26, -0.12);
    trim.rotation.z = side * 0.2;
    arm.add(trim);
    // forearm
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.3, 10), suitDark);
    fore.geometry.translate(0, -0.15, 0);
    fore.position.set(side * 0.13, -0.48, -0.28);
    fore.rotation.z = side * 0.15;
    arm.add(fore);
    // glove hand
    const hand = new THREE.Group();
    const handBox = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.14), glove);
    handBox.position.y = -0.04;
    hand.add(handBox);
    // knuckle plate
    const knuckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.15), gm);
    knuckle.position.set(0, 0.02, -0.03);
    hand.add(knuckle);
    // fingers (3 boxes on front of hand for the gripping hand)
    for (let i = -1; i <= 1; i++) {
      const fg = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.08), glove);
      fg.position.set(i * 0.03, -0.06, -0.12);
      hand.add(fg);
    }
    // thumb
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.028, 0.06), glove);
    thumb.position.set(-side * 0.06, -0.04, -0.06);
    thumb.rotation.x = -0.4;
    hand.add(thumb);
    // wrist band (glowing light)
    const wrist = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.012, 6, 14), gm);
    wrist.position.set(0, 0.03, 0.04);
    wrist.rotation.x = Math.PI / 2;
    hand.add(wrist);
    hand.position.set(side * 0.18, -0.6, -0.42);
    hand.rotation.z = side * 0.08;
    arm.add(hand);
    group.add(arm);
    return hand;
  };

  const handL = buildArm(-1);
  const handR = buildArm(1);

  group.traverse((o) => { if (o instanceof THREE.Mesh) o.frustumCulled = false; });
  return { group, handL, handR };
}

// ── VIEWMODEL GUNS ──
export function buildGunMesh(weapon: WeaponId, skinId: string): THREE.Group {
  const skin = skinById(skinId);
  const g = new THREE.Group();
  const body = mat(0x1b2430, { roughness: 0.3, metalness: 0.8 });
  const dark = mat(0x080d16, { roughness: 0.45, metalness: 0.7 });
  const primary = mat(skin.primary, { roughness: 0.28, metalness: 0.75 });
  const glow = glowMat(skin.glow, 2.4);
  const chrome = mat(0xc8d3df, { roughness: 0.12, metalness: 0.95 });

  const add = (m: THREE.Mesh, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); g.add(m); return m; };

  if (weapon === "blade") {
    const hilt = add(cyl(0.028, 0.034, 0.24, dark), 0, 0, 0); hilt.rotation.x = Math.PI / 2;
    const grip = add(cyl(0.026, 0.03, 0.16, primary), 0, -0.02, 0.04); grip.rotation.x = Math.PI / 2;
    const guard = add(box(0.12, 0.03, 0.03, primary), 0, 0, -0.13);
    void guard;
    // blade: tapered prism via two thin plates
    const b1 = add(box(0.03, 0.06, 0.9, glow), 0, 0.01, -0.6);
    b1.scale.x = 1;
    const b2 = add(box(0.055, 0.012, 0.9, glow), 0, 0.01, -0.6);
    void b2;
    const tip = add(cone(0.035, 0.18, glow, 8), 0, 0.01, -1.08); tip.rotation.x = -Math.PI / 2;
    // energy coil
    const coilHub = add(box(0.08, 0.08, 0.08, dark), 0, 0, -0.02);
    void coilHub;
    for (let i = 0; i < 3; i++) {
      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.009, 6, 12), glow);
      ring1.position.set(0, 0, -0.02); ring1.rotation.x = Math.PI / 2;
      ring1.rotation.z = (i / 3) * Math.PI;
      g.add(ring1);
    }
    // pommel gem
    add(sph(0.035, glow, 10), 0, 0, 0.13);
  } else if (weapon === "scatter") {
    add(box(0.1, 0.11, 0.5, body), 0, 0, -0.25);
    // heat shroud on top
    add(box(0.08, 0.03, 0.5, dark), 0, 0.07, -0.25);
    // twin barrels w/ muzzle brakes
    for (const ox of [-0.03, 0.03]) {
      const b = add(cyl(0.03, 0.03, 0.58, dark), ox, 0.02, -0.55); b.rotation.x = Math.PI / 2;
      const brake = add(cyl(0.042, 0.035, 0.07, primary), ox, 0.02, -0.86); brake.rotation.x = Math.PI / 2;
      const vent = add(box(0.055, 0.02, 0.02, glow), ox, -0.03, -0.4);
      void vent;
    }
    const pump = add(box(0.13, 0.08, 0.18, primary), 0, -0.05, -0.45); pump.name = "pump";
    // ribbed detail on pump
    for (let i = 0; i < 4; i++) {
      const rib = add(box(0.14, 0.012, 0.02, dark), 0, -0.03, -0.38 - i * 0.04);
      void rib;
    }
    add(box(0.08, 0.18, 0.1, dark), 0, -0.14, 0.08);
    add(box(0.05, 0.06, 0.12, dark), 0, -0.1, -0.05);
    // shell port
    add(box(0.06, 0.04, 0.08, chrome), 0, 0.06, -0.1);
    // red dot sight
    add(cyl(0.016, 0.016, 0.02, glow), 0, 0.12, -0.18);
  } else if (weapon === "rail") {
    add(box(0.085, 0.09, 0.72, body), 0, 0, -0.3);
    // capacitor coils along top
    for (let i = 0; i < 5; i++) {
      const c = add(cyl(0.02, 0.02, 0.05, glow), 0, 0.06, -0.2 - i * 0.13); c.rotation.z = Math.PI / 2;
    }
    const rail1 = add(box(0.018, 0.018, 0.66, glow), -0.052, 0.01, -0.58);
    const rail2 = add(box(0.018, 0.018, 0.66, glow), 0.052, 0.01, -0.58);
    void rail1; void rail2;
    // accelerator muzzle
    const tip = add(cyl(0.042, 0.05, 0.18, primary), 0, 0.01, -1.0); tip.rotation.x = Math.PI / 2;
    const tipGlow = add(cyl(0.022, 0.025, 0.06, glow), 0, 0.01, -1.08); tipGlow.rotation.x = Math.PI / 2;
    add(box(0.07, 0.13, 0.28, dark), 0, -0.06, 0.18);
    // scope
    const scope = add(cyl(0.04, 0.04, 0.26, dark), 0, 0.1, -0.2); scope.rotation.x = Math.PI / 2;
    const lens = add(cyl(0.034, 0.034, 0.02, glow), 0, 0.1, -0.08); lens.rotation.x = Math.PI / 2;
    const lensF = add(cyl(0.03, 0.03, 0.02, chrome), 0, 0.1, -0.33); lensF.rotation.x = Math.PI / 2;
    add(box(0.08, 0.04, 0.06, dark), 0, 0.06, -0.22);
    add(box(0.07, 0.16, 0.1, dark), 0, -0.12, -0.02);
    // bi-pod stub
    add(box(0.02, 0.08, 0.04, dark), -0.03, -0.08, -0.65);
    add(box(0.02, 0.08, 0.04, dark), 0.03, -0.08, -0.65);
  } else if (weapon === "thumper") {
    const drum = add(cyl(0.1, 0.1, 0.26, primary), 0, -0.02, -0.32); drum.rotation.x = Math.PI / 2;
    // grenade windows
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const w = add(box(0.03, 0.03, 0.03, glow), Math.cos(a) * 0.1, -0.02, Math.sin(a) * 0.1 - 0.32);
      void w;
    }
    add(box(0.1, 0.1, 0.5, body), 0, 0.04, -0.27);
    const barrel = add(cyl(0.06, 0.065, 0.34, dark), 0, 0.04, -0.64); barrel.rotation.x = Math.PI / 2;
    const mz = add(cyl(0.08, 0.07, 0.08, primary), 0, 0.04, -0.83); mz.rotation.x = Math.PI / 2;
    const ring1 = add(ring(0.085, 0.012, glow), 0, 0.04, -0.55); ring1.rotation.x = Math.PI / 2;
    const ring2 = add(ring(0.085, 0.012, glow), 0, 0.04, -0.4); ring2.rotation.x = Math.PI / 2;
    add(box(0.08, 0.17, 0.1, dark), 0, -0.13, 0.06);
    // top sight rail
    add(box(0.03, 0.04, 0.2, dark), 0, 0.11, -0.35);
    add(sph(0.015, glow, 8), 0, 0.14, -0.48);
  } else {
    // rifle + smg
    const long = weapon === "rifle";
    add(box(0.09, 0.1, long ? 0.66 : 0.48, body), 0, 0, -0.32);
    // top rail
    add(box(0.04, 0.025, long ? 0.5 : 0.32, dark), 0, 0.06, -0.32);
    // handguard vents
    for (let i = 0; i < 6; i++) {
      add(box(0.05, 0.02, 0.015, dark), 0, 0.02, -0.15 - i * (long ? 0.07 : 0.05));
    }
    const barrel = add(cyl(0.026, 0.03, long ? 0.42 : 0.28, dark), 0, 0.015, long ? -0.78 : -0.62);
    barrel.rotation.x = Math.PI / 2;
    // muzzle device
    const mz = add(cyl(0.032, 0.028, 0.06, primary), 0, 0.015, long ? -1.0 : -0.76); mz.rotation.x = Math.PI / 2;
    // glowing energy strips
    add(box(0.018, 0.012, long ? 0.52 : 0.36, glow), -0.055, 0, -0.38);
    add(box(0.018, 0.012, long ? 0.52 : 0.36, glow), 0.055, 0, -0.38);
    // magazine with bullet window
    const magH = long ? 0.17 : 0.22;
    const magMesh = add(box(0.065, magH, 0.09, primary), 0, -0.13, -0.3);
    magMesh.rotation.x = 0.15;
    const win = add(box(0.04, 0.06, 0.012, chrome), 0, -0.12, -0.25);
    win.rotation.x = 0.15;
    add(box(0.075, 0.14, 0.11, dark), 0, -0.11, 0.06);
    // iron sights
    const post = add(box(0.02, 0.06, 0.04, dark), 0, 0.085, -0.18); void post;
    add(box(0.02, 0.05, 0.03, dark), 0, 0.08, long ? -0.8 : -0.58);
    add(box(0.014, 0.014, 0.014, glow), 0, 0.11, -0.18);
    if (!long) {
      const grip = add(box(0.05, 0.11, 0.07, dark), 0, -0.11, -0.47); grip.rotation.x = -0.3;
      // folding stock
      add(box(0.04, 0.08, 0.06, primary), 0, -0.06, 0.18);
    } else {
      // fixed stock with butt pad
      add(box(0.07, 0.11, 0.2, dark), 0, -0.02, 0.2);
      add(box(0.075, 0.08, 0.05, primary), 0, -0.02, 0.3);
    }
  }

  // muzzle anchor
  const muzzle = new THREE.Object3D();
  muzzle.name = "muzzle";
  muzzle.position.set(0, weapon === "blade" ? 0.01 : 0.02, weapon === "rail" ? -1.12 : weapon === "blade" ? -1.1 : weapon === "thumper" ? -0.88 : weapon === "scatter" ? -0.9 : -0.88);
  g.add(muzzle);

  // shell ejection port (small opening on right side)
  if (!["blade", "thumper", "rail"].includes(weapon)) {
    add(box(0.04, 0.03, 0.06, dark), 0.05, 0.03, -0.08);
  }

  g.traverse((o) => { if (o instanceof THREE.Mesh) o.frustumCulled = false; });
  return g;
}

// ── HEALTH BAR (billboard above heads) ──
export function buildHealthBar(): { group: THREE.Group; fill: THREE.Mesh; bg: THREE.Mesh } {
  const group = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false }));
  bg.renderOrder = 999;
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.08), new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.95, depthWrite: false }));
  fill.renderOrder = 1000;
  fill.position.z = 0.002;
  group.add(bg); group.add(fill);
  group.traverse((o) => { if (o instanceof THREE.Mesh) o.frustumCulled = false; });
  return { group, fill, bg };
}

// ── HUMANOID ──
export interface Humanoid {
  group: THREE.Group; head: THREE.Mesh; torso: THREE.Mesh;
  legL: THREE.Group; legR: THREE.Group; thighL: THREE.Mesh; thighR: THREE.Mesh; shinL: THREE.Mesh; shinR: THREE.Mesh;
  armL: THREE.Group; armR: THREE.Group; upperArmL: THREE.Mesh; upperArmR: THREE.Mesh; foreArmL: THREE.Mesh; foreArmR: THREE.Mesh;
  visor: THREE.Mesh; gun: THREE.Group; hpBar: { group: THREE.Group; fill: THREE.Mesh };
}

export function buildHumanoid(primary: number, secondary: number, glow: number, scale = 1): Humanoid {
  const group = new THREE.Group();
  const pm = mat(primary, { roughness: 0.4, metalness: 0.6 });
  const sm = mat(secondary, { roughness: 0.5, metalness: 0.5 });
  const dm = darkMat();
  const gm = glowMat(glow, 2.2);

  // TORSO
  const torso = box(0.58, 0.55, 0.34, pm); torso.position.y = 1.35; group.add(torso);
  // ab plate
  const abs = box(0.42, 0.28, 0.28, dm); abs.position.y = 1.0; group.add(abs);
  // chest reactor
  const reactor = sph(0.11, gm, 12); reactor.position.set(0, 1.4, 0.19); group.add(reactor);
  const chestRing = ring(0.14, 0.018, gm, 14); chestRing.position.set(0, 1.4, 0.2); chestRing.rotation.x = Math.PI / 2.2; group.add(chestRing);
  // belt
  const belt = box(0.62, 0.12, 0.38, dm); belt.position.y = 0.85; group.add(belt);
  const beltLight = box(0.06, 0.06, 0.06, gm); beltLight.position.set(0, 0.85, 0.2); group.add(beltLight);
  // shoulder pauldrons
  const padL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), pm);
  padL.position.set(-0.38, 1.6, 0); group.add(padL);
  const padR = padL.clone(); padR.position.x = 0.38; group.add(padR);
  const padTrimL = ring(0.18, 0.02, gm, 12); padTrimL.position.set(-0.38, 1.55, 0); padTrimL.rotation.x = Math.PI / 2; group.add(padTrimL);
  const padTrimR = padTrimL.clone(); padTrimR.position.x = 0.38; group.add(padTrimR);

  // HEAD
  const head = box(0.34, 0.34, 0.36, sm); head.position.y = 1.9; group.add(head);
  // helmet dome
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), sm);
  dome.position.set(0, 1.98, 0); group.add(dome);
  // visor (slanted wedge)
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.11, 0.06), gm);
  visor.position.set(0, 1.88, 0.19); visor.rotation.x = -0.2; group.add(visor);
  // antenna/comm
  const ant = cyl(0.008, 0.008, 0.22, dm, 6); ant.position.set(-0.15, 2.15, -0.02); group.add(ant);
  const antTip = sph(0.02, gm, 8); antTip.position.set(-0.15, 2.27, -0.02); group.add(antTip);
  // crest / mohawk
  const crest = box(0.06, 0.14, 0.3, dm); crest.position.set(0, 2.12, 0); group.add(crest);

  // ARMS (two-part: upper + forearm, pivoted at shoulder/elbow)
  const mkArm = (x: number) => {
    const arm = new THREE.Group();
    const upper = box(0.16, 0.42, 0.16, sm); upper.geometry.translate(0, -0.2, 0);
    const upperMat = upper;
    arm.add(upperMat);
    const elbow = new THREE.Group(); elbow.position.y = -0.42;
    const fore = box(0.14, 0.38, 0.14, pm); fore.geometry.translate(0, -0.1, 0);
    elbow.add(fore);
    const glove = box(0.15, 0.14, 0.15, dm); glove.position.y = -0.32; elbow.add(glove);
    const knuckle = box(0.16, 0.035, 0.16, gm); knuckle.position.set(0, -0.24, 0.02); elbow.add(knuckle);
    arm.add(elbow);
    arm.position.set(x, 1.55, 0);
    group.add(arm);
    return { arm, upper: upperMat, fore, elbow };
  };
  const aL = mkArm(-0.42); const aR = mkArm(0.42);

  // LEGS (thigh + shin, pivoted at hip/knee)
  const mkLeg = (x: number) => {
    const leg = new THREE.Group();
    const thigh = box(0.22, 0.48, 0.22, dm); thigh.geometry.translate(0, -0.2, 0); leg.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.48;
    const shin = box(0.2, 0.5, 0.2, pm); shin.geometry.translate(0, -0.2, 0); knee.add(shin);
    const boot = box(0.26, 0.14, 0.38, dm); boot.position.set(0, -0.5, 0.04); knee.add(boot);
    const toe = box(0.22, 0.08, 0.14, pm); toe.position.set(0, -0.47, 0.24); knee.add(toe);
    const kneePad = box(0.24, 0.13, 0.14, pm); kneePad.position.set(0, -0.48, 0.08); knee.add(kneePad);
    const kneeGlow = box(0.1, 0.05, 0.06, gm); kneeGlow.position.set(0, -0.44, 0.15); knee.add(kneeGlow);
    leg.add(knee);
    leg.position.set(x, 1.1, 0);
    group.add(leg);
    return { leg, thigh, shin };
  };
  const lL = mkLeg(-0.16); const lR = mkLeg(0.16);

  // Backpack with glowing cores
  const pack = box(0.4, 0.7, 0.22, dm); pack.position.set(0, 1.4, -0.28); group.add(pack);
  for (const px of [-0.1, 0.1]) {
    const core = cyl(0.045, 0.05, 0.2, gm); core.position.set(px, 1.55, -0.4); core.rotation.x = Math.PI / 2; group.add(core);
    const vent = box(0.05, 0.08, 0.04, pm); vent.position.set(px, 1.2, -0.4); group.add(vent);
  }
  // antenna on pack
  const ant2 = cyl(0.006, 0.006, 0.3, dm, 5); ant2.position.set(0.18, 1.75, -0.3); group.add(ant2);

  // gun in right hand
  const gun = new THREE.Group();
  const gb = box(0.1, 0.12, 0.6, dm); gun.add(gb);
  const gg = box(0.11, 0.04, 0.4, gm); gg.position.y = 0.04; gun.add(gg);
  const gMZ = cyl(0.03, 0.03, 0.15, dm); gMZ.position.set(0, 0.02, -0.4); gMZ.rotation.x = Math.PI / 2; gun.add(gMZ);
  const gMag = box(0.07, 0.14, 0.08, pm); gMag.position.set(0, -0.1, -0.15); gun.add(gMag);
  gun.position.set(0.42, 1.1, -0.3);
  // attach gun to right hand by re-parenting (position into forearm)
  aR.elbow.add(gun);
  gun.position.set(0, -0.18, -0.18);
  gun.rotation.set(0, 0, 0);

  // health bar above head
  const hpBar = buildHealthBar();
  hpBar.group.position.set(0, 2.45, 0);
  group.add(hpBar.group);

  group.scale.setScalar(scale);
  group.traverse((o) => { if (o instanceof THREE.Mesh) o.frustumCulled = false; });

  return {
    group, head, torso,
    legL: lL.leg, legR: lR.leg, thighL: lL.thigh, thighR: lR.thigh, shinL: lL.shin, shinR: lR.shin,
    armL: aL.arm, armR: aR.arm, upperArmL: aL.upper, upperArmR: aR.upper, foreArmL: aL.fore, foreArmR: aR.fore,
    visor, gun, hpBar,
  };
}

export function animateHumanoid(h: Humanoid, t: number, moving: boolean, aiming = false) {
  const s = moving ? Math.sin(t * 10) * 0.7 : Math.sin(t * 2) * 0.04;
  // Thigh & shin driven by s
  h.thighL.rotation.x = s;
  h.thighR.rotation.x = -s;
  // Knee bends when leg is forward
  const lKnee = Math.max(0, s) * 0.9;
  const rKnee = Math.max(0, -s) * 0.9;
  const kneeGroupL = h.shinL.parent as THREE.Group;
  const kneeGroupR = h.shinR.parent as THREE.Group;
  if (kneeGroupL) kneeGroupL.rotation.x = lKnee;
  if (kneeGroupR) kneeGroupR.rotation.x = rKnee;
  // Arms swing opposite
  const elbowL = h.foreArmL.parent as THREE.Group;
  const elbowR = h.foreArmR.parent as THREE.Group;
  h.armL.rotation.x = moving ? -s * 0.7 : Math.sin(t * 2 + 1) * 0.05;
  h.armR.rotation.x = aiming ? -1.5 : (moving ? s * 0.7 : Math.sin(t * 2) * 0.05);
  if (elbowL) elbowL.rotation.x = moving ? Math.abs(s) * 0.4 : 0.1;
  if (elbowR) elbowR.rotation.x = aiming ? 0.3 : (moving ? Math.abs(s) * 0.4 : 0.1);
  // Idle bob
  h.group.position.y = moving ? Math.abs(Math.sin(t * 10)) * 0.07 : Math.sin(t * 2) * 0.02;
  // Visor pulse
  (h.visor.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.6 + Math.sin(t * 5) * 0.5;
}

// ── DRONE ──
export interface Drone {
  group: THREE.Group; eye: THREE.Mesh; ring: THREE.Mesh; rotorL: THREE.Mesh; rotorR: THREE.Mesh;
  thrusterL: THREE.Mesh; thrusterR: THREE.Mesh; cannonL: THREE.Group; cannonR: THREE.Group;
}

export function buildDrone(glowColor = 0xff3b5c): Drone {
  const group = new THREE.Group();
  const dm = mat(0x1a2230, { roughness: 0.3, metalness: 0.85 });
  const gm = glowMat(glowColor, 2.6);
  const gmDim = glowMat(glowColor, 1.0);
  // core
  const core = sph(0.34, dm, 16); core.position.y = 0; group.add(core);
  // carapace shell (hex)
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.2, 6), dm); group.add(shell);
  // eye
  const eye = sph(0.18, gm, 12); eye.position.set(0, 0.02, 0.32); group.add(eye);
  const eyeRing = ring(0.22, 0.02, gm, 14); eyeRing.position.set(0, 0.02, 0.32); eyeRing.rotation.y = Math.PI / 2; group.add(eyeRing);
  // main ring
  const ringMain = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 24), gm);
  ringMain.rotation.x = Math.PI / 2; ringMain.position.y = -0.08; group.add(ringMain);
  // rotating inner ring
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.02, 6, 18), gmDim);
  ring2.rotation.x = Math.PI / 2; ring2.position.y = -0.05; ring2.name = "ring2"; group.add(ring2);

  // rotors
  const mkRotor = (x: number) => {
    const pylon = box(0.12, 0.1, 0.3, dm);
    pylon.position.set(x * 0.6, 0.18, 0); group.add(pylon);
    const hub = cyl(0.08, 0.08, 0.08, dm, 10);
    hub.position.set(x * 1.05, 0.22, 0); hub.rotation.x = Math.PI / 2; group.add(hub);
    const r = box(0.85, 0.015, 0.1, mat(0x0b0f16)); r.position.set(x * 1.05, 0.28, 0); group.add(r);
    for (const sgn of [-1, 1]) {
      const tip = box(0.08, 0.03, 0.1, gm); tip.position.set(x * 1.05 + sgn * 0.4, 0.28, 0); group.add(tip);
    }
    // thruster glow below
    const thrust = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 10), gm);
    thrust.position.set(x * 1.05, -0.05, 0); thrust.rotation.x = Math.PI; group.add(thrust);
    return { rotor: r, thrust };
  };
  const rL = mkRotor(-1), rR = mkRotor(1);

  // chin cannons
  const mkCannon = (x: number) => {
    const cg = new THREE.Group();
    const base = box(0.1, 0.12, 0.18, dm); cg.add(base);
    const barrel = cyl(0.025, 0.025, 0.28, dm); barrel.position.set(0, -0.03, -0.22); barrel.rotation.x = Math.PI / 2; cg.add(barrel);
    const tipGlow = cyl(0.03, 0.03, 0.05, gm); tipGlow.position.set(0, -0.03, -0.37); tipGlow.rotation.x = Math.PI / 2; cg.add(tipGlow);
    cg.position.set(x, -0.1, 0.1);
    group.add(cg);
    return cg;
  };
  const cannonL = mkCannon(-0.16), cannonR = mkCannon(0.16);

  // underside spike + beacon
  const spike = cyl(0.04, 0.1, 0.3, dm); spike.position.y = -0.35; group.add(spike);
  const under = sph(0.08, gm, 10); under.position.y = -0.55; group.add(under);

  group.traverse((o) => { if (o instanceof THREE.Mesh) o.frustumCulled = false; });
  return { group, eye, ring: ringMain, rotorL: rL.rotor, rotorR: rR.rotor, thrusterL: rL.thrust, thrusterR: rR.thrust, cannonL, cannonR };
}

// ── JUGGERNAUT ──
export interface Boss {
  group: THREE.Group; core: THREE.Mesh; armL: THREE.Group; armR: THREE.Group; head: THREE.Mesh;
  hpBar: { group: THREE.Group; fill: THREE.Mesh };
}

export function buildJuggernaut(): Boss {
  const group = new THREE.Group();
  const armor = mat(0x2a1030, { roughness: 0.35, metalness: 0.85 });
  const armorTrim = mat(0x431850, { roughness: 0.4, metalness: 0.75 });
  const dark = mat(0x0d0a14, { roughness: 0.5, metalness: 0.7 });
  const gm = glowMat(0xff2d78, 2.6);
  const hot = glowMat(0xffdf66, 1.5);

  // legs with pistons
  const mkLeg = (x: number) => {
    const lg = new THREE.Group();
    const thigh = box(0.7, 1.1, 0.7, armor); thigh.geometry.translate(0, -0.4, 0); lg.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.9;
    const shin = box(0.65, 1.0, 0.65, dark); shin.geometry.translate(0, -0.4, 0); knee.add(shin);
    const piston = cyl(0.08, 0.08, 0.6, mat(0xcbd5e1, { metalness: 0.9, roughness: 0.2 }), 10);
    piston.position.set(x > 0 ? 0.2 : -0.2, -0.2, 0); knee.add(piston);
    const foot = box(1.1, 0.3, 1.4, armor); foot.position.set(0, -1.05, -0.1); knee.add(foot);
    const toe = box(0.9, 0.2, 0.4, armorTrim); toe.position.set(0, -0.9, 0.6); knee.add(toe);
    const shinGlow = box(0.7, 0.2, 0.7, gm); shinGlow.position.set(0, -0.6, 0); knee.add(shinGlow);
    lg.add(knee);
    lg.position.set(x, 1.5, 0);
    group.add(lg);
    return { lg, piston };
  };
  mkLeg(-0.65); mkLeg(0.65);

  // hips
  const hips = box(1.8, 0.6, 1.2, armor); hips.position.y = 2.1; group.add(hips);

  // torso
  const torso = box(1.85, 2, 1.2, armor); torso.position.y = 3.3; group.add(torso);
  const abs = box(1.4, 0.7, 1.0, dark); abs.position.y = 2.4; group.add(abs);
  // core
  const core = sph(0.48, gm, 18); core.position.set(0, 3.3, 0.65); core.name = "bossCore"; group.add(core);
  const coreRing = ring(0.62, 0.09, dark, 28); coreRing.position.set(0, 3.3, 0.6); group.add(coreRing);
  const coreRing2 = ring(0.72, 0.03, gm, 28); coreRing2.position.set(0, 3.3, 0.58); coreRing2.name = "coreSpin"; group.add(coreRing2);

  // pauldrons
  const pauldronL = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), armor);
  pauldronL.position.set(-1.3, 4.2, 0); group.add(pauldronL);
  const pauldronR = pauldronL.clone(); pauldronR.position.x = 1.3; group.add(pauldronR);
  // horn/spike on pauldrons
  const spikeL = cone(0.15, 0.5, dark, 8); spikeL.position.set(-1.3, 4.65, 0); spikeL.rotation.z = -0.3; group.add(spikeL);
  const spikeR = cone(0.15, 0.5, dark, 8); spikeR.position.set(1.3, 4.65, 0); spikeR.rotation.z = 0.3; group.add(spikeR);

  // head
  const head = box(0.8, 0.65, 0.8, dark); head.position.y = 4.7; group.add(head);
  const crown = box(0.55, 0.3, 0.6, armor); crown.position.set(0, 5.1, 0); group.add(crown);
  // horns
  const hL = cone(0.1, 0.45, dark, 8); hL.position.set(-0.25, 5.35, 0); hL.rotation.z = -0.4; group.add(hL);
  const hR = cone(0.1, 0.45, dark, 8); hR.position.set(0.25, 5.35, 0); hR.rotation.z = 0.4; group.add(hR);
  const visor = box(0.6, 0.16, 0.08, gm); visor.position.set(0, 4.75, 0.42); visor.rotation.x = -0.15; group.add(visor);
  // three eyes
  for (const ex of [-0.18, 0, 0.18]) {
    const e = sph(0.05, hot, 8); e.position.set(ex, 4.78, 0.46); group.add(e);
  }

  // arms (two part)
  const mkArm = (x: number) => {
    const a = new THREE.Group();
    const upper = box(0.6, 1.3, 0.6, armor); upper.geometry.translate(0, -0.5, 0); a.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -1.1;
    const forearm = box(0.5, 1.0, 0.5, dark); forearm.geometry.translate(0, -0.4, 0); elbow.add(forearm);
    const fist = box(0.75, 0.8, 0.8, dark); fist.position.y = -1.3; elbow.add(fist);
    const kn = box(0.8, 0.2, 0.82, gm); kn.position.y = -1.2; elbow.add(kn);
    // cannon built into forearm
    const cannon = cyl(0.07, 0.08, 0.7, dark); cannon.position.set(0, -0.5, -0.25); cannon.rotation.x = Math.PI / 2; elbow.add(cannon);
    const cGlow = cyl(0.05, 0.05, 0.08, gm); cGlow.position.set(0, -0.5, -0.6); cGlow.rotation.x = Math.PI / 2; elbow.add(cGlow);
    a.add(elbow);
    a.position.set(x, 4.0, 0);
    group.add(a);
    return a;
  };
  const armL = mkArm(-1.5); const armR = mkArm(1.5);

  // backpack/exhaust
  const pack1 = box(0.55, 1.3, 0.45, dark); pack1.position.set(-0.7, 3.6, -0.8); group.add(pack1);
  const pack2 = box(0.55, 1.3, 0.45, dark); pack2.position.set(0.7, 3.6, -0.8); group.add(pack2);
  for (const px of [-0.7, 0.7]) {
    const ex = cyl(0.14, 0.18, 0.5, gm); ex.position.set(px, 4.4, -0.85); ex.rotation.x = Math.PI / 2; group.add(ex);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.6, 10), hot);
    plume.position.set(px, 4.4, -1.35); plume.name = "plume"; group.add(plume);
  }

  // HP bar
  const hpBar = buildHealthBar();
  hpBar.group.position.set(0, 5.9, 0);
  hpBar.group.scale.setScalar(2.2);
  group.add(hpBar.group);

  group.traverse((o) => { if (o instanceof THREE.Mesh) o.frustumCulled = false; });
  return { group, core, armL, armR, head, hpBar };
}

// ── TARGET ──
export function buildTarget(): THREE.Group {
  const g = new THREE.Group();
  const pole = cyl(0.04, 0.06, 1.6, mat(0x334155)); pole.position.y = 0.8; g.add(pole);
  const base = cyl(0.4, 0.5, 0.12, mat(0x1e293b), 14); base.position.y = 0.06; g.add(base);
  const ringGlow = cyl(0.42, 0.42, 0.04, glowMat(0xfacc15, 1.2), 14); ringGlow.rotation.x = Math.PI / 2; ringGlow.position.y = 0.12; g.add(ringGlow);
  // Hovering target
  const hover = new THREE.Group(); hover.position.y = 2.0;
  const board = cyl(0.55, 0.55, 0.12, mat(0xf8fafc), 24); board.rotation.x = Math.PI / 2; hover.add(board);
  const r1 = cyl(0.42, 0.42, 0.13, mat(0xef4444), 20); r1.rotation.x = Math.PI / 2; hover.add(r1);
  const r2 = cyl(0.26, 0.26, 0.14, mat(0xf8fafc), 18); r2.rotation.x = Math.PI / 2; hover.add(r2);
  const r3 = cyl(0.12, 0.12, 0.15, glowMat(0xfacc15, 1.8), 14); r3.rotation.x = Math.PI / 2; hover.add(r3);
  const standoff = cyl(0.03, 0.03, 0.3, mat(0x1e293b)); standoff.position.y = -0.2; hover.add(standoff);
  hover.name = "hover"; g.add(hover);
  g.traverse((o) => { if (o instanceof THREE.Mesh) o.frustumCulled = false; });
  return g;
}

// ── ORB ──
export function buildOrb(color = 0xa78bfa): THREE.Group {
  const g = new THREE.Group();
  const core = sph(0.32, glowMat(color, 2.8), 18); g.add(core);
  const shell = sph(0.42, new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, roughness: 0.1, metalness: 0.9 }), 16); g.add(shell);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 26), glowMat(color, 1.8));
  halo.rotation.x = Math.PI / 2.4; halo.name = "halo"; g.add(halo);
  const halo2 = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.02, 8, 26), glowMat(0xffffff, 1.2));
  halo2.rotation.x = -Math.PI / 3; halo2.name = "halo2"; g.add(halo2);
  const halo3 = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.012, 6, 20), glowMat(color, 1.0));
  halo3.name = "halo3"; g.add(halo3);
  const base = cyl(0.2, 0.3, 0.14, mat(0x1e293b)); base.position.y = -0.8; g.add(base);
  const beam = cyl(0.025, 0.04, 1.2, glowMat(color, 1.4)); beam.position.y = -0.2; g.add(beam);
  g.position.y = 1.2;
  g.traverse((o) => { if (o instanceof THREE.Mesh) o.frustumCulled = false; });
  return g;
}

// ── PICKUPS (health / ammo) ──
export function buildPickup(kind: "health" | "ammo"): THREE.Group {
  const g = new THREE.Group();
  const color = kind === "health" ? 0x22d3ee : 0xfacc15;
  const gm = glowMat(color, 2.2);
  const stand = cyl(0.3, 0.4, 0.12, mat(0x1e293b), 12); stand.position.y = 0.06; g.add(stand);
  const pad = cyl(0.32, 0.32, 0.04, gm, 12); pad.position.y = 0.13; pad.rotation.x = Math.PI / 2; g.add(pad);
  const pillar = cyl(0.04, 0.04, 0.8, new THREE.MeshStandardMaterial({ color: color, transparent: true, opacity: 0.6, emissive: color, emissiveIntensity: 0.8 })); pillar.position.y = 0.55; g.add(pillar);
  const icon = new THREE.Group();
  if (kind === "health") {
    const h = box(0.28, 0.1, 0.1, gm); icon.add(h);
    const v = box(0.1, 0.28, 0.1, gm); icon.add(v);
  } else {
    const body = box(0.25, 0.3, 0.15, mat(0x1b2430)); icon.add(body);
    const tip = cone(0.12, 0.18, gm, 8); tip.position.y = 0.2; tip.rotation.x = Math.PI; icon.add(tip);
    const bRing = ring(0.17, 0.02, gm, 12); bRing.position.y = -0.08; icon.add(bRing);
  }
  icon.position.y = 1.2; icon.name = "icon";
  g.add(icon);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.02, 6, 20), gm);
  halo.rotation.x = Math.PI / 2; halo.position.y = 0.2; g.add(halo);
  g.traverse((o) => { if (o instanceof THREE.Mesh) o.frustumCulled = false; });
  return g;
}

// ── SHELL CASING (simple metal cylinder spawned at shoot time) ──
export function buildShell(color = 0xd4a373): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.022, 0.07, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.9 }),
  );
  m.castShadow = false;
  m.frustumCulled = false;
  return m;
}

// ── BULLET HOLE (world-aligned decal quad) ──
export function buildBulletHole(): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.18),
    new THREE.MeshBasicMaterial({ color: 0x050608, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
  );
  m.frustumCulled = false;
  m.renderOrder = 1;
  return m;
}

// ── ARENA ──
export interface ArenaBuild {
  group: THREE.Group; colliders: THREE.Box3[]; spawns: THREE.Vector3[]; size: number;
  centerProp: THREE.Group; reactorLight: THREE.PointLight;
  jumpPads: { pos: THREE.Vector3; mesh: THREE.Object3D }[];
}

export function buildArena(id: ArenaId, seed = 7): ArenaBuild {
  const def = ARENAS.find((a) => a.id === id) ?? ARENAS[0];
  const group = new THREE.Group();
  const size = 64;
  const half = size / 2;

  // floor with inset grid pattern
  const floorGeo = new THREE.PlaneGeometry(size, size, 16, 16);
  const floorMat = new THREE.MeshStandardMaterial({ color: def.floor, roughness: 0.8, metalness: 0.3 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2; group.add(floor);
  // darker cross pattern
  const crossMat = new THREE.MeshStandardMaterial({ color: def.accent, transparent: true, opacity: 0.12, roughness: 0.6, metalness: 0.4 });
  const cross1 = new THREE.Mesh(new THREE.PlaneGeometry(size, 2), crossMat);
  cross1.rotation.x = -Math.PI / 2; cross1.position.y = 0.01; group.add(cross1);
  const cross2 = new THREE.Mesh(new THREE.PlaneGeometry(2, size), crossMat);
  cross2.rotation.x = -Math.PI / 2; cross2.position.y = 0.01; group.add(cross2);
  // center plate
  const centerPlate = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.2, 0.15, 8), mat(0x0b0f18, { metalness: 0.7, roughness: 0.4 }));
  centerPlate.position.y = 0.08; group.add(centerPlate);
  const centerRingGlow = ring(4.8, 0.08, glowMat(def.accent, 1.8), 32);
  centerRingGlow.rotation.x = Math.PI / 2; centerRingGlow.position.y = 0.17; group.add(centerRingGlow);
  // grid overlay
  const grid = new THREE.GridHelper(size, 32, def.grid, def.grid);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.3;
  grid.position.y = 0.02; group.add(grid);

  // perimeter walls
  const borderMat = glowMat(def.accent, 2.0);
  const wallMat = mat(0x101828, { roughness: 0.55, metalness: 0.6 });
  const wallH = 5;
  const mkWall = (w: number, x: number, z: number, ry: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, 1), wallMat);
    m.position.set(x, wallH / 2, z); m.rotation.y = ry; group.add(m);
    // layered trim
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.15, 1.1), borderMat);
    top.position.set(x, wallH + 0.08, z); top.rotation.y = ry; group.add(top);
    const mid = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 1.08), borderMat);
    mid.position.set(x, wallH * 0.5, z); mid.rotation.y = ry; group.add(mid);
    // support pillars every 8 units
    const seg = 8;
    for (let i = Math.ceil(-w / 2 / seg); i <= Math.floor(w / 2 / seg); i++) {
      const lx = x + Math.cos(ry) * i * seg;
      const lz = z + Math.sin(ry) * i * seg;
      // (simplified — place pillars only at corners)
    }
  };
  mkWall(size + 2, 0, -half, 0); mkWall(size + 2, 0, half, 0);
  mkWall(size + 2, -half, 0, Math.PI / 2); mkWall(size + 2, half, 0, Math.PI / 2);

  // corner pillars
  for (const [qx, qz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const pillar = cyl(0.9, 1.1, wallH, wallMat, 8);
    pillar.position.set(qx * (half - 0.2), wallH / 2, qz * (half - 0.2));
    pillar.rotation.y = qx * qz * 0.3;
    group.add(pillar);
    const cap = cyl(1.0, 1.2, 0.3, borderMat, 8);
    cap.position.set(qx * (half - 0.2), wallH + 0.15, qz * (half - 0.2));
    group.add(cap);
    const beacon = new THREE.PointLight(def.accent, 40, 28, 2);
    beacon.position.set(qx * (half - 0.2), wallH + 1.5, qz * (half - 0.2));
    group.add(beacon);
  }

  // neon floor strips along walls
  const stripMat = glowMat(def.accent, 1.5);
  for (const [qx, qz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const len = size - 4;
    const w = Math.abs(qx) ? 0.25 : len;
    const d = Math.abs(qz) ? 0.25 : len;
    const sx = qx * (half - 1);
    const sz = qz * (half - 1);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), stripMat);
    strip.position.set(sx, 0.03, sz); group.add(strip);
  }

  const colliders: THREE.Box3[] = [];
  const addCollider = (x: number, z: number, w: number, d: number, h = 3) => {
    colliders.push(new THREE.Box3(new THREE.Vector3(x - w / 2, 0, z - d / 2), new THREE.Vector3(x + w / 2, h, z + d / 2)));
  };

  let s = seed * 9973 + 12345;
  const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };

  // obstacles: crates + pillars + cover walls
  const crateMat = mat(0x1e293b, { roughness: 0.5, metalness: 0.5 });
  const crateGlow = glowMat(def.accent, 1.5);
  const spots: { x: number; z: number; w: number; d: number; h: number; pillar?: boolean; crate?: boolean }[] = [];
  const quads: [number, number][] = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
  for (const [qx, qz] of quads) {
    spots.push({ x: qx * 10, z: qz * 10, w: 3.4, d: 3.4, h: 1.8, crate: true });
    spots.push({ x: qx * 20, z: qz * 6, w: 5.6, d: 1.4, h: 1.5 });
    spots.push({ x: qx * 6, z: qz * 21, w: 1.4, d: 5.6, h: 1.5 });
    spots.push({ x: qx * 23, z: qz * 23, w: 2.4, d: 2.4, h: 6, pillar: true });
  }
  spots.push({ x: 0, z: -14, w: 6.4, d: 1.6, h: 1.5 });
  spots.push({ x: 0, z: 14, w: 6.4, d: 1.6, h: 1.5 });
  spots.push({ x: -14, z: 0, w: 1.6, d: 6.4, h: 1.5 });
  spots.push({ x: 14, z: 0, w: 1.6, d: 6.4, h: 1.5 });

  for (const sp of spots) {
    const jitter = (rand() - 0.5) * 1;
    const x = sp.x + jitter, z = sp.z + (rand() - 0.5) * 1;
    if (sp.pillar) {
      const pl = cyl(1.0, 1.2, sp.h, wallMat, 10); pl.position.set(x, sp.h / 2, z); group.add(pl);
      const cap = cyl(1.2, 1.3, 0.3, crateGlow, 10); cap.position.set(x, sp.h + 0.15, z); group.add(cap);
      const vL = new THREE.PointLight(def.accent, 18, 14, 2); vL.position.set(x, sp.h + 1, z); group.add(vL);
    } else if (sp.crate) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(sp.w, sp.h, sp.d), crateMat); c.position.set(x, sp.h / 2, z); group.add(c);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(sp.w + 0.06, 0.08, sp.d + 0.06), crateGlow); edge.position.set(x, sp.h + 0.04, z); group.add(c);
      // warning stripes
      for (let i = 0; i < 2; i++) {
        const st = new THREE.Mesh(new THREE.BoxGeometry(sp.w + 0.04, 0.1, 0.06), glowMat(0xfacc15, 1.5));
        st.position.set(x, 0.3 + i * (sp.h - 0.6), z + sp.d / 2 + 0.03); group.add(st);
      }
      // corner rivets
      for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        const rv = sph(0.05, mat(0x94a3b8, { metalness: 0.9, roughness: 0.2 }), 6);
        rv.position.set(x + cx * sp.w / 2 * 0.9, sp.h * 0.3, z + cz * sp.d / 2 * 0.9); group.add(rv);
      }
    } else {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sp.w, sp.h, sp.d), crateMat); m.position.set(x, sp.h / 2, z); group.add(m);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(sp.w + 0.08, 0.1, sp.d + 0.08), crateGlow); trim.position.set(x, sp.h + 0.05, z); group.add(trim);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(sp.w + 0.06, 0.14, sp.d + 0.06), crateGlow); stripe.position.set(x, 0.3, z); group.add(stripe);
    }
    addCollider(x, z, sp.w, sp.d, sp.h);
  }

  // center reactor
  const centerProp = new THREE.Group();
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 5, 0.6, 8), wallMat);
  plat.position.y = 0.3; centerProp.add(plat);
  const platRing = ring(4.5, 0.12, crateGlow, 24);
  platRing.rotation.x = Math.PI / 2; platRing.position.y = 0.6; centerProp.add(platRing);
  const obBase = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.1, 2.8, 6), crateMat);
  obBase.position.y = 1.8; centerProp.add(obBase);
  const obelisk = new THREE.Mesh(new THREE.OctahedronGeometry(2.0, 1), glowMat(def.accent, 2.2));
  obelisk.position.y = 5.0; obelisk.name = "obelisk"; centerProp.add(obelisk);
  const obHalo = ring(1.6, 0.08, glowMat(0xffffff, 1.2), 24);
  obHalo.name = "obHalo"; obHalo.position.y = 5.0; centerProp.add(obHalo);
  // rotating outer rings
  const r1 = ring(2.4, 0.06, glowMat(def.accent, 1.5), 32);
  r1.name = "r1"; r1.position.y = 5.0; centerProp.add(r1);
  const r2 = ring(3.2, 0.03, glowMat(def.accent, 1.2), 32);
  r2.name = "r2"; r2.rotation.x = Math.PI / 3; r2.position.y = 5.0; centerProp.add(r2);
  // beam to sky
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.8, 40, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: def.accent, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  beam.position.y = 24; beam.name = "beam"; centerProp.add(beam);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.55, 3.8, 0.55), wallMat);
    pylon.position.set(Math.cos(a) * 3.6, 1.9, Math.sin(a) * 3.6); centerProp.add(pylon);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.62), crateGlow);
    tip.position.set(Math.cos(a) * 3.6, 3.9, Math.sin(a) * 3.6); centerProp.add(tip);
    const lantern = new THREE.PointLight(def.accent, 10, 16, 2);
    lantern.position.set(Math.cos(a) * 3.6, 4.2, Math.sin(a) * 3.6); centerProp.add(lantern);
  }
  group.add(centerProp);
  addCollider(0, 0, 7.8, 7.8, 1.2);

  const reactorLight = new THREE.PointLight(def.accent, 80, 80, 1.8);
  reactorLight.position.set(0, 7, 0); group.add(reactorLight);

  // jump pads at corners
  const jumpPads: { pos: THREE.Vector3; mesh: THREE.Object3D }[] = [];
  for (const [qx, qz] of quads) {
    const pad = new THREE.Group();
    const base = cyl(1.4, 1.7, 0.3, mat(0x1e293b), 16); base.position.y = 0.15; pad.add(base);
    const ringPad = ring(1.5, 0.08, glowMat(def.grid, 1.8), 24); ringPad.rotation.x = Math.PI / 2; ringPad.position.y = 0.3; pad.add(ringPad);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.8, 4), glowMat(def.grid, 2.0));
    arrow.position.y = 0.7; arrow.rotation.y = Math.PI / 4; pad.add(arrow);
    pad.position.set(qx * 27, 0, qz * 27);
    pad.name = "jumpPad";
    group.add(pad);
    jumpPads.push({ pos: pad.position.clone(), mesh: pad });
    addCollider(qx * 27, qz * 27, 2.6, 2.6, 0.6);
  }

  // stars
  const starGeo = new THREE.BufferGeometry();
  const starCount = 500;
  const pos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const a = rand() * Math.PI * 2;
    const r = 90 + rand() * 140;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = 12 + rand() * 100;
    pos[i * 3 + 2] = Math.sin(a) * r;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, transparent: true, opacity: 0.9, sizeAttenuation: true });
  const stars = new THREE.Points(starGeo, starMat);
  group.add(stars);

  // spawns
  const spawns: THREE.Vector3[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    spawns.push(new THREE.Vector3(Math.cos(a) * 26, 0, Math.sin(a) * 26));
  }
  return { group, colliders, spawns, size, centerProp, reactorLight, jumpPads };
}
