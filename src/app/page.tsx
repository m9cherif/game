"use client";
import { useCallback, useEffect, useState } from "react";
import Menu from "@/components/Menu";
import Lobby from "@/components/Lobby";
import GameView from "@/components/GameView";
import type { GameModeId } from "@/game/constants";
import { getLoadout, getScores, getSettings, saveLoadout, saveSettings, type Loadout, type LocalScore, type Settings } from "@/game/storage";
import type { PartyState } from "@/game/net";
import { sfx } from "@/game/audio";

type Screen = "menu" | "lobby" | "game";

export default function HomePage() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [mode, setMode] = useState<GameModeId>("SKIRMISH");
  const [loadout, setLoadoutState] = useState<Loadout>({ weapon: "rifle", weapon2: "rail", gunSkin: "cyan", suitSkin: "suit_cyan", crosshair: "cross", arena: "NEON_VOID", name: "ACE" });
  const [settings, setSettingsState] = useState<Settings>({ sens: 1, fov: 78, shake: true, particles: true, muted: false, quality: "auto" });
  const [scores, setScores] = useState<LocalScore[]>([]);
  const [globalScores, setGlobalScores] = useState<{ name: string; mode: string; score: number; kills: number }[]>([]);
  const [partyCode, setPartyCode] = useState<string | null>(null);
  const [partyInfo, setPartyInfo] = useState<PartyState | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLoadoutState(getLoadout());
    setSettings(getSettings());
    setScores(getScores());
    setIsMobile("ontouchstart" in window || navigator.maxTouchPoints > 0);
    setReady(true);
    fetch("/api/scores").then((r) => r.json()).then((j) => {
      if (Array.isArray((j as { scores?: unknown }).scores)) setGlobalScores((j as { scores: { name: string; mode: string; score: number; kills: number }[] }).scores);
    }).catch(() => {});
    sfx.setMuted(getSettings().muted);
  }, []);

  const setLoadout = useCallback((l: Loadout) => { setLoadoutState(l); saveLoadout(l); }, []);
  const setSettings = useCallback((s: Settings) => { setSettingsState(s); saveSettings(s); sfx.setMuted(s.muted); }, []);

  const play = useCallback(() => {
    sfx.ensure(); sfx.ui(); sfx.startMusic();
    setTimeout(() => sfx.stopMusic(), 500);
    setPartyCode(null); setPartyInfo(null);
    setScreen("game");
  }, []);

  const deployParty = useCallback((code: string, _isHost: boolean, info: PartyState) => {
    setPartyCode(code);
    setPartyInfo(info);
    const m = (info.party.mode as GameModeId) || "SKIRMISH";
    setMode(m === "PARTY_PVP" ? "SKIRMISH" : m);
    setScreen("game");
  }, []);

  const exitGame = useCallback(() => {
    setScores(getScores());
    fetch("/api/scores").then((r) => r.json()).then((j) => {
      if (Array.isArray((j as { scores?: unknown }).scores)) setGlobalScores((j as { scores: { name: string; mode: string; score: number; kills: number }[] }).scores);
    }).catch(() => {});
    setScreen("menu");
  }, []);

  if (!ready) return <div className="menu-bg flex min-h-screen items-center justify-center"><div className="font-display animate-pulse text-2xl font-black tracking-widest text-cyan-300">LOADING NEON STRIKE…</div></div>;

  if (screen === "lobby") {
    return <Lobby loadout={loadout} setLoadout={setLoadout} onBack={() => setScreen("menu")} onDeploy={deployParty} />;
  }
  if (screen === "game") {
    return (
      <GameView
        key={`${mode}-${partyCode ?? "solo"}`}
        mode={partyCode ? "PARTY_PVP" : mode}
        loadout={partyInfo ? { ...loadout, arena: partyInfo.party.arena || loadout.arena } : loadout}
        settings={settings}
        setSettings={setSettings}
        partyCode={partyCode}
        onExit={exitGame}
        isMobile={isMobile}
      />
    );
  }
  return (
    <Menu
      mode={mode} setMode={(m) => { sfx.ensure(); sfx.ui(); setMode(m); }}
      loadout={loadout} setLoadout={setLoadout}
      settings={settings} setSettings={setSettings}
      scores={scores} globalScores={globalScores}
      onPlay={play}
      onMultiplayer={() => { sfx.ensure(); sfx.ui(); setScreen("lobby"); }}
      isMobile={isMobile}
    />
  );
}
