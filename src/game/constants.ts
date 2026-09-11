export type GameModeId = "SKIRMISH" | "SURVIVAL" | "TIME_ATTACK" | "ORB_RUSH" | "SNIPER_NEST" | "JUGGERNAUT" | "PARTY_PVP";
export type ArenaId = "NEON_VOID" | "SUNSET_DUNES" | "FROST_LAB";
export type WeaponId = "rifle" | "scatter" | "rail" | "smg" | "thumper" | "blade";

export interface WeaponDef {
  id: WeaponId;
  name: string;
  short: string;
  desc: string;
  damage: number;
  pellets: number;
  rpm: number;
  mag: number;
  reserve: number;
  reloadMs: number;
  spread: number;
  range: number;
  kick: number;
  auto: boolean;
  zoom: number;
  projectile: boolean;
  melee: boolean;
  color: number;
  accent: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  rifle: { id: "rifle", name: "PULSE RIFLE", short: "RFL", desc: "Reliable auto rifle. Tight, punchy, endless fun.", damage: 22, pellets: 1, rpm: 520, mag: 30, reserve: 180, reloadMs: 1350, spread: 0.014, range: 120, kick: 0.55, auto: true, zoom: 1.15, projectile: false, melee: false, color: 0x22d3ee, accent: 0x0e7490 },
  smg: { id: "smg", name: "PLASMA SMG", short: "SMG", desc: "Bullet hose. Melts at close range.", damage: 12, pellets: 1, rpm: 900, mag: 45, reserve: 270, reloadMs: 1500, spread: 0.03, range: 70, kick: 0.32, auto: true, zoom: 1.1, projectile: false, melee: false, color: 0xa78bfa, accent: 0x6d28d9 },
  scatter: { id: "scatter", name: "SCATTERGUN", short: "SCT", desc: "8-pellet room deleter. Get close.", damage: 13, pellets: 8, rpm: 78, mag: 6, reserve: 42, reloadMs: 2100, spread: 0.075, range: 32, kick: 2.4, auto: false, zoom: 1.05, projectile: false, melee: false, color: 0xfb923c, accent: 0x9a3412 },
  rail: { id: "rail", name: "RAIL SNIPER", short: "RIL", desc: "One shot, one delete. Scope with RMB.", damage: 150, pellets: 1, rpm: 42, mag: 5, reserve: 25, reloadMs: 2400, spread: 0.001, range: 300, kick: 3.2, auto: false, zoom: 3.2, projectile: false, melee: false, color: 0x4ade80, accent: 0x166534 },
  thumper: { id: "thumper", name: "THUMPER", short: "THP", desc: "Bouncing plasma grenades. Big boom.", damage: 95, pellets: 1, rpm: 70, mag: 3, reserve: 18, reloadMs: 2000, spread: 0.004, range: 90, kick: 1.8, auto: false, zoom: 1.05, projectile: true, melee: false, color: 0xf472b6, accent: 0x9d174d },
  blade: { id: "blade", name: "ARC BLADE", short: "BLD", desc: "Energy sword. Silent, instant, infinite.", damage: 80, pellets: 1, rpm: 130, mag: -1, reserve: -1, reloadMs: 0, spread: 0, range: 4.2, kick: 0.4, auto: true, zoom: 1.0, projectile: false, melee: true, color: 0xfacc15, accent: 0xa16207 },
};

export const WEAPON_LIST = Object.values(WEAPONS);

export interface ModeDef {
  id: GameModeId;
  name: string;
  tag: string;
  desc: string;
  icon: string;
  color: string;
  bots: number;
  timeLimit: number; // seconds, 0 = endless
  killTarget: number;
}

