"use client";
import { useEffect, useRef, useState } from "react";
import { Party, myPid, type PartyState } from "@/game/net";
import { ARENAS, MODES } from "@/game/constants";
import type { Loadout } from "@/game/storage";
import { sfx } from "@/game/audio";

interface Props {
  loadout: Loadout;
  setLoadout: (l: Loadout) => void;
  onBack: () => void;
  onDeploy: (code: string, isHost: boolean, info: PartyState) => void;
}

export default function Lobby({ loadout, setLoadout, onBack, onDeploy }: Props) {
  const [tab, setTab] = useState<"create" | "join">("create");
  const [mode, setMode] = useState("SKIRMISH");
  const [arena, setArena] = useState(loadout.arena);
  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [party, setParty] = useState<PartyState | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<number>(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const myCode = party?.party.code ?? "";

  useEffect(() => () => window.clearInterval(pollRef.current), []);

  async function poll(codeStr: string) {
    try {
      const st = await Party.state(codeStr);
      setParty(st);
      // auto-deploy when host starts
      if (st.party.status === "playing" && !starting) {
        setStarting(true);
        window.clearInterval(pollRef.current);
        sfx.wave();
        setTimeout(() => onDeploy(codeStr, st.party.hostId === myPid(), st), 800);
      }
    } catch { /* keep polling */ }
  }
  function beginPoll(codeStr: string) {
    window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(() => poll(codeStr), 1200);
  }

  async function create() {
    setBusy(true); setErr("");
    try {
      sfx.ensure(); sfx.ui();
      const r = await Party.create(loadout.name || "HOST", mode, arena);
      setLoadout({ ...loadout, arena });
      setIsHost(true);
      const st = await Party.state(r.code);
      setParty(st);
      beginPoll(r.code);
    } catch (e) { setErr(e instanceof Error ? e.message : "create failed"); }
    setBusy(false);
  }

  async function join() {
    const c = code.join("");
    if (c.length !== 6) { setErr("Enter all 6 digits"); return; }
    setBusy(true); setErr("");
    try {
      sfx.ensure(); sfx.ui();
      await Party.join(c, loadout.name || "ACE");
      setIsHost(false);
      const st = await Party.state(c);
      setParty(st);
      setLoadout({ ...loadout, arena: st.party.arena || loadout.arena });
      beginPoll(c);
    } catch (e) { setErr(e instanceof Error ? e.message : "join failed"); }
    setBusy(false);
  }

  async function startGame() {
    if (!party) return;
    setBusy(true);
    try {
      await Party.start(party.party.code);
      const st = await Party.state(party.party.code);
      setParty(st);
    } catch (e) { setErr(e instanceof Error ? e.message : "start failed"); }
    setBusy(false);
  }

  async function leave() {
    if (party) { try { await Party.leave(party.party.code); } catch { /* noop */ } }
    window.clearInterval(pollRef.current);
    setParty(null); setIsHost(false); setStarting(false);
  }

  const digit = (i: number, v: string) => {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = [...code]; next[i] = d; setCode(next);
    if (d && i < 5) inputs.current[i + 1]?.focus();
  };

  // ── IN-PARTY VIEW ──
  if (party) {
    const host = party.party.hostId === myPid() || isHost;
    return (
      <div className="menu-bg flex min-h-screen items-center justify-center p-4">
        <div className="panel w-full max-w-lg rounded-2xl p-6 text-center">
          <p className="text-[11px] font-bold tracking-[0.3em] text-slate-400">PARTY KEY — SHARE WITH FRIENDS</p>
          <div className="font-display neon-text mt-2 text-6xl font-black tracking-[0.2em] text-cyan-300">{myCode}</div>
          <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-400">
            <span className="rounded bg-black/50 px-2 py-1">MODE: <b className="text-cyan-300">{party.party.mode}</b></span>
            <span className="rounded bg-black/50 px-2 py-1">ARENA: <b className="text-pink-300">{party.party.arena}</b></span>
            <span className="rounded bg-black/50 px-2 py-1">FIRST TO <b className="text-yellow-300">{party.party.killTarget}</b></span>
          </div>
          <div className="mt-4 rounded-xl bg-black/40 p-3 text-left">
            <p className="mb-2 text-[11px] font-bold tracking-widest text-slate-400">OPERATIVES ({party.players.length}/{party.party.maxPlayers})</p>
            <div className="space-y-1.5">
              {party.players.map((p) => (
                <div key={p.playerId} className="flex items-center justify-between rounded-lg bg-slate-900/70 px-3 py-2 text-sm">
                  <span className="font-bold">{p.playerId === myPid() ? "🫵 " : "🎖 "}{p.name} {p.playerId === party.party.hostId && <span className="ml-1 rounded bg-yellow-400/20 px-1.5 py-0.5 text-[10px] text-yellow-300">HOST</span>}</span>
                  <span className="text-xs text-slate-500">{p.weapon.toUpperCase()}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 animate-pulse text-center text-[11px] text-slate-500">{starting ? "DEPLOYING…" : host ? "Waiting for squad… press START when ready" : "Waiting for host to start…"}</p>
          </div>
          {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={() => { leave(); }} className="btn-ghost flex-1 rounded-xl px-4 py-3 font-bold">LEAVE</button>
            {host && !starting && (
              <button onClick={startGame} disabled={busy} className="btn-neon font-display flex-1 rounded-xl px-4 py-3 tracking-widest disabled:opacity-50">
                {busy ? "…" : "▶ START MATCH"}
              </button>
            )}
          </div>
          <p className="mt-3 text-[11px] text-slate-500">Tip: open this page on another device / tab and join with the key for real PvP.</p>
        </div>
      </div>
    );
  }

  // ── CREATE / JOIN ──
  return (
    <div className="menu-bg flex min-h-screen items-center justify-center p-4">
      <div className="panel w-full max-w-lg rounded-2xl p-6">
        <button onClick={onBack} className="text-xs font-bold tracking-widest text-slate-400 hover:text-cyan-300">← BACK</button>
        <h1 className="font-display neon-text mt-1 text-3xl font-black text-cyan-300">PARTY PLAY</h1>
        <p className="text-xs text-slate-400">Squad up with a 6-digit key. Real-time PvP deathmatch.</p>
        <label className="mt-4 block text-[11px] font-bold tracking-widest text-slate-400">CALLSIGN</label>
        <input value={loadout.name} onChange={(e) => setLoadout({ ...loadout, name: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 12) || "ACE" })}
          className="font-display mt-1 w-full rounded-lg border border-slate-600 bg-black/50 px-3 py-2.5 font-bold tracking-widest text-cyan-200" maxLength={12} />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => { setTab("create"); sfx.ui(); }} className={`rounded-xl px-4 py-2.5 font-bold ${tab === "create" ? "btn-neon" : "btn-ghost"}`}>HOST PARTY</button>
          <button onClick={() => { setTab("join"); sfx.ui(); }} className={`rounded-xl px-4 py-2.5 font-bold ${tab === "join" ? "btn-pink" : "btn-ghost"}`}>JOIN PARTY</button>
        </div>
        {tab === "create" ? (
          <div className="mt-4">
            <label className="text-[11px] font-bold tracking-widest text-slate-400">MATCH MODE</label>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {MODES.filter((m) => ["SKIRMISH", "SNIPER_NEST", "SURVIVAL"].includes(m.id)).map((m) => (
                <button key={m.id} onClick={() => setMode(m.id)} className={`rounded-lg border p-2 text-left ${mode === m.id ? "border-cyan-400 bg-cyan-400/10" : "border-slate-700"}`}>
                  <div className="text-lg">{m.icon}</div>
                  <div className="text-[11px] font-bold">{m.name}</div>
                </button>
              ))}
            </div>
            <label className="mt-3 block text-[11px] font-bold tracking-widest text-slate-400">ARENA</label>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {ARENAS.map((a) => (
                <button key={a.id} onClick={() => setArena(a.id)} className={`rounded-lg border p-2 text-left ${arena === a.id ? "border-pink-400 bg-pink-400/10" : "border-slate-700"}`}>
                  <div className="h-6 rounded" style={{ background: `linear-gradient(135deg, #${a.sky.toString(16).padStart(6, "0")}, #${a.grid.toString(16).padStart(6, "0")})` }} />
                  <div className="mt-1 text-[11px] font-bold">{a.name}</div>
                </button>
              ))}
            </div>
            <button onClick={create} disabled={busy} className="btn-neon font-display mt-4 w-full rounded-xl px-4 py-3.5 text-lg tracking-widest disabled:opacity-50">
              {busy ? "GENERATING KEY…" : "⚡ GENERATE 6-DIGIT KEY"}
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <label className="text-[11px] font-bold tracking-widest text-slate-400">ENTER 6-DIGIT PARTY KEY</label>
            <div className="mt-2 flex justify-center gap-2">
              {code.map((d, i) => (
                <input key={i} ref={(el) => { inputs.current[i] = el; }} value={d}
                  onChange={(e) => digit(i, e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Backspace" && !code[i] && i > 0) inputs.current[i - 1]?.focus(); if (e.key === "Enter") join(); }}
                  className="code-digit" inputMode="numeric" maxLength={1} />
              ))}
            </div>
            <button onClick={join} disabled={busy} className="btn-pink font-display mt-4 w-full rounded-xl px-4 py-3.5 text-lg tracking-widest disabled:opacity-50">
              {busy ? "JOINING…" : "➤ JOIN PARTY"}
            </button>
          </div>
        )}
        {err && <p className="mt-3 text-center text-sm text-red-400">{err}</p>}
      </div>
    </div>
  );
}
