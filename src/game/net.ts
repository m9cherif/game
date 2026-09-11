export interface PartyState {
  party: { code: string; hostName: string; hostId: string; mode: string; arena: string; status: string; maxPlayers: number; killTarget: number; timeLimit: number };
  players: { playerId: string; name: string; skin: string; weapon: string; x: number; y: number; z: number; rotY: number; pitch: number; health: number; score: number; kills: number; deaths: number; alive: number; updatedAt: string }[];
  events: { id: number; fromId: string; type: string; payload: Record<string, unknown>; createdAt: string }[];
}

export async function api<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j as { error?: string }).error || `request failed: ${res.status}`);
  return j as T;
}

export const Party = {
  create: (hostName: string, mode: string, arena: string) =>
    api<{ code: string; playerId: string }>("/api/party/create", { hostName, mode, arena, playerId: pid() }),
  join: (code: string, name: string) =>
    api<{ ok: boolean; playerId: string }>("/api/party/join", { code, name, playerId: pid() }),
  state: (code: string, since = 0) =>
    api<PartyState>(`/api/party/state?code=${encodeURIComponent(code)}&since=${since}&pid=${encodeURIComponent(pid())}`),
  update: (code: string, u: Record<string, unknown>) =>
    api<{ ok: boolean }>("/api/party/update", { code, playerId: pid(), ...u }),
  event: (code: string, type: string, payload: Record<string, unknown>) =>
    api<{ ok: boolean }>("/api/party/event", { code, playerId: pid(), type, payload }),
  start: (code: string) =>
    api<{ ok: boolean }>("/api/party/start", { code, playerId: pid() }),
  leave: (code: string) =>
    api<{ ok: boolean }>("/api/party/leave", { code, playerId: pid() }),
};

function pid(): string {
  try {
    let id = localStorage.getItem("neonstrike_pid") ?? "";
    if (!id) { id = "p_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem("neonstrike_pid", id); }
    return id;
  } catch { return "p_" + Math.random().toString(36).slice(2, 10); }
}
export function myPid() { return pid(); }
