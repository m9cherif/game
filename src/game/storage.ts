export interface LocalScore { name: string; mode: string; score: number; kills: number; accuracy: number; date: number; }

const KEY = "neonstrike_scores_v1";
const SETTINGS_KEY = "neonstrike_settings_v1";
const LOADOUT_KEY = "neonstrike_loadout_v1";

export function getScores(): LocalScore[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as LocalScore[];
    return Array.isArray(arr) ? arr.sort((a, b) => b.score - a.score).slice(0, 10) : [];
  } catch { return []; }
}

export function saveScore(s: LocalScore) {
  const list = getScores();
  list.push(s);
  list.sort((a, b) => b.score - a.score);
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 10))); } catch { /* noop */ }
  return list.slice(0, 10);
}

export function isHighScore(score: number) {
  const list = getScores();
  return list.length < 10 || score > (list[list.length - 1]?.score ?? 0);
}

export interface Settings { sens: number; fov: number; shake: boolean; particles: boolean; muted: boolean; quality: "auto" | "low" | "high"; }
export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { sens: 1, fov: 78, shake: true, particles: true, muted: false, quality: "auto", ...JSON.parse(raw) };
  } catch { /* noop */ }
  return { sens: 1, fov: 78, shake: true, particles: true, muted: false, quality: "auto" };
}
export function saveSettings(s: Settings) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* noop */ } }

export interface Loadout { weapon: string; weapon2: string; gunSkin: string; suitSkin: string; crosshair: string; arena: string; name: string; }
export function getLoadout(): Loadout {
  try {
    const raw = localStorage.getItem(LOADOUT_KEY);
    if (raw) return { weapon: "rifle", weapon2: "rail", gunSkin: "cyan", suitSkin: "suit_cyan", crosshair: "cross", arena: "NEON_VOID", name: "ACE", ...JSON.parse(raw) };
  } catch { /* noop */ }
  return { weapon: "rifle", weapon2: "rail", gunSkin: "cyan", suitSkin: "suit_cyan", crosshair: "cross", arena: "NEON_VOID", name: "ACE" };
}
export function saveLoadout(l: Loadout) { try { localStorage.setItem(LOADOUT_KEY, JSON.stringify(l)); } catch { /* noop */ } }

export function playerId(): string {
  let id = "";
  try {
    id = localStorage.getItem("neonstrike_pid") ?? "";
    if (!id) { id = "p_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem("neonstrike_pid", id); }
  } catch { id = "p_" + Math.random().toString(36).slice(2, 10); }
  return id;
}
