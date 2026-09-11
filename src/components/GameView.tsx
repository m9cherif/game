"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { GameEngine, type GameResult, type HUDState } from "@/game/engine";
import { WEAPONS, SUIT_SKINS, type ArenaId, type GameModeId, type WeaponId } from "@/game/constants";
import type { Loadout, Settings } from "@/game/storage";
import { getScores, saveScore, type LocalScore } from "@/game/storage";
import { Party, myPid, type PartyState } from "@/game/net";
import { sfx } from "@/game/audio";

interface Props {
  mode: GameModeId;
  loadout: Loadout;
  settings: Settings;
  setSettings: (s: Settings) => void;
  partyCode?: string | null;
  onExit: () => void;
  isMobile: boolean;
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default function GameView({ mode, loadout, settings, setSettings, partyCode, onExit, isMobile }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HUDState | null>(null);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);
  const [engineKey, setEngineKey] = useState(0);
  const [locked, setLocked] = useState(isMobile);
  const [prevHp, setPrevHp] = useState(100);
  const [flash, setFlash] = useState(0);
  const [mpPlayers, setMpPlayers] = useState<PartyState["players"]>([]);
  const [mpFeed, setMpFeed] = useState<string[]>([]);
  const [localTop, setLocalTop] = useState<LocalScore[]>([]);
  const [saved, setSaved] = useState(false);
  const lastEvent = useRef(0);
  const lastServerHp = useRef(100);
  const endSent = useRef(false);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const stickRef = useRef<{ id: number | null; cx: number; cy: number }>({ id: null, cx: 0, cy: 0 });
  const lookRef = useRef<{ id: number | null; lx: number; ly: number }>({ id: null, lx: 0, ly: 0 });
  const scoreRef = useRef(0);
  const [scorePop, setScorePop] = useState(false);

  const suit = SUIT_SKINS.find((s) => s.id === loadout.suitSkin) ?? SUIT_SKINS[0];

  const doPause = useCallback((p: boolean) => {
    if (result) return;
    setPaused(p);
    engineRef.current?.setPaused(p);
    if (!p && !isMobile) {
      try { canvasRef.current?.requestPointerLock(); } catch { /* noop */ }
    }
  }, [result, isMobile]);

  const restart = useCallback(() => {
    sfx.ui();
    setResult(null); setPaused(false); setSaved(false); endSent.current = false;
    lastServerHp.current = 100;
    setEngineKey((k) => k + 1);
  }, []);

  // lock tracking
  useEffect(() => {
    const onLock = () => {
      const isLocked = document.pointerLockElement === canvasRef.current;
      setLocked(isLocked || isMobile);
      if (!isLocked && !isMobile && !result && engineRef.current && !engineRef.current.gameEnded) {
        setPaused(true);
        engineRef.current.setPaused(true);
      }
    };
    document.addEventListener("pointerlockchange", onLock);
    return () => document.removeEventListener("pointerlockchange", onLock);
  }, [isMobile, result]);

  // keys: P pause, R restart on gameover, M mute
  useEffect(() => {
    const onK = (e: KeyboardEvent) => {
      if (e.code === "KeyP" && !result) doPause(!pausedRef.current);
      if (e.code === "KeyM") { const m = !settings.muted; setSettings({ ...settings, muted: m }); sfx.setMuted(m); }
      if (e.code === "KeyR" && result) restart();
      if (e.code === "Enter" && result) restart();
    };
    window.addEventListener("keydown", onK);
    return () => window.removeEventListener("keydown", onK);
  }, [result, settings, setSettings, restart, doPause]);
  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // engine lifecycle
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    sfx.ensure();
    sfx.setMuted(settings.muted);
    sfx.startMusic();

