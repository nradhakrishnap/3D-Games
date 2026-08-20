// Sends opt-in testing stats to a Google Sheet via an Apps Script Web App.
// Only ever called if the player checked the consent box on the disclaimer
// screen -- see js/main.js. Best-effort: never blocks or breaks gameplay.

import { COLLECT_ENDPOINT } from "./collect-config.js";

async function getApproxRegion() {
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) return null;
    const data = await res.json();
    return {
      ip: data.ip || null,
      city: data.city || null,
      region: data.region || null,
      country: data.country_name || null,
    };
  } catch {
    return null;
  }
}

function getConnectionInfo() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!c) return null;
  return {
    effectiveType: c.effectiveType || null,
    downlinkMbps: typeof c.downlink === "number" ? c.downlink : null,
  };
}

export async function reportStats({ name, runs, wickets, balls }) {
  if (!COLLECT_ENDPOINT) return; // not configured -- silently skip

  const [geo, connection] = await Promise.all([
    getApproxRegion(),
    Promise.resolve(getConnectionInfo()),
  ]);

  const payload = {
    name,
    runs,
    wickets,
    balls,
    ip: geo?.ip ?? null,
    city: geo?.city ?? null,
    region: geo?.region ?? null,
    country: geo?.country ?? null,
    connectionType: connection?.effectiveType ?? null,
    downlinkMbps: connection?.downlinkMbps ?? null,
    playedAt: new Date().toISOString(),
  };

  try {
    // Apps Script Web Apps don't handle CORS preflight for JSON content-type,
    // so this uses text/plain + no-cors -- a fire-and-forget write, no response read.
    await fetch(COLLECT_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(payload),
    });
  } catch {
    // best-effort only
  }
}
