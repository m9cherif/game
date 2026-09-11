import * as THREE from "three";
import { WEAPONS, type ArenaId, type GameModeId, type WeaponId } from "./constants";
import { buildArena, buildDrone, buildGunMesh, buildHumanoid, buildJuggernaut, buildOrb, buildTarget, animateHumanoid, type ArenaBuild, type Boss, type Drone, type Humanoid } from "./models";
import { ParticleSystem, DamageNumbers } from "./particles";
import { sfx } from "./audio";

export interface HUDState {
  hp: number; maxHp: number; ammo: number; reserve: number; reloading: boolean;
  weapon: WeaponId; weapon2: WeaponId; score: number; kills: number; deaths: number;
  streak: number; best: number; timeLeft: number; wave: number; enemiesLeft: number;
  orbs: number; orbsTotal: number; bossHp: number; bossMax: number;
  hitmarker: number; headshot: boolean; scoped: boolean; fps: number;
  killfeed: { text: string; t: number }[]; banner: string; bannerT: number;
  combo: number; comboT: number; lowAmmo: boolean; interact: string;
}
export interface GameResult { score: number; kills: number; deaths: number; shots: number; hits: number; wave: number; win: boolean; mode: GameModeId; timeSurvived: number; }
export interface RemoteState { playerId: string; name: string; skin: string; weapon: string; x: number; y: number; z: number; rotY: number; pitch: number; health: number; alive: number; score: number; kills: number; }
export interface EngineOptions {
  mode: GameModeId; arena: ArenaId; primary: WeaponId; secondary: WeaponId;
  gunSkin: string; suitColor: number; suitGlow: number;
  sensitivity: number; fov: number; shake: boolean; particles: boolean; isMobile: boolean;
  remoteMode?: boolean;
  onHUD: (h: HUDState) => void;
  onGameOver: (r: GameResult) => void;
  onRemoteHit?: (playerId: string, damage: number, head: boolean) => void;
  onLocalShot?: () => void;
}

interface Bot { h: Humanoid; hp: number; maxHp: number; alive: boolean; respawnT: number; name: string; score: number; state: string; strafeDir: number; strafeT: number; shootCd: number; reactT: number; targetPos: THREE.Vector3; speed: number; dmg: number; color: number; remoteId?: string; isRemote?: boolean; kills: number; }
interface DroneE { d: Drone; hp: number; alive: boolean; shootCd: number; strafeA: number; baseY: number; speed: number; }
interface TargetE { g: THREE.Group; alive: boolean; life: number; pos: THREE.Vector3; }
interface OrbE { g: THREE.Group; taken: boolean; pos: THREE.Vector3; spin: number }
interface Proj { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; fromPlayer: boolean; dmg: number }
interface Tracer { line: THREE.Line; life: number; max: number }
interface FloatText { x: number; y: number }

const BOT_NAMES = ["VEX", "NOVA", "RUIN", "JOLT", "HEX", "MIRO", "KAYO", "DRIFT"];
const BOT_COLORS = [0xef4444, 0xf97316, 0xeab308, 0x22c55e, 0x3b82f6, 0xa855f7, 0xec4899, 0x14b8a6];

export class GameEngine {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  opts: EngineOptions;
  arena!: ArenaBuild;
  particles!: ParticleSystem;
  dmgNums = new DamageNumbers();
  clock = new THREE.Clock();
  raycaster = new THREE.Raycaster();

  // player
  yaw = 0; pitch = 0;
  pos = new THREE.Vector3(0, 1.7, 20);
  vel = new THREE.Vector3();
  hp = 100; maxHp = 100;
  onGround = true;
  keys = new Set<string>();
  firing = false; aiming = false;
  weapon: WeaponId; weapon2: WeaponId;
  ammo: Record<string, number> = {};
  reserve: Record<string, number> = {};
  reloading = 0; reloadDur = 0;
  lastShot = 0;
  scoped = false;
  dead = false; deathT = 0;
  paused = false;
  started = false;

  // viewmodel
  gunGroup = new THREE.Group();
  gunMesh: THREE.Group | null = null;
  muzzleLight: THREE.PointLight;
  muzzleFlash: THREE.Mesh;
  gunKick = 0; gunSwap = 0; reloadAnim = 0; bladeSwing = 0;
  bobT = 0;

  // world entities
  bots: Bot[] = [];
  drones: DroneE[] = [];
  targets: TargetE[] = [];
  orbs: OrbE[] = [];
  boss: Boss | null = null;
  bossHp = 0; bossMax = 1;
  projs: Proj[] = [];
  tracers: Tracer[] = [];
  remotes = new Map<string, Bot>();
  enemyShots: Proj[] = [];

  // game state
  score = 0; kills = 0; deaths = 0; shots = 0; hits = 0;
  streak = 0; best = 0; combo = 0; comboT = 0;
  wave = 0; waveState: "intro" | "active" | "breather" = "intro"; waveT = 2;
  timeLeft = 0; elapsed = 0;
  orbsGot = 0; orbsTotal = 20;
  killfeed: { text: string; t: number }[] = [];
  banner = ""; bannerT = 0;
  hitmarker = 0; headshotMark = false;
  shakeT = 0; shakeAmp = 0;
  hudT = 0; fps = 60; fpsAcc = 0; fpsN = 0;
  gameEnded = false;
  touchMove = { x: 0, y: 0 };
  touchFire = false;
  damageFlash = 0;
  healT = 0;
  interactMsg = "";
  tmpV = new THREE.Vector3(); tmpV2 = new THREE.Vector3(); tmpV3 = new THREE.Vector3();
  centerSpin = 0;
  spawnIdx = 0;
  botCount = 0;
  killTarget = 15;
  disposed = false;
  raf = 0;
  pointerLocked = false;
  lastDmgFrom = "";