    const engine = new GameEngine(canvas, container, {
      mode,
      arena: (loadout.arena as ArenaId) || "NEON_VOID",
      primary: (loadout.weapon as WeaponId) || "rifle",
      secondary: (loadout.weapon2 as WeaponId) || "rail",
      gunSkin: loadout.gunSkin,
      suitColor: suit.primary,
      suitGlow: suit.glow,
      sensitivity: settings.sens,
      fov: settings.fov,
      shake: settings.shake,
      particles: settings.particles,
      isMobile,
      remoteMode: !!partyCode,
      onHUD: (h) => {
        setHud(h);
        if (h.score !== scoreRef.current) { scoreRef.current = h.score; setScorePop(true); window.setTimeout(() => setScorePop(false), 250); }
        setPrevHp((prev) => {
          if (h.hp < prev) setFlash(1);
          return h.hp;
        });
      },
      onGameOver: (r) => {
        setResult(r);
        sfx.stopMusic();
        if (partyCode && !endSent.current) {
          endSent.current = true;
          Party.event(partyCode, "end", { name: loadout.name, score: r.score, kills: r.kills }).catch(() => {});
        }
      },
      onRemoteHit: (playerId, damage, head) => {
        if (!partyCode) return;
        Party.event(partyCode, "damage", { to: playerId, dmg: damage, head: head ? 1 : 0, from: myPid(), fromName: loadout.name }).catch(() => {});
      },
      onLocalShot: () => { /* could send muzzle event */ },
    });
    engineRef.current = engine;
    engine.start();
    setPrevHp(100); setFlash(0);

    // desktop: try lock on first click handled by overlay; auto-request
    if (!isMobile) {
      const t = window.setTimeout(() => { try { canvas.requestPointerLock(); } catch { /* noop */ } }, 400);
    }

    // multiplayer loops
    let upInt = 0; let stInt = 0;
    if (partyCode) {
      upInt = window.setInterval(() => {
        const e = engineRef.current;
        if (!e || e.gameEnded) return;
        const tr = e.getTransform();
        Party.update(partyCode, { ...tr, name: loadout.name, skin: loadout.suitSkin }).catch(() => {});
      }, 140);
      stInt = window.setInterval(async () => {
        const e = engineRef.current;
        if (!e || e.gameEnded) return;
        try {
          const st = await Party.state(partyCode, lastEvent.current);
          const others = st.players.filter((p) => p.playerId !== myPid());
          const me = st.players.find((p) => p.playerId === myPid());
          e.syncRemotes(others.map((p) => ({
            playerId: p.playerId, name: p.name, skin: p.skin, weapon: p.weapon,
            x: p.x, y: p.y, z: p.z, rotY: p.rotY, pitch: p.pitch, health: p.health, alive: p.alive, score: p.score, kills: p.kills,
          })));
          setMpPlayers(st.players);
          // incoming damage (authoritative server hp)
          if (me) {
            lastServerHp.current = me.health;
            if (me.health < e.hp - 0.5 && !e.dead) {
              e.hp = me.health;
              e.damageFlash = 1;
              setFlash(1);
              sfx.hurt();
              if (me.health <= 0 && !e.dead) {
                e.hp = 0;
                e.hurtPlayer(1, "RIVAL");
              }
            }
            // win check: someone hit target
            const target = st.party.killTarget ?? 10;
            const winner = st.players.find((p) => p.kills >= target);
            if (winner && !e.gameEnded) {
              if (winner.playerId === myPid()) e.endGame(true);
              else { e.setBanner(`${winner.name} WINS`); e.endGame(false); }
            }
          }
          for (const ev of st.events) {
            lastEvent.current = Math.max(lastEvent.current, ev.id);
            if (ev.fromId === myPid()) continue;
            const pl = ev.payload as Record<string, unknown>;
            if (ev.type === "kill" && pl.text) setMpFeed((f) => [`${String(pl.text)}`, ...f].slice(0, 4));
            if (ev.type === "end" && pl.name) setMpFeed((f) => [`${String(pl.name)} finished ${String(pl.score)}pts`, ...f].slice(0, 4));
          }
        } catch { /* offline */ }
      }, 450);
    }

