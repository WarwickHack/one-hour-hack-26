// Shared lake: other ducks' positions + targeted whack() sabotage over Supabase Realtime (broadcast + presence).
// The publishable key is meant to be public; every table in the project is behind RLS.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://cboagmijxemneilhcdjr.supabase.co";
const SUPABASE_KEY = "sb_publishable_InKdUfM_MeZD8l6sOOISsw_KvfWaY1L";

export function connect({ id, name, onPos, onLeave, onWhacked, onResult }) {
  const peers = new Map();
  let channel = null;
  try {
    const client = createClient(SUPABASE_URL, SUPABASE_KEY);
    channel = client.channel("quack-lake", { config: { presence: { key: id }, broadcast: { self: false } } });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        for (const key of [...peers.keys()]) if (!state[key]) { peers.delete(key); onLeave(key); }
        for (const [key, metas] of Object.entries(state)) if (key !== id) peers.set(key, metas[0]?.name || "duck");
      })
      .on("broadcast", { event: "pos" }, ({ payload }) => onPos(payload))
      .on("broadcast", { event: "whack" }, ({ payload }) => { if (payload.to === id) onWhacked(payload); })
      .on("broadcast", { event: "result" }, ({ payload }) => { if (payload.to === id) onResult(payload); })
      .subscribe((status) => { if (status === "SUBSCRIBED") channel.track({ name }); });
  } catch (err) {
    console.warn("multiplayer offline", err);
  }

  return {
    peers,
    sendPos(pos) { channel?.send({ type: "broadcast", event: "pos", payload: { id, name, ...pos } }); },
    sendWhack(words, isTargetable) {
      const ids = [...peers.keys()].filter(isTargetable);
      if (!channel || !ids.length) return null;
      const to = ids[Math.floor(Math.random() * ids.length)];
      channel.send({ type: "broadcast", event: "whack", payload: { from: name, fromId: id, to, words } });
      return peers.get(to);
    },
    sendResult(to, result) { channel?.send({ type: "broadcast", event: "result", payload: { to, victim: name, ...result } }); },
    rename(newName) { name = newName; channel?.track({ name }); },
  };
}