  constructor(canvas: HTMLCanvasElement, container: HTMLElement, opts: EngineOptions) {
    this.canvas = canvas; this.container = container; this.opts = opts;
    this.weapon = opts.primary; this.weapon2 = opts.secondary;
    for (const w of Object.keys(WEAPONS)) {
      const def = WEAPONS[w as WeaponId];
      this.ammo[w] = def.mag; this.reserve[w] = def.reserve;
    }
    const antialias = !opts.isMobile;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias, powerPreference: "high-performance" });
    this.renderer.setSize(container.clientWidth, container.clientHeight, false);
    const pr = opts.isMobile ? Math.min(window.devicePixelRatio, 1.6) : Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(pr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.camera = new THREE.PerspectiveCamera(opts.fov, container.clientWidth / container.clientHeight, 0.05, 400);
    this.camera.rotation.order = "YXZ";

    this.muzzleLight = new THREE.PointLight(0x67e8f9, 0, 12, 2);
    this.scene.add(this.muzzleLight);
    this.muzzleFlash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xaef3ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    this.scene.add(this.muzzleFlash);

    // lights
    this.scene.add(new THREE.HemisphereLight(0x8ab4ff, 0x1a0f2e, 0.9));
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(20, 40, 10);
    this.scene.add(dir);
    const accent = new THREE.PointLight(0x7c3aed, 60, 60, 1.8);
    accent.position.set(0, 8, 0);
    this.scene.add(accent);

    this.particles = new ParticleSystem(this.scene, opts.isMobile ? 700 : 1200);
    this.dmgNums.init(container);
    this.buildWorld();
    this.setupTracers();
    this.attachGun();
    this.bindInput();
    this.resetForMode();
    this.camera.add(this.gunGroup);
    this.scene.add(this.camera);
    this.started = true;
  }

  buildWorld() {
    this.arena = buildArena(this.opts.arena, 7 + this.opts.arena.length * 13);
    this.scene.add(this.arena.group);
    const fogColors: Record<string, number> = { NEON_VOID: 0x14092e, SUNSET_DUNES: 0x2a1408, FROST_LAB: 0x06222f };
    this.scene.background = new THREE.Color(fogColors[this.opts.arena] ?? 0x0b0620);
    this.scene.fog = new THREE.Fog(fogColors[this.opts.arena] ?? 0x14092e, 30, 140);
    // spawn player
    const s = this.arena.spawns[0];
    this.pos.set(s.x, 1.7, s.z);
    this.yaw = Math.atan2(-s.x, -s.z);
  }

  setupTracers() {
    for (let i = 0; i < 24; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }));
      l.frustumCulled = false;
      this.scene.add(l);
      this.tracers.push({ line: l, life: 1, max: 0.09 });
    }
  }
  fireTracer(a: THREE.Vector3, b: THREE.Vector3, color = 0x67e8f9) {
    const t = this.tracers.find((x) => x.life >= x.max) ?? this.tracers[0];
    const attr = t.line.geometry.getAttribute("position") as THREE.BufferAttribute;
    attr.setXYZ(0, a.x, a.y, a.z); attr.setXYZ(1, b.x, b.y, b.z);
    attr.needsUpdate = true;
    (t.line.material as THREE.LineBasicMaterial).color.set(color);
    (t.line.material as THREE.LineBasicMaterial).opacity = 0.9;
    t.life = 0; t.max = 0.09;
  }

  attachGun() {
    if (this.gunMesh) { this.gunGroup.remove(this.gunMesh); }
    this.gunMesh = buildGunMesh(this.weapon, this.opts.gunSkin);
    this.gunMesh.position.set(0.28, -0.26, -0.55);
    this.gunMesh.rotation.set(0, 0.04, 0);
    this.gunGroup.add(this.gunMesh);
    this.gunGroup.position.set(0, 0, 0);
  }

  resetForMode() {
    const m = this.opts.mode;
    this.score = 0; this.kills = 0; this.deaths = 0; this.shots = 0; this.hits = 0;
    this.streak = 0; this.best = 0; this.wave = 0; this.elapsed = 0;
    this.hp = this.maxHp = 100; this.dead = false; this.gameEnded = false;
    this.killTarget = 15;
    if (m === "SKIRMISH") { this.timeLeft = 300; this.killTarget = 15; this.spawnBots(5); this.setBanner("FIRST TO 15 — GO!"); }
    else if (m === "SURVIVAL") { this.timeLeft = 0; this.wave = 0; this.waveState = "intro"; this.waveT = 1.5; this.setBanner("SURVIVE THE SWARM"); }
    else if (m === "TIME_ATTACK") { this.timeLeft = 60; this.spawnTargets(5); this.setBanner("POP TARGETS — +2s EACH"); }
    else if (m === "ORB_RUSH") { this.timeLeft = 240; this.orbsGot = 0; this.spawnOrbs(20); this.spawnDrones(3); this.setBanner("COLLECT 20 ORBS"); }
    else if (m === "SNIPER_NEST") { this.timeLeft = 300; this.killTarget = 12; this.spawnBots(4, true); this.setBanner("ONE SHOT, ONE KILL"); }
    else if (m === "JUGGERNAUT") { this.timeLeft = 420; this.spawnBoss(); this.spawnDrones(2); this.setBanner("BREAK THE JUGGERNAUT"); }
    else if (m === "PARTY_PVP") { this.timeLeft = 300; this.killTarget = 10; this.spawnBots(2); this.setBanner("PARTY DEATHMATCH — 10 KILLS"); }
    this.pushFeed(`${this.opts.mode.replace("_", " ")} — good luck, operative`);
  }

  setBanner(t: string) { this.banner = t; this.bannerT = 3; }
  pushFeed(text: string) { this.killfeed.unshift({ text, t: this.elapsed }); if (this.killfeed.length > 5) this.killfeed.pop(); }

  // ── SPAWNERS ──
  nextSpawn(): THREE.Vector3 {
    this.spawnIdx = (this.spawnIdx + 1) % this.arena.spawns.length;
    // pick farthest-ish from player for fairness
    let best = this.arena.spawns[this.spawnIdx];
    let bd = -1;
    for (const s of this.arena.spawns) {
      const d = (s.x - this.pos.x) ** 2 + (s.z - this.pos.z) ** 2;
      if (d > bd && d > 200) { bd = d; best = s; }
    }
    return best;
  }
  spawnBots(n: number, snipers = false) {
    for (let i = 0; i < n; i++) {
      const s = this.arena.spawns[(i * 3 + 2) % this.arena.spawns.length];
      const color = BOT_COLORS[i % BOT_COLORS.length];
      const h = buildHumanoid(color, 0x1a2230, color);
      h.group.position.set(s.x, 0, s.z);
      this.scene.add(h.group);
      this.bots.push({
        h, hp: snipers ? 80 : 100, maxHp: snipers ? 80 : 100, alive: true, respawnT: 0,
        name: snipers ? BOT_NAMES[i % BOT_NAMES.length] + "◈" : BOT_NAMES[i % BOT_NAMES.length],
        score: 0, state: "seek", strafeDir: Math.random() > 0.5 ? 1 : -1, strafeT: 1 + Math.random() * 2,
        shootCd: 1 + Math.random(), reactT: 0.4 + Math.random() * 0.6, targetPos: new THREE.Vector3(s.x, 0, s.z),
        speed: snipers ? 3.2 : 4.2 + Math.random() * 1.4, dmg: snipers ? 34 : 9, color, kills: 0,
      });
    }
  }
  spawnDrones(n: number) {
    for (let i = 0; i < n; i++) {
      const s = this.nextSpawn();
      const d = buildDrone(i % 2 ? 0xff3b5c : 0xff9f1c);
      d.group.position.set(s.x, 2.5 + Math.random() * 2, s.z);
      this.scene.add(d.group);
      this.drones.push({ d, hp: 60, alive: true, shootCd: 1 + Math.random() * 1.5, strafeA: Math.random() * Math.PI * 2, baseY: 2.5, speed: 3.5 + Math.random() });
    }
  }
  spawnWaveDrones(n: number) {
    for (let i = 0; i < n; i++) {
      const s = this.arena.spawns[Math.floor(Math.random() * this.arena.spawns.length)];
      const tough = this.wave >= 4 && i % 3 === 0;
      const d = buildDrone(tough ? 0xc026d3 : this.wave >= 3 && i % 2 ? 0xff9f1c : 0xff3b5c);
      d.group.position.set(s.x + (Math.random() - 0.5) * 4, 3 + Math.random() * 2, s.z + (Math.random() - 0.5) * 4);
      if (tough) d.group.scale.setScalar(1.5);
      this.scene.add(d.group);
      this.drones.push({ d, hp: tough ? 160 : 50 + this.wave * 8, alive: true, shootCd: 1 + Math.random(), strafeA: Math.random() * Math.PI * 2, baseY: 2.5 + Math.random(), speed: 3 + this.wave * 0.25 });
    }
  }
  spawnBoss() {
    const b = buildJuggernaut();
    b.group.position.set(0, 0, -18);
    this.scene.add(b.group);
    this.boss = b; this.bossMax = 3000; this.bossHp = 3000;
  }
  spawnTargets(n: number) {
    for (let i = 0; i < n; i++) this.addTarget();
  }
  addTarget() {
    const g = buildTarget();
    const x = (Math.random() - 0.5) * 48, z = (Math.random() - 0.5) * 48;
    if (Math.abs(x) < 6 && Math.abs(z) < 6) { g.position.set(x + 10, 0, z); } else g.position.set(x, 0, z);
    const ry = Math.atan2(this.pos.x - g.position.x, this.pos.z - g.position.z);
    g.rotation.y = ry;
    this.scene.add(g);
    this.targets.push({ g, alive: true, life: 6, pos: g.position.clone() });
  }
  spawnOrbs(n: number) {
    this.orbsTotal = n;
    const colors = [0xa78bfa, 0x22d3ee, 0x4ade80, 0xfacc15, 0xf472b6];
    for (let i = 0; i < n; i++) {
      const g = buildOrb(colors[i % colors.length]);
      const a = (i / n) * Math.PI * 2;
      const r = 8 + (i % 3) * 8;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      g.position.set(x, 1.1, z);
      this.scene.add(g);
      this.orbs.push({ g, taken: false, pos: new THREE.Vector3(x, 1.1, z), spin: Math.random() * 6 });
    }
  }

  // ── INPUT ──
  onKeyDown = (e: KeyboardEvent) => {
    if (e.code === "Tab") e.preventDefault();
    this.keys.add(e.code);
    if (e.code === "KeyR") this.startReload();
    if (e.code === "Digit1") this.switchTo(this.weapon === this.opts.primary ? this.opts.secondary : this.opts.primary);
    if (e.code === "Digit2") this.switchTo(this.weapon2);
    if (e.code === "KeyQ") this.switchTo(this.weapon === this.weapon2 ? this.weapon : this.weapon2);
    if (e.code === "KeyF") this.cycleWeapon();
  };
  onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  onMouseDown = (e: MouseEvent) => {
    if (!this.pointerLocked && !this.opts.isMobile && this.canvas) { try { this.canvas.requestPointerLock(); } catch { /* noop */ } }
    if (e.button === 0) this.firing = true;
    if (e.button === 2) { this.aiming = true; if (this.weapon === "rail") sfx.scope(); }
  };
  onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.firing = false;
    if (e.button === 2) this.aiming = false;
  };
  onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked || this.paused || this.dead) return;
    const s = 0.0022 * this.opts.sensitivity * (this.scoped ? 0.35 : this.aiming ? 0.7 : 1);
    this.yaw -= e.movementX * s;
    this.pitch -= e.movementY * s;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
  };
  onLockChange = () => { this.pointerLocked = document.pointerLockElement === this.canvas; };
  onResize = () => {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };
  onCtx = (e: Event) => e.preventDefault();

  bindInput() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mousemove", this.onMouseMove);
    document.addEventListener("pointerlockchange", this.onLockChange);
    window.addEventListener("resize", this.onResize);
    this.canvas.addEventListener("contextmenu", this.onCtx);
  }

  // touch API
  setTouchMove(x: number, y: number) { this.touchMove.x = x; this.touchMove.y = y; }
  addTouchLook(dx: number, dy: number) {
    if (this.paused || this.dead) return;
    const s = 0.0042 * this.opts.sensitivity;
    this.yaw -= dx * s; this.pitch -= dy * s;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
  }
  setTouchFire(b: boolean) { this.touchFire = b; }
  touchJump() { if (this.onGround && !this.dead) { this.vel.y = 7.2; this.onGround = false; sfx.jump(); } }

  cycleWeapon() { this.switchTo(this.weapon === this.weapon2 ? this.opts.primary : this.weapon2); }
  switchTo(w: WeaponId) {
    if (w === this.weapon || this.reloading > 0) return;
    const tmp = this.weapon;
    void tmp;
    this.weapon = w;
    this.gunSwap = 1;
    this.aiming = false; this.scoped = false;
    sfx.reload();
    window.setTimeout(() => { if (!this.disposed) this.attachGun(); }, 90);
  }

  startReload() {
    const def = WEAPONS[this.weapon];
    if (def.mag < 0 || this.reloading > 0 || this.ammo[this.weapon] >= def.mag || this.reserve[this.weapon] <= 0 || this.dead) return;
    this.reloading = def.reloadMs / 1000;
    this.reloadDur = def.reloadMs / 1000;
    sfx.reload();
  }

  addShake(amt: number) {
    if (!this.opts.shake) return;
    this.shakeAmp = Math.min(1.2, this.shakeAmp + amt);
    this.shakeT = 0.35;
  }

  // ── COMBAT ──
  muzzleWorld(out: THREE.Vector3): THREE.Vector3 {
    if (this.gunMesh) {
      const mz = this.gunMesh.getObjectByName("muzzle");
      if (mz) { mz.getWorldPosition(out); return out; }
    }
    out.copy(this.pos); out.y -= 0.1;
    return out;
  }

  tryShoot(now: number) {
    if (this.dead || this.paused || this.gameEnded) return;
    const def = WEAPONS[this.weapon];
    const interval = 60 / def.rpm;
    if (now - this.lastShot < interval || this.reloading > 0 || this.gunSwap > 0.5) return;
    if (def.mag >= 0 && this.ammo[this.weapon] <= 0) { sfx.empty(); this.lastShot = now; this.startReload(); return; }
    this.lastShot = now;
    if (def.mag >= 0) this.ammo[this.weapon]--;
    this.shots++;
    sfx.shoot(this.weapon);
    this.opts.onLocalShot?.();

    this.muzzleWorld(this.tmpV);
    this.muzzleLight.position.copy(this.tmpV);
    this.muzzleLight.color.set(def.color);
    this.muzzleLight.intensity = def.id === "scatter" ? 90 : 50;
    this.muzzleFlash.position.copy(this.tmpV);
    this.muzzleFlash.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    (this.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = 0.95;
    const sc = def.id === "scatter" ? 1.6 : def.id === "rail" ? 1.4 : 0.9;
    this.muzzleFlash.scale.set(sc, sc, sc);
    this.gunKick = Math.min(1.4, this.gunKick + def.kick * 0.35);
    this.addShake(def.kick * 0.12);
    if (this.opts.particles) this.particles.muzzle(this.tmpV, def.color);

    // pitch kick
    this.pitch = Math.min(1.45, this.pitch + def.kick * 0.006);

    if (def.projectile) { this.fireGrenade(def); return; }
    if (def.melee) { this.bladeSwing = 1; this.meleeHit(def); return; }

    // hitscan pellets
    for (let p = 0; p < def.pellets; p++) {
      const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch + (Math.random() - 0.5) * def.spread * 2, this.yaw + (Math.random() - 0.5) * def.spread * 2, 0, "YXZ"));
      this.raycaster.set(this.pos, dir);
      this.raycaster.far = def.range;
      const hit = this.pickHit();
      const end = hit ? hit.point : this.tmpV2.copy(this.pos).addScaledVector(dir, def.range);
      this.fireTracer(this.tmpV, end, def.color);
      if (hit) this.applyHit(hit, def, dir);
      else if (this.opts.particles && Math.random() < 0.3) this.particles.sparks(end, 0x64748b, 2);
    }
    if (this.ammo[this.weapon] === 0 && def.mag > 0) this.startReload();
  }

  pickHit(): { point: THREE.Vector3; obj: THREE.Object3D; data: HitData } | null {
    // gather candidate meshes
    const meshes: THREE.Object3D[] = [];
    const map = new Map<number, HitData>();
    const reg = (o: THREE.Object3D, d: HitData) => { meshes.push(o); map.set(o.id, d); };
    for (const b of this.bots) {
      if (!b.alive) continue;
      reg(b.h.head, { kind: "bot", bot: b, head: true });
      reg(b.h.torso, { kind: "bot", bot: b, head: false });
    }
    for (const [, b] of this.remotes) {
      if (!b.alive) continue;
      reg(b.h.head, { kind: "remote", bot: b, head: true });
      reg(b.h.torso, { kind: "remote", bot: b, head: false });
    }
    for (const d of this.drones) {
      if (!d.alive) continue;
      d.d.group.updateMatrixWorld(true);
      reg(d.d.group.children[0], { kind: "drone", drone: d, head: true });
      reg(d.d.group.children[1], { kind: "drone", drone: d, head: false });
    }
    if (this.boss && this.bossHp > 0) {
      reg(this.boss.core, { kind: "boss", head: true });
      reg(this.boss.group.children[0], { kind: "boss", head: false });
      reg(this.boss.head, { kind: "boss", head: false });
    }
    for (const t of this.targets) {
      if (!t.alive) continue;
      reg(t.g.children[1], { kind: "target", target: t, head: false });
    }
    // walls + floor as blockers
    reg(this.arena.group, { kind: "wall", head: false });
    const hits = this.raycaster.intersectObjects(meshes, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !map.has(o.id)) o = o.parent;
      if (!o) continue;
      const data = map.get(o.id)!;
      // if wall group, check it's actually arena geometry (children of arena)
      if (data.kind === "wall") return { point: h.point.clone(), obj: h.object, data };
      return { point: h.point.clone(), obj: h.object, data };
    }
    return null;
  }

  applyHit(hit: { point: THREE.Vector3; data: HitData }, def: { damage: number }, _dir: THREE.Vector3) {
    const { data, point } = hit;
    if (data.kind === "wall") {
      if (this.opts.particles) { this.particles.sparks(point, 0x94a3b8, 6); this.particles.burst(point, 0x475569, 6, 4); }
      return;
    }
    this.hits++;
    const head = data.head;
    const dmg = Math.round(def.damage * (head ? 2 : 1));
    this.hitmarker = 1; this.headshotMark = head;
    if (head) sfx.headshot(); else sfx.hit();
    if (this.opts.particles) this.particles.blood(point, head ? 0xfde047 : 0x67e8f9);
    this.showDmg(point, dmg, head);

    if (data.kind === "bot" && data.bot) this.damageBot(data.bot, dmg, head, point);
    else if (data.kind === "remote" && data.bot) {
      this.damageRemote(data.bot, dmg, head, point);
    } else if (data.kind === "drone" && data.drone) this.damageDrone(data.drone, dmg, head, point);
    else if (data.kind === "boss") this.damageBoss(dmg, head, point);
    else if (data.kind === "target" && data.target) this.hitTarget(data.target, point);
  }

  showDmg(world: THREE.Vector3, dmg: number, head: boolean) {
    this.tmpV3.copy(world).project(this.camera);
    const sx = (this.tmpV3.x * 0.5 + 0.5) * this.container.clientWidth;
    const sy = (-this.tmpV3.y * 0.5 + 0.5) * this.container.clientHeight;
    this.dmgNums.show(sx, sy, String(dmg), head ? "crit" : "");
  }

  damageBot(b: Bot, dmg: number, head: boolean, point: THREE.Vector3) {
    if (!b.alive) return;
    b.hp -= dmg;
    b.reactT = 0; // aggro
    if (this.opts.particles) this.particles.burst(point, b.color, head ? 18 : 10, 6);
    if (b.hp <= 0) {
      b.alive = false; b.respawnT = 3; b.hp = 0;
      this.kills++; this.streak++; this.best = Math.max(this.best, this.streak);
      this.combo++; this.comboT = 3;
      const mult = 1 + Math.min(4, Math.floor(this.combo / 3)) * 0.5 + Math.min(2, this.streak * 0.1);
      const pts = Math.round((head ? 150 : 100) * mult);
      this.score += pts;
      sfx.kill();
      this.pushFeed(`YOU ▸ ${b.name}  +${pts}${head ? " ☠HEADSHOT" : ""}`);
      if (this.opts.particles) this.particles.explosion(b.h.group.position.clone().setY(1.2));
      this.addShake(0.25);
      // death anim: fall + sink
      b.h.group.rotation.x = -Math.PI / 2;
      b.h.group.position.y = 0.4;
      if (this.streak >= 3) this.setBanner(`${this.streak}x STREAK — ${pts} PTS`);
      this.checkWin();
    }
  }

  damageRemote(b: Bot, dmg: number, head: boolean, point: THREE.Vector3) {
    if (!b.alive || !b.remoteId) return;
    b.hp -= dmg;
    this.opts.onRemoteHit?.(b.remoteId, dmg, head);
    if (this.opts.particles) this.particles.burst(point, 0xf472b6, head ? 16 : 9, 6);
    if (b.hp <= 0) {
      b.alive = false; b.hp = 0;
      this.kills++; this.streak++;
      const pts = head ? 150 : 100;
      this.score += pts;
      sfx.kill();
      this.pushFeed(`YOU ▸ ${b.name}  +${pts}${head ? " ☠HEADSHOT" : ""}`);
      if (this.opts.particles) this.particles.explosion(b.h.group.position.clone().setY(1.2));
      this.checkWin();
    }
  }

  damageDrone(d: DroneE, dmg: number, head: boolean, point: THREE.Vector3) {
    if (!d.alive) return;
    d.hp -= dmg;
    if (this.opts.particles) this.particles.burst(point, 0xff9f1c, head ? 16 : 10, 6);
    if (d.hp <= 0) {
      d.alive = false;
      this.scene.remove(d.d.group);
      this.kills++; this.streak++;
      const pts = head ? 150 : 100;
      this.score += pts;
      sfx.kill();
      if (this.opts.particles) this.particles.explosion(point);
      this.pushFeed(`DRONE DOWN  +${pts}`);
      this.addShake(0.2);
    }
  }

  damageBoss(dmg: number, head: boolean, point: THREE.Vector3) {
    if (this.bossHp <= 0) return;
    const final = head ? dmg * 1.5 : dmg;
    this.bossHp -= final;
    if (this.opts.particles) this.particles.burst(point, 0xff2d78, head ? 20 : 12, 7);
    if (this.bossHp <= 0) {
      this.bossHp = 0;
      this.kills++;
      this.score += 2000;
      sfx.explosion();
      if (this.boss) {
        if (this.opts.particles) {
          this.particles.explosion(this.boss.group.position.clone().setY(2));
          this.particles.explosion(this.boss.group.position.clone().setY(3.5));
        }
        this.scene.remove(this.boss.group);
        this.boss = null;
      }
      this.pushFeed("JUGGERNAUT DESTROYED  +2000");
      this.setBanner("JUGGERNAUT DOWN!");
      this.endGame(true);
    }
  }

  hitTarget(t: TargetE, point: THREE.Vector3) {
    if (!t.alive) return;
    t.alive = false;
    this.scene.remove(t.g);
    this.kills++;
    this.combo++; this.comboT = 4;
    const pts = 100 * Math.min(5, this.combo);
    this.score += pts;
    this.timeLeft += 2;
    sfx.pickup();
    if (this.opts.particles) this.particles.burst(point, 0xfacc15, 20, 7);
    this.pushFeed(`TARGET ${this.combo}x COMBO  +${pts}  +2s`);
    this.addTarget();
  }

  meleeHit(def: { damage: number; range: number }) {
    const range = def.range;
    let best: { d: number; kind: string; bot?: Bot; drone?: DroneE } | null = null;
    const fwd = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"));
    const check = (p: THREE.Vector3) => {
      const to = this.tmpV.copy(p).sub(this.pos);
      const dist = to.length();
      if (dist > range + 0.6) return -1;
      to.normalize();
      return to.dot(fwd);
    };
    for (const b of this.bots) {
      if (!b.alive) continue;
      const bp = b.h.group.position.clone().setY(1.2);
      const dot = check(bp);
      if (dot > 0.6 && (!best || bp.distanceTo(this.pos) < best.d)) best = { d: bp.distanceTo(this.pos), kind: "bot", bot: b };
    }
    for (const [, b] of this.remotes) {
      if (!b.alive) continue;
      const bp = b.h.group.position.clone().setY(1.2);
      const dot = check(bp);
      if (dot > 0.6 && (!best || bp.distanceTo(this.pos) < best.d)) best = { d: bp.distanceTo(this.pos), kind: "remote", bot: b };
    }
    for (const d of this.drones) {
      if (!d.alive) continue;
      const dot = check(d.d.group.position);
      if (dot > 0.5 && (!best || d.d.group.position.distanceTo(this.pos) < best.d)) best = { d: d.d.group.position.distanceTo(this.pos), kind: "drone", drone: d };
    }
    if (this.boss && this.bossHp > 0) {
      const bp = this.boss.group.position.clone().setY(2.5);
      const dot = check(bp);
      if (dot > 0.5 && bp.distanceTo(this.pos) < range + 1.6) {
        this.hits++; this.hitmarker = 1;
        this.damageBoss(def.damage, false, bp);
        this.showDmg(bp, def.damage, false);
        if (this.opts.particles) this.particles.burst(bp, 0xfacc15, 18, 8);
        return;
      }
    }
    if (best?.bot) {
      this.hits++; this.hitmarker = 1;
      const bp = best.bot.h.group.position.clone().setY(1.2);
      if (best.kind === "remote") this.damageRemote(best.bot, def.damage, false, bp);
      else this.damageBot(best.bot, def.damage, false, bp);
      this.showDmg(bp, def.damage, false);
      if (this.opts.particles) this.particles.burst(bp, 0xfacc15, 18, 8);
    } else if (best?.drone) {
      this.hits++; this.hitmarker = 1;
      this.damageDrone(best.drone, def.damage, false, best.drone.d.group.position);
      this.showDmg(best.drone.d.group.position, def.damage, false);
    }
    // slash arc particles
    if (this.opts.particles) {
      const fwdP = new THREE.Vector3(0, 0, -1.4).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ")).add(this.pos);
      this.particles.spawn(fwdP.x, fwdP.y, fwdP.z, 10, 0xfacc15, { speed: 6, life: 0.3, grav: 0 });
    }
  }

  fireGrenade(def: { damage: number }) {
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"));
    this.muzzleWorld(this.tmpV);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xf472b6, emissiveIntensity: 2.5 })
    );
    mesh.position.copy(this.tmpV);
    this.scene.add(mesh);
    this.projs.push({ mesh, vel: dir.multiplyScalar(26).add(new THREE.Vector3(0, 3, 0)), life: 3, fromPlayer: true, dmg: def.damage });
  }

  explode(p: THREE.Vector3, dmg: number, fromPlayer: boolean) {
    sfx.explosion();
    if (this.opts.particles) this.particles.explosion(p);
    this.muzzleLight.position.copy(p);
    this.muzzleLight.color.set(0xff9f1c);
    this.muzzleLight.intensity = 120;
    const distP = p.distanceTo(this.pos);
    if (distP < 7) {
      const f = 1 - distP / 7;
      if (fromPlayer) this.hurtPlayer(dmg * f * 0.5, "OWN BOOM");
      else this.hurtPlayer(dmg * f, "BLAST");
    }
    for (const b of this.bots) {
      if (!b.alive) continue;
      const d = p.distanceTo(b.h.group.position.clone().setY(1));
      if (d < 7) this.damageBot(b, Math.round(dmg * (1 - d / 8)), false, b.h.group.position.clone().setY(1.2));
    }
    for (const dd of this.drones) {
      if (!dd.alive) continue;
      const d = p.distanceTo(dd.d.group.position);
      if (d < 8) this.damageDrone(dd, Math.round(dmg * (1 - d / 9)), false, dd.d.group.position);
    }
    for (const [, b] of this.remotes) {
      if (!b.alive) continue;
      const d = p.distanceTo(b.h.group.position.clone().setY(1));
      if (d < 7) this.damageRemote(b, Math.round(dmg * (1 - d / 8)), false, b.h.group.position.clone().setY(1.2));
    }
    if (this.boss && this.bossHp > 0) {
      const d = p.distanceTo(this.boss.group.position.clone().setY(2));
      if (d < 8) this.damageBoss(Math.round(dmg * (1 - d / 10)), false, this.boss.group.position.clone().setY(2.5));
    }
    this.addShake(0.5);
  }

  hurtPlayer(dmg: number, from: string) {
    if (this.dead || this.gameEnded || this.paused) return;
    this.hp -= dmg;
    this.damageFlash = 1;
    this.streak = 0; this.combo = 0;
    sfx.hurt();
    this.addShake(0.35);
    this.lastDmgFrom = from;
    if (this.hp <= 0) {
      this.hp = 0; this.dead = true; this.deathT = 0; this.deaths++;
      this.pushFeed(`${from} ▸ YOU`);
      sfx.explosion();
      this.addShake(1);
    }
  }

  respawnPlayer() {
    const s = this.nextSpawn();
    this.pos.set(s.x, 1.7, s.z);
    this.yaw = Math.atan2(-s.x, -s.z);
    this.pitch = 0;
    this.hp = this.maxHp;
    this.dead = false;
    for (const w of Object.keys(WEAPONS)) {
      const def = WEAPONS[w as WeaponId];
      if (def.mag > 0 && this.reserve[w] < def.mag) this.reserve[w] = def.reserve;
      if (this.ammo[w] <= 0) this.ammo[w] = def.mag;
    }
  }

  checkWin() {
    if (this.gameEnded) return;
    if ((this.opts.mode === "SKIRMISH" || this.opts.mode === "SNIPER_NEST" || this.opts.mode === "PARTY_PVP") && this.kills >= this.killTarget) {
      this.endGame(true);
    }
    if (this.opts.mode === "ORB_RUSH" && this.orbsGot >= this.orbsTotal) this.endGame(true);
  }

  endGame(win: boolean) {
    if (this.gameEnded) return;
    this.gameEnded = true;
    document.exitPointerLock?.();
    const acc = this.shots ? this.hits / this.shots : 0;
    window.setTimeout(() => {
      if (!this.disposed) this.opts.onGameOver({ score: this.score, kills: this.kills, deaths: this.deaths, shots: this.shots, hits: this.hits, wave: this.wave, win, mode: this.opts.mode, timeSurvived: this.elapsed });
    }, win ? 900 : 1400);
    this.setBanner(win ? "★ VICTORY ★" : "☠ ELIMINATED");
  }

  // ── MULTIPLAYER REMOTES ──
  syncRemotes(list: RemoteState[]) {
    const seen = new Set<string>();
    for (const r of list) {
      seen.add(r.playerId);
      let b = this.remotes.get(r.playerId);
      if (!b) {
        const h = buildHumanoid(0xf472b6, 0x1a2230, 0xf472b6);
        this.scene.add(h.group);
        b = { h, hp: r.health, maxHp: 100, alive: r.alive === 1, respawnT: 0, name: r.name, score: r.score, state: "remote", strafeDir: 1, strafeT: 0, shootCd: 0, reactT: 0, targetPos: new THREE.Vector3(), speed: 0, dmg: 0, color: 0xf472b6, remoteId: r.playerId, isRemote: true, kills: r.kills };
        this.remotes.set(r.playerId, b);
      }
      b.name = r.name;
      b.hp = r.health; b.alive = r.alive === 1 && r.health > 0;
      b.h.group.position.set(r.x, Math.max(0, r.y - 1.7), r.z);
      b.h.group.rotation.y = r.rotY;
      b.h.group.visible = b.alive;
    }
    for (const [id, b] of this.remotes) {
      if (!seen.has(id)) { this.scene.remove(b.h.group); this.remotes.delete(id); }
    }
  }
  getTransform() { return { x: this.pos.x, y: this.pos.y, z: this.pos.z, rotY: this.yaw, pitch: this.pitch, health: Math.round(this.hp), alive: this.dead ? 0 : 1, weapon: this.weapon, score: this.score, kills: this.kills }; }

  setPaused(p: boolean) {
    this.paused = p;
    if (p) { this.firing = false; document.exitPointerLock?.(); }
    this.clock.getDelta();
  }

  // ── UPDATE ──
  collide(pos: THREE.Vector3, radius: number) {
    const half = this.arena.size / 2 - 1;
    pos.x = Math.max(-half, Math.min(half, pos.x));
    pos.z = Math.max(-half, Math.min(half, pos.z));
    for (const c of this.arena.colliders) {
      if (pos.y > c.max.y || pos.y - 1.4 > c.max.y) continue;
      const minX = c.min.x - radius, maxX = c.max.x + radius;
      const minZ = c.min.z - radius, maxZ = c.max.z + radius;
      if (pos.x > minX && pos.x < maxX && pos.z > minZ && pos.z < maxZ) {
        const dxMin = pos.x - minX, dxMax = maxX - pos.x;
        const dzMin = pos.z - minZ, dzMax = maxZ - pos.z;
        const m = Math.min(dxMin, dxMax, dzMin, dzMax);
        if (m === dxMin) pos.x = minX;
        else if (m === dxMax) pos.x = maxX;
        else if (m === dzMin) pos.z = minZ;
        else pos.z = maxZ;
      }
    }
  }

  updateBots(dt: number, t: number) {
    for (const b of this.bots) {
      if (!b.alive) {
        b.respawnT -= dt;
        b.h.group.position.y -= dt * 0.6;
        if (b.respawnT <= 0 && !this.gameEnded) {
          const s = this.nextSpawn();
          b.h.group.position.set(s.x, 0, s.z);
          b.h.group.rotation.x = 0;
          b.hp = b.maxHp; b.alive = true;
        }
        continue;
      }
      // pick target: player or nearest other bot
      let tx = this.pos.x, tz = this.pos.z, ty = 1.2;
      let targetIsPlayer = true;
      if (!this.dead && Math.random() < 0.002) { /* keep player */ }
      // 25%: fight nearest bot instead (FFA feel)
      if (Math.random() < 0.003) {
        let bd = 1e9; let bt: Bot | null = null;
        for (const o of this.bots) { if (o === b || !o.alive) continue; const d = o.h.group.position.distanceToSquared(b.h.group.position); if (d < bd) { bd = d; bt = o; } }
        if (bt && bd < 900) { tx = (bt as Bot).h.group.position.x; tz = (bt as Bot).h.group.position.z; targetIsPlayer = false; }
      }
      const bp = b.h.group.position;
      const toT = this.tmpV.set(tx - bp.x, 0, tz - bp.z);
      const dist = toT.length();
      toT.normalize();
      const desired = Math.atan2(toT.x, toT.z);
      let dy = desired - b.h.group.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      b.h.group.rotation.y += dy * Math.min(1, dt * 5);

      // strafe + approach
      b.strafeT -= dt;
      if (b.strafeT <= 0) { b.strafeT = 1 + Math.random() * 2; b.strafeDir *= -1; }
      const approach = dist > 14 ? 1 : dist < 6 ? -0.6 : 0.1;
      const mx = toT.x * approach + -toT.z * b.strafeDir * 0.7;
      const mz = toT.z * approach + toT.x * b.strafeDir * 0.7;
      bp.x += mx * b.speed * dt;
      bp.z += mz * b.speed * dt;
      const half = this.arena.size / 2 - 1.5;
      bp.x = Math.max(-half, Math.min(half, bp.x));
      bp.z = Math.max(-half, Math.min(half, bp.z));
      // avoid center
      if (Math.abs(bp.x) < 5 && Math.abs(bp.z) < 5) { bp.x += (bp.x >= 0 ? 1 : -1) * dt * 6; bp.z += (bp.z >= 0 ? 1 : -1) * dt * 6; }

      animateHumanoid(b.h, t + bp.x, true, true);

      // shooting
      b.reactT -= dt;
      b.shootCd -= dt;
      const canSee = Math.abs(dy) < 0.4 && dist < 55;
      if (canSee && b.reactT <= 0 && b.shootCd <= 0 && !this.gameEnded) {
        if (targetIsPlayer && this.dead) { /* skip */ }
        else {
          b.shootCd = (b.dmg > 20 ? 1.6 : 0.55) + Math.random() * 0.5;
          const from = bp.clone().setY(1.5);
          const aimY = targetIsPlayer ? 1.3 : 1.2;
          const aim = new THREE.Vector3(tx + (Math.random() - 0.5) * (2 + dist * 0.12), aimY, tz + (Math.random() - 0.5) * (2 + dist * 0.12));
          const dir = aim.sub(from).normalize();
          this.fireTracer(from, from.clone().addScaledVector(dir, Math.min(dist + 2, 60)), 0xff5a5a);
          sfx.enemyShoot();
          if (this.opts.particles) this.particles.muzzle(from, 0xff5a5a);
          // hit chance
          if (targetIsPlayer) {
            const hitCh = Math.max(0.12, 0.55 - dist * 0.012);
            if (Math.random() < hitCh) this.hurtPlayer(b.dmg * (0.8 + Math.random() * 0.4), b.name);
            else if (this.opts.particles) this.particles.sparks(this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2)), 0xff5a5a, 3);
          } else {
            // bot vs bot: find victim near aim
            for (const o of this.bots) {
              if (o === b || !o.alive) continue;
              if (o.h.group.position.distanceTo(new THREE.Vector3(tx, 0, tz)) < 2) {
                o.hp -= b.dmg;
                if (o.hp <= 0) {
                  o.alive = false; o.respawnT = 3; o.h.group.rotation.x = -Math.PI / 2;
                  b.score++; b.kills++;
                  this.pushFeed(`${b.name} ▸ ${o.name}`);
                  if (b.score >= this.killTarget && (this.opts.mode === "SKIRMISH" || this.opts.mode === "SNIPER_NEST")) {
                    this.setBanner(`${b.name} WINS`);
                    this.endGame(false);
                  }
                }
                break;
              }
            }
          }
        }
      }
    }
  }

  updateDrones(dt: number, t: number) {
    for (let i = this.drones.length - 1; i >= 0; i--) {
      const e = this.drones[i];
      if (!e.alive) continue;
      const g = e.d.group;
      e.strafeA += dt * 1.4;
      const toP = this.tmpV.set(this.pos.x - g.position.x, 0, this.pos.z - g.position.z);
      const dist = toP.length();
      toP.normalize();
      const want = 9;
      const adv = dist > want + 3 ? 1 : dist < want - 3 ? -0.7 : 0;
      const sx = -toP.z * Math.sin(e.strafeA) * 0.8;
      const sz = toP.x * Math.sin(e.strafeA) * 0.8;
      g.position.x += (toP.x * adv + sx) * e.speed * dt;
      g.position.z += (toP.z * adv + sz) * e.speed * dt;
      g.position.y = e.baseY + Math.sin(t * 2 + e.strafeA) * 0.5 + Math.sin(t * 5) * 0.08;
      const half = this.arena.size / 2 - 2;
      g.position.x = Math.max(-half, Math.min(half, g.position.x));
      g.position.z = Math.max(-half, Math.min(half, g.position.z));
      g.rotation.y = Math.atan2(toP.x, toP.z);
      e.d.rotorL.rotation.y += dt * 30;
      e.d.rotorR.rotation.y -= dt * 30;
      e.d.ring.rotation.z += dt * 3;
      (e.d.eye.material as THREE.MeshStandardMaterial).emissiveIntensity = 2 + Math.sin(t * 6 + i) * 0.8;
      // shoot plasma
      e.shootCd -= dt;
      if (e.shootCd <= 0 && dist < 30 && !this.dead && !this.gameEnded) {
        e.shootCd = 1.4 + Math.random() * 0.8;
        const from = g.position.clone();
        const dir = this.pos.clone().setY(1.2).sub(from).normalize();
        dir.x += (Math.random() - 0.5) * 0.12; dir.y += (Math.random() - 0.5) * 0.08; dir.z += (Math.random() - 0.5) * 0.12;
        dir.normalize();
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff3b5c, emissiveIntensity: 3 }));
        mesh.position.copy(from);
        this.scene.add(mesh);
        this.enemyShots.push({ mesh, vel: dir.multiplyScalar(16), life: 3, fromPlayer: false, dmg: 10 });
        sfx.enemyShoot();
        this.fireTracer(from, from.clone().addScaledVector(dir, 3), 0xff3b5c);
      }
      // contact damage
      if (dist < 1.6 && !this.dead) this.hurtPlayer(18 * dt * 3, "DRONE");
      if (this.opts.particles && Math.random() < dt * 8) this.particles.trail(g.position, 0xff3b5c);
    }
  }

  updateBoss(dt: number, t: number) {
    if (!this.boss || this.bossHp <= 0) return;
    const g = this.boss.group;
    const toP = this.tmpV.set(this.pos.x - g.position.x, 0, this.pos.z - g.position.z);
    const dist = toP.length();
    toP.normalize();
    g.rotation.y = Math.atan2(toP.x, toP.z);
    const speed = dist > 20 ? 5 : 3;
    if (dist > 3.4) { g.position.x += toP.x * speed * dt; g.position.z += toP.z * speed * dt; }
    // stomp anim
    const stomp = Math.abs(Math.sin(t * 3.2));
    g.position.y = stomp * 0.12;
    this.boss.armL.rotation.x = Math.sin(t * 3.2) * 0.5;
    this.boss.armR.rotation.x = -Math.sin(t * 3.2) * 0.5;
    (this.boss.core.material as THREE.MeshStandardMaterial).emissiveIntensity = 2 + Math.sin(t * 7) * 1;
    this.bossDmgCd = (this.bossDmgCd ?? 0) - dt;
    // slam
    if (dist < 4.5 && this.bossDmgCd <= 0) {
      this.bossDmgCd = 1.6;
      this.hurtPlayer(32, "JUGGERNAUT");
      this.addShake(0.8);
      if (this.opts.particles) this.particles.explosion(g.position.clone().setY(0.5));
      this.boss.armL.rotation.x = -1.6; this.boss.armR.rotation.x = -1.6;
    }
    // volley
    this.bossVolleyCd = (this.bossVolleyCd ?? 3) - dt;
    if (this.bossVolleyCd <= 0 && dist >= 4.5 && dist < 45 && !this.dead) {
      this.bossVolleyCd = 2.6;
      for (let k = -1; k <= 1; k++) {
        const from = g.position.clone().setY(3.2);
        const dir = this.pos.clone().setY(1.2).sub(from).normalize();
        const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(k * 0.12);
        dir.add(side).normalize();
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff2d78, emissiveIntensity: 3 }));
        mesh.position.copy(from);
        this.scene.add(mesh);
        this.enemyShots.push({ mesh, vel: dir.multiplyScalar(20), life: 3.5, fromPlayer: false, dmg: 14 });
      }
      sfx.enemyShoot();
    }
  }
  bossDmgCd = 0; bossVolleyCd = 3;

  updateProjectiles(dt: number) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      p.life -= dt;
      p.vel.y -= 14 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (this.opts.particles) this.particles.trail(p.mesh.position, 0xf472b6);
      let boom = p.life <= 0 || p.mesh.position.y <= 0.15;
      // hit bots?
      if (!boom) {
        for (const b of this.bots) {
          if (!b.alive) continue;
          if (p.mesh.position.distanceTo(b.h.group.position.clone().setY(1)) < 1.1) { boom = true; break; }
        }
      }
      if (!boom) for (const dd of this.drones) {
        if (!dd.alive) continue;
        if (p.mesh.position.distanceTo(dd.d.group.position) < 1.2) { boom = true; break; }
      }
      if (boom) {
        const pos = p.mesh.position.clone();
        this.scene.remove(p.mesh);
        this.projs.splice(i, 1);
        this.explode(pos, p.dmg, true);
      }
    }
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const p = this.enemyShots[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (this.opts.particles && Math.random() < 0.6) this.particles.trail(p.mesh.position, 0xff3b5c);
      let dead = p.life <= 0 || p.mesh.position.y <= 0.1 || p.mesh.position.y > 20;
      const d = p.mesh.position.distanceTo(this.pos.clone().setY(this.pos.y - 0.3));
      if (d < 0.9 && !this.dead) {
        this.hurtPlayer(p.dmg, "PLASMA");
        dead = true;
        if (this.opts.particles) this.particles.burst(p.mesh.position, 0xff3b5c, 10, 5);
      }
      if (Math.abs(p.mesh.position.x) > 32 || Math.abs(p.mesh.position.z) > 32) dead = true;
      if (dead) { this.scene.remove(p.mesh); this.enemyShots.splice(i, 1); }
    }
  }

  updateTargetsOrbs(dt: number, t: number) {
    for (const tg of this.targets) {
      if (!tg.alive) continue;
      tg.life -= dt;
      const s = 1 + Math.sin(t * 6) * 0.03;
      tg.g.scale.setScalar(s);
      if (tg.life <= 0) {
        tg.alive = false;
        this.scene.remove(tg.g);
        this.combo = 0;
        this.addTarget();
      }
    }
    for (const o of this.orbs) {
      if (o.taken) continue;
      o.spin += dt * 2;
      o.g.rotation.y = o.spin;
      o.g.position.y = 1.1 + Math.sin(t * 2.4 + o.spin) * 0.18;
      o.g.children[1].rotation.z += dt * 1.5;
      const d = Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z);
      if (d < 1.6) {
        o.taken = true;
        this.scene.remove(o.g);
        this.orbsGot++;
        this.combo++; this.comboT = 4;
        const pts = 150 + this.combo * 25;
        this.score += pts;
        this.kills++;
        sfx.pickup();
        if (this.opts.particles) this.particles.burst(o.g.position, 0xa78bfa, 30, 8);
        this.pushFeed(`ORB ${this.orbsGot}/${this.orbsTotal}  +${pts}`);
        if (this.orbsGot >= this.orbsTotal) this.checkWin();
        else if (this.orbsGot % 5 === 0) { this.setBanner(`${this.orbsTotal - this.orbsGot} ORBS LEFT`); this.spawnDrones(1); }
      }
    }
  }

  updateModes(dt: number) {
    const m = this.opts.mode;
    if (m === "SURVIVAL") {
      if (this.waveState === "intro" || this.waveState === "breather") {
        this.waveT -= dt;
        if (this.waveT <= 0) {
          this.wave++;
          this.waveState = "active";
          const n = 2 + this.wave * 2;
          this.spawnWaveDrones(n);
          sfx.wave();
          this.setBanner(`WAVE ${this.wave} — ${n} HOSTILES`);
          this.pushFeed(`— WAVE ${this.wave} INCOMING —`);
        }
      } else if (this.waveState === "active") {
        const alive = this.drones.filter((d) => d.alive).length;
        if (alive === 0) {
          const bonus = 200 + this.wave * 100;
          this.score += bonus;
          this.hp = Math.min(this.maxHp, this.hp + 30);
          // ammo top-up
          for (const w of Object.keys(WEAPONS)) {
            const def = WEAPONS[w as WeaponId];
            if (def.mag > 0) this.reserve[w] = Math.min(def.reserve, this.reserve[w] + def.mag);
          }
          this.pushFeed(`WAVE ${this.wave} CLEAR  +${bonus}  +HP +AMMO`);
          this.waveState = "breather";
          this.waveT = 3.5;
          this.setBanner(`WAVE ${this.wave} CLEAR`);
        }
      }
    }
    if (this.timeLeft > 0 && !this.gameEnded) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        if (m === "TIME_ATTACK") this.endGame(true);
        else if (m === "SKIRMISH" || m === "SNIPER_NEST" || m === "PARTY_PVP") {
          // highest score wins
          let top = this.kills; let win = true;
          for (const b of this.bots) if (b.score > top) win = false;
          this.endGame(win);
        } else this.endGame(false);
      }
    }
    // low-time warning
    if (this.timeLeft > 0 && this.timeLeft < 10.5 && Math.random() < dt * 2) sfx.empty();
  }

  // ── MAIN LOOP ──
  start() {
    this.clock.start();
    const loop = () => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(loop);
      this.tick();
    };
    loop();
  }

  tick() {
    const rawDt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    // fps
    this.fpsAcc += rawDt; this.fpsN++;
    if (this.fpsAcc >= 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }

    if (!this.paused && !this.gameEnded) {
      this.elapsed += rawDt;
      this.updatePlayer(rawDt, t);
      const firing = (this.firing || this.touchFire) && !this.dead;
      if (firing) this.tryShoot(t);
      this.updateBots(rawDt, t);
      this.updateDrones(rawDt, t);
      this.updateBoss(rawDt, t);
      this.updateProjectiles(rawDt);
      this.updateTargetsOrbs(rawDt, t);
      this.updateModes(rawDt);
      // remotes anim
      for (const [, b] of this.remotes) if (b.alive) animateHumanoid(b.h, t, true, true);
    }

    // visuals always
    this.centerSpin += rawDt;
    const ob = this.arena.centerProp.getObjectByName("obelisk");
    if (ob) { ob.rotation.y = this.centerSpin * 0.8; ob.position.y = 4.2 + Math.sin(t * 1.4) * 0.35; }
    this.particles.update(rawDt);
    for (const tr of this.tracers) {
      if (tr.life < tr.max) {
        tr.life += rawDt;
        (tr.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, 0.9 * (1 - tr.life / tr.max));
      }
    }
    this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - rawDt * 900);
    (this.muzzleFlash.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (this.muzzleFlash.material as THREE.MeshBasicMaterial).opacity - rawDt * 12);
    if (this.hitmarker > 0) this.hitmarker = Math.max(0, this.hitmarker - rawDt * 4);
    if (this.bannerT > 0) this.bannerT -= rawDt;
    if (this.comboT > 0) { this.comboT -= rawDt; if (this.comboT <= 0) this.combo = 0; }
    if (this.damageFlash > 0) this.damageFlash -= rawDt * 2.2;
    if (this.gunKick > 0) this.gunKick -= rawDt * 6;
    if (this.gunSwap > 0) this.gunSwap -= rawDt * 4;
    if (this.bladeSwing > 0) this.bladeSwing -= rawDt * 5;
    if (this.shakeT > 0) { this.shakeT -= rawDt; if (this.shakeT <= 0) this.shakeAmp = 0; else this.shakeAmp *= 1 - rawDt * 4; }

    this.updateCamera(rawDt, t);
    this.updateGunVisual(rawDt, t);
    this.renderer.render(this.scene, this.camera);

    // HUD @ 12Hz
    this.hudT += rawDt;
    if (this.hudT > 0.08) { this.hudT = 0; this.emitHUD(); }
  }

  clicked = false;
  consumeClick() {
    // semi-auto: track fresh clicks
    if (!this.clicked && (this.firing || this.touchFire)) { /* held */ }
    return false;
  }

  updatePlayer(dt: number, t: number) {
    if (this.dead) {
      this.deathT += dt;
      if (this.deathT > 1.6 && !this.gameEnded) {
        if (this.opts.mode === "SURVIVAL" || this.opts.mode === "JUGGERNAUT" || this.opts.mode === "TIME_ATTACK") {
          this.endGame(false);
        } else this.respawnPlayer();
      }
      return;
    }
    const speedBase = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? 8.4 : 5.6;
    const speed = this.scoped ? speedBase * 0.45 : this.aiming ? speedBase * 0.7 : speedBase;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = new THREE.Vector3();
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) wish.add(fwd);
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) wish.sub(fwd);
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) wish.add(right);
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) wish.sub(right);
    wish.addScaledVector(fwd, -this.touchMove.y);
    wish.addScaledVector(right, this.touchMove.x);
    if (wish.lengthSq() > 1) wish.normalize();
    const accel = this.onGround ? 42 : 12;
    this.vel.x += wish.x * accel * dt;
    this.vel.z += wish.z * accel * dt;
    // friction
    const fr = this.onGround ? Math.max(0, 1 - dt * 9) : Math.max(0, 1 - dt * 0.6);
    if (wish.lengthSq() < 0.01) { this.vel.x *= fr; this.vel.z *= fr; }
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > speed) { this.vel.x *= speed / hs; this.vel.z *= speed / hs; }
    if ((this.keys.has("Space")) && this.onGround) { this.vel.y = 7.4; this.onGround = false; sfx.jump(); }
    this.vel.y -= 20 * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;
    if (this.pos.y <= 1.7) { this.pos.y = 1.7; this.vel.y = 0; this.onGround = true; }
    this.collide(this.pos, 0.55);
    // footsteps
    if (hs > 2 && this.onGround) {
      this.bobT += dt * hs * 1.6;
      if (Math.sin(this.bobT) > 0.96 && Math.random() < 0.3) sfx.step();
    }
    // reload
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        const def = WEAPONS[this.weapon];
        const need = def.mag - this.ammo[this.weapon];
        const take = Math.min(need, this.reserve[this.weapon]);
        this.ammo[this.weapon] += take;
        this.reserve[this.weapon] -= take;
      }
    }
    // scope
    const wantScope = this.weapon === "rail" && this.aiming;
    if (wantScope !== this.scoped) {
      this.scoped = wantScope;
      const def = WEAPONS[this.weapon];
      this.camera.fov = wantScope ? this.opts.fov / def.zoom : this.opts.fov;
      this.camera.updateProjectionMatrix();
    }
    // regen (out of combat)
    this.healT += dt;
    if (this.healT > 5 && this.hp < this.maxHp && !this.dead) this.hp = Math.min(this.maxHp, this.hp + dt * 8);
    if (this.damageFlash > 0.5) this.healT = 0;
  }

  updateCamera(_dt: number, t: number) {
    this.camera.position.copy(this.pos);
    let rx = this.pitch, ry = this.yaw;
    if (this.shakeAmp > 0.003) {
      rx += (Math.random() - 0.5) * this.shakeAmp * 0.06;
      ry += (Math.random() - 0.5) * this.shakeAmp * 0.06;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeAmp * 0.08;
    }
    // head bob
    this.camera.position.y += Math.sin(this.bobT * 2) * 0.025 * Math.min(1, Math.hypot(this.vel.x, this.vel.z) / 5);
    this.camera.rotation.set(rx, ry, 0);
    if (this.dead) {
      this.camera.position.y = Math.max(0.5, this.camera.position.y - this.deathT * 1.2);
      this.camera.rotation.z = Math.min(0.6, this.deathT * 0.5);
    }
    void t;
  }

  updateGunVisual(_dt: number, t: number) {
    if (!this.gunMesh) return;
    const scoped = this.scoped;
    const baseX = scoped ? 0 : 0.28;
    const baseY = scoped ? -0.175 : -0.26;
    const sway = scoped ? 0 : 1;
    const moveF = Math.min(1, Math.hypot(this.vel.x, this.vel.z) / 6);
    const bx = Math.sin(this.bobT) * 0.012 * moveF * sway + Math.sin(t * 1.3) * 0.004 * sway;
    const by = Math.abs(Math.cos(this.bobT)) * 0.014 * moveF * sway + Math.sin(t * 1.7) * 0.004 * sway;
    let kz = this.gunKick * 0.16;
    let rx = this.gunKick * 0.14;
    if (this.reloading > 0) {
      const p = 1 - this.reloading / Math.max(0.01, this.reloadDur);
      this.gunMesh.rotation.x = -0.7 * Math.sin(p * Math.PI);
      this.gunMesh.position.y = baseY - 0.12 * Math.sin(p * Math.PI);
    } else {
      this.gunMesh.rotation.x = rx;
    }
    if (this.gunSwap > 0) {
      this.gunMesh.position.y = baseY - this.gunSwap * 0.4;
    } else if (this.reloading <= 0) {
      this.gunMesh.position.y += (baseY + by - this.gunMesh.position.y) * 0.25;
    }
    this.gunMesh.position.x += (baseX + bx - this.gunMesh.position.x) * 0.3;
    this.gunMesh.position.z = -0.55 + kz;
    if (this.bladeSwing > 0) {
      const p = 1 - this.bladeSwing;
      this.gunMesh.rotation.z = -1.2 * Math.sin(p * Math.PI);
      this.gunMesh.rotation.x = -0.4 * Math.sin(p * Math.PI);
      this.gunMesh.position.x = baseX - 0.25 * Math.sin(p * Math.PI);
    } else if (this.weapon === "blade") {
      this.gunMesh.rotation.z = Math.sin(t * 2) * 0.03;
      this.gunMesh.rotation.x = 0;
    }
    // hide gun when scoped (scope overlay instead)
    this.gunMesh.visible = !scoped;
    void _dt;
  }

  emitHUD() {
    const def = WEAPONS[this.weapon];
    const enemiesLeft = this.bots.filter((b) => b.alive).length + this.drones.filter((d) => d.alive).length + (this.bossHp > 0 && this.boss ? 1 : 0) + this.targets.filter((x) => x.alive).length;
    this.opts.onHUD({
      hp: Math.max(0, Math.round(this.hp)), maxHp: this.maxHp,
      ammo: this.ammo[this.weapon], reserve: this.reserve[this.weapon], reloading: this.reloading > 0,
      weapon: this.weapon, weapon2: this.weapon2, score: this.score, kills: this.kills, deaths: this.deaths,
      streak: this.streak, best: this.best, timeLeft: Math.max(0, this.timeLeft), wave: this.wave,
      enemiesLeft, orbs: this.orbsGot, orbsTotal: this.orbsTotal,
      bossHp: Math.max(0, Math.round(this.bossHp)), bossMax: this.bossMax,
      hitmarker: this.hitmarker, headshot: this.headshotMark, scoped: this.scoped, fps: this.fps,
      killfeed: [...this.killfeed], banner: this.bannerT > 0 ? this.banner : "", bannerT: this.bannerT,
      combo: this.combo, comboT: this.comboT, lowAmmo: def.mag > 0 && this.ammo[this.weapon] <= Math.ceil(def.mag * 0.25),
      interact: this.interactMsg,
    });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    window.removeEventListener("resize", this.onResize);
    this.canvas.removeEventListener("contextmenu", this.onCtx);
    document.exitPointerLock?.();
    this.particles.dispose(this.scene);
    this.dmgNums.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); const m = o.material as THREE.Material | THREE.Material[]; if (Array.isArray(m)) m.forEach((x) => x.dispose()); else m.dispose(); }
    });
    this.renderer.dispose();
  }
}

interface HitData { kind: "bot" | "remote" | "drone" | "boss" | "target" | "wall"; bot?: Bot; drone?: DroneE; target?: TargetE; head: boolean }