    return () => {
      window.clearInterval(upInt);
      window.clearInterval(stInt);
      engine.dispose();
      engineRef.current = null;
      sfx.stopMusic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineKey]);

  // flash decay
  useEffect(() => {
    if (flash <= 0) return;
    const t = window.setTimeout(() => setFlash(0), 180);
    return () => window.clearTimeout(t);
  }, [flash]);

  // save score on game over
  useEffect(() => {
    if (!result || saved) return;
    setSaved(true);
    const acc = result.shots ? result.hits / result.shots : 0;
    const top = saveScore({ name: loadout.name || "ACE", mode: result.mode, score: result.score, kills: result.kills, accuracy: acc, date: Date.now() });
    setLocalTop(top);
    fetch("/api/scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: loadout.name, mode: result.mode, score: result.score, kills: result.kills, wave: result.wave, accuracy: acc }) }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);
  useEffect(() => { setLocalTop(getScores()); }, []);

  // touch handlers
  const onStickStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    stickRef.current = { id: t.identifier, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
  };
  const onStickMove = (e: React.TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === stickRef.current.id) {
        const dx = (t.clientX - stickRef.current.cx) / 50;
        const dy = (t.clientY - stickRef.current.cy) / 50;
        const len = Math.hypot(dx, dy);
        const cl = len > 1 ? 1 / len : 1;
        const x = dx * cl, y = dy * cl;
        setStick({ x, y });
        engineRef.current?.setTouchMove(x, y);
      }
    }
  };
  const onStickEnd = (e: React.TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === stickRef.current.id) {
        stickRef.current.id = null;
        setStick({ x: 0, y: 0 });
        engineRef.current?.setTouchMove(0, 0);
      }
    }
  };
  const onLookStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    lookRef.current = { id: t.identifier, lx: t.clientX, ly: t.clientY };
  };
  const onLookMove = (e: React.TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === lookRef.current.id) {
        engineRef.current?.addTouchLook((t.clientX - lookRef.current.lx) * 1.6, (t.clientY - lookRef.current.ly) * 1.6);
        lookRef.current.lx = t.clientX; lookRef.current.ly = t.clientY;
      }
    }
  };
  const onLookEnd = (e: React.TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) if (t.identifier === lookRef.current.id) lookRef.current.id = null;
  };

  const w = hud ? WEAPONS[hud.weapon] : null;
  const killTarget = mode === "SKIRMISH" ? 15 : mode === "SNIPER_NEST" ? 12 : mode === "PARTY_PVP" || partyCode ? 10 : 0;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black" id="game-root">
      <div ref={containerRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>

      {/* damage vignette */}
      <div className="dmg-vignette hud-layer" style={{ opacity: flash ? 0.9 : hud && hud.hp <= 30 && hud.hp > 0 ? undefined : 0, zIndex: 20 }} />
      {hud && hud.hp <= 30 && hud.hp > 0 && <div className="dmg-vignette hud-layer lowhp-pulse" style={{ zIndex: 20 }} />}

      {/* scope */}
      {hud?.scoped && (
        <div className="hud-layer" style={{ zIndex: 21 }}>
          <div className="scope-overlay" />
          <div className="absolute left-1/2 top-1/2 h-px w-full -translate-x-1/2 -translate-y-1/2 bg-cyan-300/70" />
          <div className="absolute left-1/2 top-1/2 h-full w-px -translate-x-1/2 -translate-y-1/2 bg-cyan-300/70" />
          <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-300/80" />
        </div>
      )}

      {/* ── HUD ── */}
      {hud && !result && (
        <div className="hud-layer absolute inset-0" style={{ zIndex: 22 }}>
          {/* crosshair */}
          {!hud.scoped && (
            <div className="crosshair">
              {loadout.crosshair === "dot" && <div className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_#22d3ee]" />}
              {loadout.crosshair === "cross" && (
                <div className="relative h-8 w-8">
                  <div className="absolute left-1/2 top-0 h-2.5 w-0.5 -translate-x-1/2 bg-cyan-300 shadow-[0_0_6px_#22d3ee]" />
                  <div className="absolute bottom-0 left-1/2 h-2.5 w-0.5 -translate-x-1/2 bg-cyan-300 shadow-[0_0_6px_#22d3ee]" />
                  <div className="absolute left-0 top-1/2 h-0.5 w-2.5 -translate-y-1/2 bg-cyan-300 shadow-[0_0_6px_#22d3ee]" />
                  <div className="absolute right-0 top-1/2 h-0.5 w-2.5 -translate-y-1/2 bg-cyan-300 shadow-[0_0_6px_#22d3ee]" />
                  <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
                </div>
              )}
              {loadout.crosshair === "circle" && <div className="h-7 w-7 rounded-full border-2 border-cyan-300 shadow-[0_0_8px_#22d3ee]" />}
              {loadout.crosshair === "chevron" && <div className="text-2xl font-black text-cyan-300" style={{ textShadow: "0 0 8px #22d3ee" }}>⌄</div>}
            </div>
          )}
          {/* hitmarker */}
          <div className={`hitmarker h-8 w-8 ${hud.hitmarker > 0.2 ? "show" : ""}`}>
            <div className="absolute left-1/2 top-1/2 h-8 w-1 -translate-x-1/2 -translate-y-1/2 bg-white shadow-[0_0_8px_#fff]" />
            <div className="absolute left-1/2 top-1/2 h-1 w-8 -translate-x-1/2 -translate-y-1/2 bg-white shadow-[0_0_8px_#fff]" />
          </div>
          {hud.headshot && hud.hitmarker > 0.2 && <div className="absolute left-1/2 top-[42%] -translate-x-1/2 text-sm font-black tracking-widest text-yellow-300">HEADSHOT</div>}

          {/* banner */}
          {hud.banner && (
            <div key={hud.banner} className="banner-anim font-display absolute left-1/2 top-[22%] -translate-x-1/2 whitespace-nowrap text-3xl font-black tracking-widest text-white sm:text-4xl" style={{ textShadow: "0 0 20px #22d3ee, 0 2px 0 #000" }}>
              {hud.banner}
            </div>
          )}

          {/* top bar */}
          <div className="absolute left-1/2 top-2 flex -translate-x-1/2 items-stretch gap-2">
            <div className="rounded-lg bg-black/60 px-3 py-1.5 text-center backdrop-blur-sm">
              <div className="text-[9px] font-bold tracking-widest text-slate-400">{mode === "SURVIVAL" ? "WAVE" : mode === "TIME_ATTACK" ? "TIME" : "SCORE"}</div>
              <div className={`font-display text-lg font-black leading-none text-white ${scorePop ? "score-pop" : ""}`}>
                {mode === "SURVIVAL" ? hud.wave || "—" : mode === "TIME_ATTACK" ? fmtTime(hud.timeLeft) : hud.score.toLocaleString()}
              </div>
            </div>
            {(mode === "SKIRMISH" || mode === "SNIPER_NEST" || partyCode) && (
              <div className="rounded-lg bg-black/60 px-3 py-1.5 text-center backdrop-blur-sm">
                <div className="text-[9px] font-bold tracking-widest text-slate-400">TARGET</div>
                <div className="font-display text-lg font-black leading-none text-cyan-300">{hud.kills}/{killTarget}</div>
              </div>
            )}
            {mode === "ORB_RUSH" && (
              <div className="rounded-lg bg-black/60 px-3 py-1.5 text-center backdrop-blur-sm">
                <div className="text-[9px] font-bold tracking-widest text-slate-400">ORBS</div>
                <div className="font-display text-lg font-black leading-none text-fuchsia-300">{hud.orbs}/{hud.orbsTotal}</div>
              </div>
            )}
            {mode !== "SURVIVAL" && mode !== "TIME_ATTACK" && hud.timeLeft > 0 && (
              <div className="rounded-lg bg-black/60 px-3 py-1.5 text-center backdrop-blur-sm">
                <div className="text-[9px] font-bold tracking-widest text-slate-400">TIME</div>
                <div className={`font-display text-lg font-black leading-none ${hud.timeLeft < 30 ? "text-red-400" : "text-white"}`}>{fmtTime(hud.timeLeft)}</div>
              </div>
            )}
            {mode === "TIME_ATTACK" && (
              <div className="rounded-lg bg-black/60 px-3 py-1.5 text-center backdrop-blur-sm">
                <div className="text-[9px] font-bold tracking-widest text-slate-400">COMBO</div>
                <div className="font-display text-lg font-black leading-none text-yellow-300">×{Math.max(1, hud.combo)}</div>
              </div>
            )}
          </div>

          {/* boss bar */}
          {mode === "JUGGERNAUT" && hud.bossMax > 1 && (
            <div className="absolute left-1/2 top-16 w-72 -translate-x-1/2 sm:w-96">
              <div className="mb-1 flex justify-between text-[10px] font-bold tracking-widest"><span className="text-pink-400">🤖 JUGGERNAUT</span><span className="text-white">{hud.bossHp}/{hud.bossMax}</span></div>
              <div className="h-3 overflow-hidden rounded-full bg-black/70"><div className="h-full rounded-full bg-gradient-to-r from-pink-600 to-pink-400 transition-all" style={{ width: `${(hud.bossHp / hud.bossMax) * 100}%` }} /></div>
            </div>
          )}

          {/* killfeed */}
          <div className="absolute left-2 top-2 w-56 space-y-1 sm:w-64">
            {hud.killfeed.slice(0, 5).map((k, i) => (
              <div key={i} className="killfeed-item truncate rounded bg-black/60 px-2 py-1 text-[11px] font-bold text-slate-200 backdrop-blur-sm" style={{ opacity: 1 - i * 0.18 }}>{k.text}</div>
            ))}
            {mpFeed.map((f, i) => (
              <div key={`m${i}`} className="killfeed-item truncate rounded bg-pink-900/60 px-2 py-1 text-[11px] font-bold text-pink-200">{f}</div>
            ))}
          </div>

          {/* stats */}
          <div className="absolute right-2 top-2 rounded-lg bg-black/60 px-3 py-1.5 text-right backdrop-blur-sm">
            <div className="font-display text-sm font-black text-white">K {hud.kills} <span className="text-slate-500">/ D {hud.deaths}</span></div>
            <div className="text-[10px] font-bold text-slate-400">{hud.score.toLocaleString()} PTS · {hud.fps} FPS {hud.streak >= 2 && <span className="text-orange-400">· 🔥{hud.streak}</span>}</div>
            {partyCode && mpPlayers.length > 0 && (
              <div className="mt-1 border-t border-slate-700 pt-1 text-[10px]">
                {[...mpPlayers].sort((a, b) => b.kills - a.kills).slice(0, 4).map((p) => (
                  <div key={p.playerId} className={p.playerId === myPid() ? "text-cyan-300" : "text-slate-400"}>{p.name}: {p.kills}K</div>
                ))}
              </div>
            )}
          </div>

          {/* bottom-left HP */}
          <div className="absolute bottom-2 left-2 w-52 sm:bottom-4 sm:left-4 sm:w-64">
            <div className="mb-1 flex items-end justify-between">
              <span className="font-display text-3xl font-black text-white" style={{ textShadow: "0 2px 8px #000" }}>{hud.hp}</span>
              <span className="mb-1 text-[10px] font-bold tracking-widest text-slate-400">INTEGRITY</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-black/70">
              <div className={`h-full rounded-full transition-all ${hud.hp > 60 ? "bg-gradient-to-r from-cyan-500 to-cyan-300" : hud.hp > 30 ? "bg-gradient-to-r from-yellow-500 to-yellow-300" : "bg-gradient-to-r from-red-600 to-red-400"}`} style={{ width: `${(hud.hp / hud.maxHp) * 100}%` }} />
            </div>
            {!isMobile && <div className="mt-1 text-[10px] text-slate-500">[R] reload · [Q] swap · [P] pause</div>}
          </div>

          {/* bottom-right weapon */}
          <div className="absolute bottom-2 right-2 text-right sm:bottom-4 sm:right-4">
            <div className="text-[10px] font-bold tracking-widest" style={{ color: `#${(w ? w.color : 0x22d3ee).toString(16).padStart(6, "0")}` }}>{w?.name} {hud.reloading && <span className="animate-pulse text-yellow-300">· RELOADING</span>}</div>
            {w && w.mag >= 0 ? (
              <div className="font-display text-4xl font-black text-white" style={{ textShadow: "0 2px 8px #000" }}>
                {hud.ammo}<span className="text-lg text-slate-400">/{hud.reserve}</span>
              </div>
            ) : (
              <div className="font-display text-4xl font-black text-yellow-300" style={{ textShadow: "0 0 16px #facc15" }}>∞</div>
            )}
            {hud.lowAmmo && !hud.reloading && <div className="animate-pulse text-[11px] font-bold text-red-400">LOW AMMO — PRESS R</div>}
            <div className="text-[10px] text-slate-500">2ND: {WEAPONS[hud.weapon2]?.name}</div>
          </div>

          {/* pause btn */}
          <button onClick={() => doPause(true)} className="absolute bottom-24 right-2 rounded-lg bg-black/60 px-3 py-2 text-sm backdrop-blur-sm sm:bottom-auto sm:top-16 sm:right-2">⏸</button>
        </div>
      )}

      {/* touch controls */}
      {isMobile && !result && !paused && (
        <>
          <div className="absolute bottom-24 left-3" style={{ zIndex: 25 }}>
            <div className="stick-base" onTouchStart={onStickStart} onTouchMove={onStickMove} onTouchEnd={onStickEnd}>
              <div className="stick-nub" style={{ transform: `translate(calc(-50% + ${stick.x * 32}px), calc(-50% + ${stick.y * 32}px))` }} />
            </div>
          </div>
          <div className="absolute bottom-24 right-3 flex flex-col items-end gap-2" style={{ zIndex: 25 }}>
            <div className="flex gap-2">
              <button className="tbtn" onTouchStart={(e) => { e.preventDefault(); engineRef.current?.touchJump(); }}>JUMP</button>
              <button className="tbtn" onTouchStart={(e) => { e.preventDefault(); engineRef.current?.startReload(); }}>RLD</button>
              <button className="tbtn" onTouchStart={(e) => { e.preventDefault(); engineRef.current?.cycleWeapon(); }}>SWAP</button>
            </div>
            <button className="fire-btn"
              onTouchStart={(e) => { e.preventDefault(); engineRef.current?.setTouchFire(true); }}
              onTouchEnd={(e) => { e.preventDefault(); engineRef.current?.setTouchFire(false); }}>
              FIRE
            </button>
          </div>
          <div className="absolute right-0 top-0 h-[55%] w-[55%]" style={{ zIndex: 15, touchAction: "none" }}
            onTouchStart={onLookStart} onTouchMove={onLookMove} onTouchEnd={onLookEnd} />
        </>
      )}

      {/* click-to-play (desktop, not locked) */}
      {!isMobile && !locked && !result && !paused && (
        <button
          onClick={() => { try { canvasRef.current?.requestPointerLock(); } catch { /* noop */ } }}
          className="absolute inset-0 flex items-center justify-center bg-black/60"
          style={{ zIndex: 30 }}
        >
          <div className="panel rounded-2xl px-10 py-8 text-center">
            <div className="font-display text-3xl font-black text-cyan-300">CLICK TO ENGAGE</div>
            <p className="mt-2 text-xs text-slate-400">Mouse captured for aiming · ESC to pause</p>
          </div>
        </button>
      )}

      {/* pause overlay */}
      {paused && !result && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4" style={{ zIndex: 40 }}>
          <div className="panel w-full max-w-sm rounded-2xl p-6 text-center">
            <h2 className="font-display text-3xl font-black tracking-widest text-cyan-300">PAUSED</h2>
            {hud && <p className="mt-1 text-xs text-slate-400">SCORE {hud.score.toLocaleString()} · K {hud.kills} / D {hud.deaths}</p>}
            <div className="mt-4 space-y-2">
              <button onClick={() => doPause(false)} className="btn-neon font-display w-full rounded-xl px-4 py-3 tracking-widest">▶ RESUME</button>
              <button onClick={restart} className="btn-ghost w-full rounded-xl px-4 py-2.5 font-bold">↻ RESTART</button>
              <div className="grid grid-cols-2 gap-2 pt-1 text-left text-[11px]">
                <label className="font-bold text-slate-400">SENS {settings.sens.toFixed(1)}
                  <input type="range" min={0.3} max={3} step={0.1} value={settings.sens} onChange={(e) => setSettings({ ...settings, sens: Number(e.target.value) })} className="w-full" />
                </label>
                <label className="font-bold text-slate-400">FOV {settings.fov}
                  <input type="range" min={60} max={100} step={1} value={settings.fov} onChange={(e) => setSettings({ ...settings, fov: Number(e.target.value) })} className="w-full" />
                </label>
              </div>
              <p className="text-[10px] text-slate-500">Sensitivity &amp; FOV apply on restart</p>
              <button onClick={() => { if (partyCode) Party.leave(partyCode).catch(() => {}); onExit(); }} className="btn-ghost w-full rounded-xl px-4 py-2.5 font-bold text-red-300">✕ ABANDON RUN</button>
            </div>
          </div>
        </div>
      )}

      {/* game over */}
      {result && (
        <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-black/75 p-4" style={{ zIndex: 50 }}>
          <div className="panel w-full max-w-md rounded-2xl p-6 text-center">
            <div className={`font-display text-4xl font-black tracking-widest ${result.win ? "neon-text text-cyan-300" : "text-red-400"}`}>
              {result.win ? "★ VICTORY ★" : "☠ GAME OVER"}
            </div>
            <p className="mt-1 text-xs tracking-widest text-slate-400">{result.mode.replace("_", " ")} · {fmtTime(result.timeSurvived)} SURVIVED</p>
            <div className="font-display mt-3 text-5xl font-black text-white">{result.score.toLocaleString()}</div>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              {([["KILLS", result.kills], ["DEATHS", result.deaths], ["ACC", `${Math.round((result.shots ? result.hits / result.shots : 0) * 100)}%`], ["WAVE", result.wave || "—"]] as const).map(([k, v]) => (
                <div key={k} className="rounded-lg bg-black/50 p-2"><div className="text-[9px] font-bold tracking-widest text-slate-500">{k}</div><div className="font-display text-lg font-black text-cyan-200">{v}</div></div>
              ))}
            </div>
            {localTop.length > 0 && (
              <div className="mt-3 rounded-xl bg-black/40 p-2 text-left">
                <p className="px-1 text-[10px] font-bold tracking-widest text-yellow-300">🏆 LOCAL TOP 5</p>
                {localTop.slice(0, 5).map((s, i) => (
                  <div key={i} className="flex justify-between px-2 py-0.5 text-xs"><span className={s.score === result.score ? "font-bold text-cyan-300" : "text-slate-300"}>#{i + 1} {s.name} · {s.mode}</span><span className="font-bold text-yellow-300">{s.score.toLocaleString()}</span></div>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={restart} className="btn-neon font-display flex-1 rounded-xl px-4 py-3.5 text-lg tracking-widest">↻ RETRY [R]</button>
              <button onClick={() => { if (partyCode) Party.leave(partyCode).catch(() => {}); onExit(); }} className="btn-ghost flex-1 rounded-xl px-4 py-3.5 font-bold">MENU</button>
            </div>
            {partyCode && <p className="mt-2 text-[11px] text-slate-500">Party key {partyCode} · rejoin from menu to run it back</p>}
          </div>
        </div>
      )}
    </div>
  );
}
