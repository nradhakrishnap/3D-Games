// No accounts, no passwords -- just a display name, stored locally on this device.
// Swap this out for a shared backend later if a cross-device leaderboard is wanted.

const NAME_KEY = "cricket_player_name";
const SCORES_KEY = "cricket_scores";

function sanitize(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
}

function readScores() {
  return JSON.parse(localStorage.getItem(SCORES_KEY) || "{}");
}
function writeScores(scores) {
  localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
}

export function setPlayerName(name) {
  name = name.trim();
  if (!name) return { ok: false, error: "Please enter a name." };
  localStorage.setItem(NAME_KEY, name);
  const scores = readScores();
  const key = sanitize(name);
  if (!scores[key]) {
    scores[key] = { name, highScore: 0, history: [] };
    writeScores(scores);
  }
  return { ok: true };
}

export function getPlayerName() {
  return localStorage.getItem(NAME_KEY);
}

export function clearPlayerName() {
  localStorage.removeItem(NAME_KEY);
}

export function getHighScore() {
  const name = getPlayerName();
  if (!name) return 0;
  const scores = readScores();
  return scores[sanitize(name)]?.highScore || 0;
}

export function saveScore(runs, wickets, balls) {
  const name = getPlayerName();
  const scores = readScores();
  const key = sanitize(name);
  const entry = { runs, wickets, balls, playedAt: new Date().toISOString() };
  const player = scores[key] || { name, highScore: 0, history: [] };
  const wasHigh = runs > (player.highScore || 0);
  player.highScore = Math.max(player.highScore || 0, runs);
  player.history = [...(player.history || []), entry].slice(-20);
  scores[key] = player;
  writeScores(scores);
  return { highScore: player.highScore, isNewHighScore: wasHigh };
}