export const MODES: ModeDef[] = [
  { id: "SKIRMISH", name: "SKIRMISH", tag: "FFA vs 5 BOTS", desc: "Classic deathmatch. First to 15 kills wins. Pure gunplay.", icon: "⚔️", color: "#22d3ee", bots: 5, timeLimit: 300, killTarget: 15 },
  { id: "SURVIVAL", name: "WAVE SURVIVAL", tag: "ENDLESS WAVES", desc: "Hold the line against hunter drones. How long can you last?", icon: "🛡️", color: "#4ade80", bots: 0, timeLimit: 0, killTarget: 0 },
  { id: "TIME_ATTACK", name: "TIME ATTACK", tag: "60s TARGETS", desc: "Pop-up targets. +2s per hit, chains multiply score.", icon: "⏱️", color: "#facc15", bots: 0, timeLimit: 60, killTarget: 0 },
  { id: "ORB_RUSH", name: "ORB RUSH", tag: "COLLECT 20", desc: "Grab 20 energy orbs while sentries hunt you. Fast feet win.", icon: "🔮", color: "#a78bfa", bots: 3, timeLimit: 240, killTarget: 20 },
  { id: "SNIPER_NEST", name: "SNIPER NEST", tag: "LONG RANGE", desc: "Railgunners at 80m+. One-shot duels on the ridge.", icon: "🎯", color: "#fb923c", bots: 4, timeLimit: 300, killTarget: 12 },
  { id: "JUGGERNAUT", name: "JUGGERNAUT", tag: "BOSS FIGHT", desc: "A 4-meter war machine + minions. Break its core.", icon: "🤖", color: "#f472b6", bots: 2, timeLimit: 420, killTarget: 1 },
];

export interface SkinDef { id: string; name: string; primary: number; secondary: number; glow: number; }
export const GUN_SKINS: SkinDef[] = [
  { id: "cyan", name: "NEON CYAN", primary: 0x22d3ee, secondary: 0x0e7490, glow: 0x67e8f9 },
  { id: "magma", name: "MAGMA", primary: 0xf97316, secondary: 0x7c2d12, glow: 0xfdba74 },
  { id: "venom", name: "VENOM", primary: 0x4ade80, secondary: 0x14532d, glow: 0x86efac },
  { id: "violet", name: "VOID VIOLET", primary: 0xa78bfa, secondary: 0x4c1d95, glow: 0xc4b5fd },
  { id: "rose", name: "ROSE FURY", primary: 0xf472b6, secondary: 0x831843, glow: 0xf9a8d4 },
  { id: "gold", name: "SOLAR GOLD", primary: 0xfacc15, secondary: 0x713f12, glow: 0xfde68a },
  { id: "ghost", name: "GHOST", primary: 0xe2e8f0, secondary: 0x475569, glow: 0xffffff },
  { id: "blood", name: "BLOODLINE", primary: 0xef4444, secondary: 0x450a0a, glow: 0xfca5a5 },
];

export const SUIT_SKINS: SkinDef[] = [
  { id: "suit_cyan", name: "CYAN OPS", primary: 0x22d3ee, secondary: 0x164e63, glow: 0x67e8f9 },
  { id: "suit_lime", name: "LIME GHOST", primary: 0xa3e635, secondary: 0x365314, glow: 0xd9f99d },
  { id: "suit_orange", name: "EMBER", primary: 0xfb923c, secondary: 0x431407, glow: 0xfdba74 },
  { id: "suit_purple", name: "SPECTRE", primary: 0xc084fc, secondary: 0x581c87, glow: 0xe9d5ff },
  { id: "suit_red", name: "CRIMSON", primary: 0xf87171, secondary: 0x450a0a, glow: 0xfca5a5 },
  { id: "suit_stealth", name: "STEALTH", primary: 0x64748b, secondary: 0x0f172a, glow: 0xcbd5e1 },
];

export const ARENAS: { id: ArenaId; name: string; desc: string; sky: number; fog: number; floor: number; grid: number; accent: number }[] = [
  { id: "NEON_VOID", name: "NEON VOID", desc: "Purple haze combat pit", sky: 0x0b0620, fog: 0x14092e, floor: 0x151032, grid: 0x7c3aed, accent: 0x22d3ee },
  { id: "SUNSET_DUNES", name: "SUNSET DUNES", desc: "Amber canyon outpost", sky: 0x2a1206, fog: 0x3a1a08, floor: 0x2b1a10, grid: 0xfb923c, accent: 0xfacc15 },
  { id: "FROST_LAB", name: "FROST LAB", desc: "Cryo research ring", sky: 0x041826, fog: 0x08293d, floor: 0x0b1f2e, grid: 0x22d3ee, accent: 0x4ade80 },
];

export const CROSSHAIRS = [
  { id: "cross", name: "CROSS" },
  { id: "dot", name: "DOT" },
  { id: "circle", name: "CIRCLE" },
  { id: "chevron", name: "CHEVRON" },
];
