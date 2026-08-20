import { hasAccess, tryUnlock } from "./access-gate.js";
import {
  setPlayerName,
  getPlayerName,
  clearPlayerName,
  getHighScore,
  saveScore,
} from "./player.js";
import { createCricketGame } from "./game.js";
import { reportStats } from "./collect.js";

const screens = {
  access: document.getElementById("screen-access"),
  disclaimer: document.getElementById("screen-disclaimer"),
  name: document.getElementById("screen-name"),
  menu: document.getElementById("screen-menu"),
  game: document.getElementById("screen-game"),
  gameover: document.getElementById("screen-gameover"),
};

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

let activeGame = null;

const DISCLAIMER_KEY = "cricket_disclaimer_ack";
const STATS_CONSENT_KEY = "cricket_stats_consent";

// ---- Access gate ------------------------------------------------------
document.getElementById("form-access").addEventListener("submit", (e) => {
  e.preventDefault();
  const code = document.getElementById("access-code").value;
  const errEl = document.getElementById("access-error");
  if (tryUnlock(code)) {
    errEl.textContent = "";
    afterAccessGranted();
  } else {
    errEl.textContent = "Incorrect access code.";
  }
});

function afterAccessGranted() {
  if (!localStorage.getItem(DISCLAIMER_KEY)) {
    showScreen("disclaimer");
    return;
  }
  afterDisclaimerAck();
}

document.getElementById("btn-disclaimer-ok").addEventListener("click", () => {
  localStorage.setItem(DISCLAIMER_KEY, "true");
  const consented = document.getElementById("stats-consent").checked;
  localStorage.setItem(STATS_CONSENT_KEY, consented ? "true" : "false");
  afterDisclaimerAck();
});

function afterDisclaimerAck() {
  const name = getPlayerName();
  if (name) {
    goToMenu();
  } else {
    showScreen("name");
  }
}

// ---- Name entry ------------------------------------------------------
document.getElementById("form-name").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("player-name").value;
  const result = setPlayerName(name);
  const errEl = document.getElementById("name-error");
  if (result.ok) {
    errEl.textContent = "";
    goToMenu();
  } else {
    errEl.textContent = result.error;
  }
});

// ---- Menu -----------------------------------------------------------------
function goToMenu() {
  const name = getPlayerName();
  document.getElementById("menu-welcome").textContent = `Welcome, ${name}`;
  document.getElementById("menu-highscore").textContent = getHighScore();
  showScreen("menu");
}

document.getElementById("btn-play").addEventListener("click", startGame);
document.getElementById("btn-play-again").addEventListener("click", startGame);
document.getElementById("btn-menu").addEventListener("click", goToMenu);

document.getElementById("btn-change-name").addEventListener("click", () => {
  clearPlayerName();
  showScreen("name");
});

// ---- Game ---------------------------------------------------------------
function startGame() {
  showScreen("game");
  document.getElementById("hud-message").textContent = "";
  document.getElementById("pause-overlay").classList.remove("active");
  const container = document.getElementById("canvas-container");
  container.innerHTML = "";

  try {
    activeGame = createCricketGame(container, {
      onUpdate({ runs, wickets, oversText, message }) {
        document.getElementById("hud-score").textContent = `${runs} / ${wickets}`;
        document.getElementById("hud-overs").textContent = `Over ${oversText}`;
        document.getElementById("hud-message").textContent = message;
        if (message) {
          clearTimeout(startGame._msgTimer);
          startGame._msgTimer = setTimeout(() => {
            document.getElementById("hud-message").textContent = "";
          }, 1100);
        }
      },
      onGameOver({ runs, wickets, balls }) {
        const { highScore, isNewHighScore } = saveScore(runs, wickets, balls);
        document.getElementById("final-score").textContent = runs;
        document.getElementById("final-highscore-note").textContent = isNewHighScore
          ? "New personal best!"
          : `Personal best: ${highScore} runs`;
        if (activeGame) { activeGame.dispose(); activeGame = null; }
        showScreen("gameover");

        if (localStorage.getItem(STATS_CONSENT_KEY) === "true") {
          reportStats({ name: getPlayerName(), runs, wickets, balls });
        }
      },
    });
  } catch (err) {
    console.error("Failed to start the game:", err);
    document.getElementById("hud-message").textContent = `Failed to load 3D scene: ${err.message}`;
  }
}

// ---- Pause / restart / quit -----------------------------------------------
document.getElementById("btn-pause").addEventListener("click", () => {
  if (!activeGame) return;
  activeGame.pause();
  document.getElementById("pause-overlay").classList.add("active");
});

document.getElementById("btn-resume").addEventListener("click", () => {
  document.getElementById("pause-overlay").classList.remove("active");
  if (activeGame) activeGame.resume();
});

document.getElementById("btn-restart").addEventListener("click", () => {
  document.getElementById("pause-overlay").classList.remove("active");
  if (activeGame) { activeGame.dispose(); activeGame = null; }
  startGame();
});

document.getElementById("btn-quit").addEventListener("click", () => {
  document.getElementById("pause-overlay").classList.remove("active");
  if (activeGame) { activeGame.dispose(); activeGame = null; }
  goToMenu();
});

// ---- Boot -----------------------------------------------------------------
if (hasAccess()) {
  afterAccessGranted();
} else {
  showScreen("access");
}
