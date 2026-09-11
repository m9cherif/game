"use client";
import { MODES, WEAPONS, WEAPON_LIST, GUN_SKINS, SUIT_SKINS, ARENAS, CROSSHAIRS, type GameModeId } from "@/game/constants";
import type { Loadout, Settings } from "@/game/storage";
import type { LocalScore } from "@/game/storage";

interface Props {
  mode: GameModeId;
  setMode: (m: GameModeId) => void;
  loadout: Loadout;
  setLoadout: (l: Loadout) => void;
  settings: Settings;
  setSettings: (s: Settings) => void;
  scores: LocalScore[];
  globalScores: { name: string; mode: string; score: number; kills: number }[];
  onPlay: () => void;
  onMultiplayer: () => void;
  isMobile: boolean;
}

export default function Menu({ mode, setMode, loadout, setLoadout, settings, setSettings, scores, globalScores, onPlay, onMultiplayer, isMobile }: Props) {
  const sel = MODES.find((m) => m.id === mode)!;
  return (
    <div className="menu-bg scanlines relative min-h-screen w-full overflow-hidden">
      <div className="grid-bg absolute inset-0" />
      {/* top marquee */}
      <div className="relative z-10 overflow-hidden border-b border-cyan-500/20 bg-black/40 py-1.5">
        <div className="marquee flex w-max gap-8 whitespace-nowrap text-[11px] font-bold tracking-[0.2em] text-cyan-300/80">
          {Array.from({ length: 2 }).map((_, k) => (
            <span key={k}>6 GAME MODES ◆ 6 WEAPONS ◆ 14 SKINS ◆ 3 ARENAS ◆ PARTY MULTIPLAYER ◆ 100% PROCEDURAL 3D ◆ 60 FPS ◆ 6 GAME MODES ◆ 6 WEAPONS ◆ 14 SKINS ◆ 3 ARENAS ◆ PARTY MULTIPLAYER ◆ 100% PROCEDURAL 3D ◆ 60 FPS ◆&nbsp;</span>
          ))}
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-6">
        {/* HERO */}
        <div className="text-center">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-1 text-[11px] font-bold tracking-[0.25em] text-fuchsia-300">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-fuchsia-400" /> SEASON 01 — NEON PROTOCOL
          </div>
          <h1 className="font-display title-glitch text-5xl font-black leading-none sm:text-7xl">
            <span className="neon-text text-cyan-300">NEON</span> <span className="neon-pink text-pink-400">STRIKE</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400 sm:text-base">
            Hand-built procedural FPS. No downloaded models — every gun, bot &amp; arena is generated in code.
            Jump in, shoot fast, chase the high score.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button onClick={onPlay} className="btn-neon font-display rounded-xl px-10 py-4 text-xl tracking-widest">
              ▶ DEPLOY
            </button>
            <button onClick={onMultiplayer} className="btn-pink font-display rounded-xl px-8 py-4 text-lg tracking-widest">
              ⚡ PARTY PLAY
            </button>
          </div>
          <p className="mt-2 text-[11px] tracking-widest text-slate-500">{isMobile ? "TOUCH READY — LEFT STICK MOVE · DRAG RIGHT TO AIM · FIRE BUTTON" : "WASD MOVE · MOUSE AIM · CLICK SHOOT · SHIFT SPRINT · SPACE JUMP · R RELOAD · Q SWAP"}</p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {/* MODES */}
          <div className="panel rounded-2xl p-4 lg:col-span-2">
            <h2 className="font-display mb-3 text-sm font-bold tracking-[0.2em] text-cyan-300">◈ SELECT MODE</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`card-sel rounded-xl bg-slate-900/60 p-3 text-left ${mode === m.id ? "active" : "border border-slate-700/50"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl">{m.icon}</span>
                    <span className="rounded bg-black/50 px-2 py-0.5 text-[10px] font-bold tracking-widest" style={{ color: m.color }}>{m.tag}</span>
                  </div>
                  <div className="font-display mt-1 font-bold tracking-wider" style={{ color: m.color }}>{m.name}</div>
                  <div className="mt-0.5 text-xs text-slate-400">{m.desc}</div>
                </button>
              ))}
            </div>
            {/* ARENAS */}
            <h2 className="font-display mb-2 mt-4 text-sm font-bold tracking-[0.2em] text-cyan-300">◈ ARENA</h2>
            <div className="grid grid-cols-3 gap-2">
              {ARENAS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setLoadout({ ...loadout, arena: a.id })}
                  className={`card-sel rounded-xl p-2.5 text-left ${loadout.arena === a.id ? "active" : "border border-slate-700/50 bg-slate-900/60"}`}
                >
                  <div className="h-10 rounded-lg" style={{ background: `linear-gradient(135deg, #${a.sky.toString(16).padStart(6, "0")}, #${a.grid.toString(16).padStart(6, "0")})` }} />
                  <div className="font-display mt-1 text-xs font-bold">{a.name}</div>
                  <div className="text-[10px] text-slate-500">{a.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* LOADOUT */}
          <div className="panel rounded-2xl p-4">
            <h2 className="font-display mb-3 text-sm font-bold tracking-[0.2em] text-pink-300">◈ LOADOUT</h2>
            <label className="text-[11px] font-bold tracking-widest text-slate-400">CALLSIGN</label>
            <input
              value={loadout.name}
              onChange={(e) => setLoadout({ ...loadout, name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 12) || "ACE" })}
              className="font-display mt-1 w-full rounded-lg border border-slate-600 bg-black/50 px-3 py-2 font-bold tracking-widest text-cyan-200"
              maxLength={12}
            />
            <label className="mt-3 block text-[11px] font-bold tracking-widest text-slate-400">PRIMARY + SECONDARY</label>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {WEAPON_LIST.map((w) => {
                const isP = loadout.weapon === w.id;
                const isS = loadout.weapon2 === w.id;
                return (
                  <button
                    key={w.id}
                    onClick={() => {
                      if (isP) return;
                      // tap: set as primary, push old primary to secondary
                      setLoadout({ ...loadout, weapon2: loadout.weapon, weapon: w.id });
                    }}
                    onContextMenu={(e) => { e.preventDefault(); if (!isS) setLoadout({ ...loadout, weapon2: w.id }); }}
                    title={`${w.name} — ${w.desc} (right-click = secondary)`}
                    className={`rounded-lg border p-1.5 text-left text-[11px] font-bold ${isP ? "border-cyan-400 bg-cyan-400/15 text-cyan-200" : isS ? "border-pink-400/70 bg-pink-400/10 text-pink-200" : "border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-500"}`}
                  >
                    <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: `#${w.color.toString(16).padStart(6, "0")}` }} />
                    {w.short} {isP ? "★" : isS ? "☆" : ""}
                  </button>
                );
              })}
            </div>
            <div className="mt-1 rounded-lg bg-black/40 p-2 text-[11px] text-slate-300">
              <span className="font-bold text-cyan-300">{WEAPONS[loadout.weapon as keyof typeof WEAPONS]?.name}</span>
              {" — "}{WEAPONS[loadout.weapon as keyof typeof WEAPONS]?.desc}
            </div>
            <label className="mt-3 block text-[11px] font-bold tracking-widest text-slate-400">GUN SKIN</label>
            <div className="mt-1 grid grid-cols-4 gap-1.5">
              {GUN_SKINS.map((s) => (
                <button key={s.id} onClick={() => setLoadout({ ...loadout, gunSkin: s.id })} title={s.name}
                  className={`rounded-lg border-2 p-1 ${loadout.gunSkin === s.id ? "border-white" : "border-transparent"}`}>
                  <div className="h-6 rounded" style={{ background: `linear-gradient(135deg, #${s.primary.toString(16).padStart(6, "0")}, #${s.secondary.toString(16).padStart(6, "0")})` }} />
                </button>
              ))}
            </div>
            <label className="mt-3 block text-[11px] font-bold tracking-widest text-slate-400">SUIT SKIN (MULTIPLAYER)</label>
            <div className="mt-1 grid grid-cols-6 gap-1.5">
              {SUIT_SKINS.map((s) => (
                <button key={s.id} onClick={() => setLoadout({ ...loadout, suitSkin: s.id })} title={s.name}
                  className={`rounded-lg border-2 p-0.5 ${loadout.suitSkin === s.id ? "border-white" : "border-transparent"}`}>
                  <div className="h-6 rounded" style={{ background: `#${s.primary.toString(16).padStart(6, "0")}` }} />
                </button>
              ))}
            </div>
            <label className="mt-3 block text-[11px] font-bold tracking-widest text-slate-400">CROSSHAIR</label>
            <div className="mt-1 flex gap-1.5">
              {CROSSHAIRS.map((c) => (
                <button key={c.id} onClick={() => setLoadout({ ...loadout, crosshair: c.id })}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold ${loadout.crosshair === c.id ? "border-cyan-400 bg-cyan-400/15 text-cyan-200" : "border-slate-700 text-slate-400"}`}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {/* SCORES */}
          <div className="panel rounded-2xl p-4">
            <h2 className="font-display mb-2 text-sm font-bold tracking-[0.2em] text-yellow-300">🏆 LOCAL LEGENDS</h2>
            {scores.length === 0 ? <p className="text-xs text-slate-500">No scores yet. Be the first legend.</p> : (
              <ol className="space-y-1">
                {scores.slice(0, 5).map((s, i) => (
                  <li key={i} className="flex items-center justify-between rounded bg-black/40 px-2 py-1 text-xs">
                    <span className="font-bold text-slate-200">#{i + 1} {s.name} <span className="text-slate-500">· {s.mode}</span></span>
                    <span className="font-display font-bold text-yellow-300">{s.score.toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            )}
            <h2 className="font-display mb-2 mt-4 text-sm font-bold tracking-[0.2em] text-cyan-300">🌐 GLOBAL TOP</h2>
            {globalScores.length === 0 ? <p className="text-xs text-slate-500">Global board warming up…</p> : (
              <ol className="space-y-1">
                {globalScores.slice(0, 5).map((s, i) => (
                  <li key={i} className="flex items-center justify-between rounded bg-black/40 px-2 py-1 text-xs">
                    <span className="font-bold text-slate-200">#{i + 1} {s.name} <span className="text-slate-500">· {s.mode}</span></span>
                    <span className="font-display font-bold text-cyan-300">{s.score.toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          {/* SETTINGS */}
          <div className="panel rounded-2xl p-4">
            <h2 className="font-display mb-2 text-sm font-bold tracking-[0.2em] text-slate-300">⚙ SETTINGS</h2>
            <div className="space-y-3 text-xs">
              <div>
                <div className="mb-1 flex justify-between"><span className="font-bold text-slate-400">SENSITIVITY</span><span className="text-cyan-300">{settings.sens.toFixed(1)}</span></div>
                <input type="range" min={0.3} max={3} step={0.1} value={settings.sens} onChange={(e) => setSettings({ ...settings, sens: Number(e.target.value) })} className="w-full" />
              </div>
              <div>
                <div className="mb-1 flex justify-between"><span className="font-bold text-slate-400">FIELD OF VIEW</span><span className="text-cyan-300">{settings.fov}</span></div>
                <input type="range" min={60} max={100} step={1} value={settings.fov} onChange={(e) => setSettings({ ...settings, fov: Number(e.target.value) })} className="w-full" />
              </div>
              <div className="flex flex-wrap gap-2">
                {([["shake", "SHAKE"], ["particles", "PARTICLES"], ["muted", "MUTE"]] as const).map(([k, label]) => (
                  <button key={k} onClick={() => setSettings({ ...settings, [k]: !settings[k] })}
                    className={`rounded-lg border px-3 py-1.5 font-bold ${settings[k] ? "border-cyan-400 bg-cyan-400/15 text-cyan-200" : "border-slate-700 text-slate-500"}`}>
                    {label}: {settings[k] ? "ON" : "OFF"}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3 text-[11px] text-slate-400">
              <span className="font-bold text-cyan-300">MODE BRIEF — {sel.name}:</span> {sel.desc} {sel.timeLimit ? `⏱ ${Math.floor(sel.timeLimit / 60)}:${String(sel.timeLimit % 60).padStart(2, "0")} limit.` : "Endless."} {sel.killTarget ? `First to ${sel.killTarget}.` : ""}
            </div>
          </div>
          {/* HOW TO */}
          <div className="panel rounded-2xl p-4">
            <h2 className="font-display mb-2 text-sm font-bold tracking-[0.2em] text-fuchsia-300">✦ FIELD MANUAL</h2>
            <ul className="space-y-1.5 text-xs text-slate-300">
              <li>🎯 <b>Headshots ×2 damage</b> — aim for the visor.</li>
              <li>🔥 <b>Streaks multiply score</b> — don&apos;t get hit.</li>
              <li>💚 <b>HP regenerates</b> after 5s out of fire.</li>
              <li>🔭 <b>Rail Sniper:</b> hold RMB to scope (3.2×).</li>
              <li>💥 <b>Thumper:</b> arcs &amp; booms — mind the splash.</li>
              <li>⚔️ <b>Arc Blade:</b> infinite ammo, 4m lunge range.</li>
              <li>👥 <b>Party:</b> host creates a 6-digit key, friends join.</li>
              <li>⏸ <b>ESC / P</b> pause · <b>R</b> instant restart on game over.</li>
            </ul>
            <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[10px] font-bold">
              <div className="rounded bg-black/40 p-2"><div className="text-lg">🖱️</div>CLICK<br />SHOOT</div>
              <div className="rounded bg-black/40 p-2"><div className="text-lg">⚡</div>SHIFT<br />SPRINT</div>
              <div className="rounded bg-black/40 p-2"><div className="text-lg">🦘</div>SPACE<br />JUMP</div>
            </div>
          </div>
        </div>
        <p className="mt-6 text-center text-[11px] text-slate-600">NEON STRIKE · every mesh procedural · sounds synthesized · runs at 60fps on potato hardware</p>
      </div>
    </div>
  );
}
