import { hasAccess, tryUnlock } from "./access-gate.js";
import {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUserName,
  getHighScore,
  saveScore,
} from "./auth.js";
import { createCricketGame } from "./game.js";

const screens = {
  access: document.getElementById("screen-access"),
  auth: document.getElementById("screen-auth"),
  menu: document.getElementById("screen-menu"),
  game: document.getElementById("screen-game"),
  gameover: document.getElementById("screen-gameover"),
};

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

let activeGame = null;
let lastResult = null;

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
  const name = getCurrentUserName();
  if (name) {
    goToMenu();
  } else {
    showScreen("auth");
  }
}

// ---- Auth tabs ----------------------------------------------------------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`form-${btn.dataset.tab}`).classList.add("active");
    document.getElementById("auth-error").textContent = "";
  });
});

document.getElementById("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("login-name").value;
  const password = document.getElementById("login-password").value;
  const result = await loginUser(name, password);
  const errEl = document.getElementById("auth-error");
  if (result.ok) {
    errEl.textContent = "";
    goToMenu();
  } else {
    errEl.textContent = result.error;
  }
});

document.getElementById("form-register").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("register-name").value;
  const password = document.getElementById("register-password").value;
  const result = await registerUser(name, password);
  const errEl = document.getElementById("auth-error");
  if (result.ok) {
    errEl.textContent = "";
    goToMenu();
  } else {
    errEl.textContent = result.error;
  }
});

// ---- Menu -----------------------------------------------------------------
async function goToMenu() {
  const name = getCurrentUserName();
  document.getElementById("menu-welcome").textContent = `Welcome, ${name}`;
  document.getElementById("menu-highscore").textContent = await getHighScore();
  showScreen("menu");
}

document.getElementById("btn-play").addEventListener("click", startGame);
document.getElementById("btn-play-again").addEventListener("click", startGame);
document.getElementById("btn-menu").addEventListener("click", goToMenu);

document.getElementById("btn-logout").addEventListener("click", async () => {
  await logoutUser();
  showScreen("auth");
});

// ---- Game ---------------------------------------------------------------
function startGame() {
  showScreen("game");
  document.getElementById("hud-message").textContent = "";
  const container = document.getElementById("canvas-container");
  container.innerHTML = "";

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
    async onGameOver({ runs, wickets, balls }) {
      lastResult = { runs, wickets, balls };
      const { highScore, isNewHighScore } = await saveScore(runs, wickets, balls);
      document.getElementById("final-score").textContent = runs;
      document.getElementById("final-highscore-note").textContent = isNewHighScore
        ? "New personal best!"
        : `Personal best: ${highScore} runs`;
      if (activeGame) { activeGame.dispose(); activeGame = null; }
      showScreen("gameover");
    },
  });
}

// ---- Boot -----------------------------------------------------------------
if (hasAccess()) {
  afterAccessGranted();
} else {
  showScreen("access");
}
