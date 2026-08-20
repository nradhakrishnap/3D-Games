// Simple shared access code so you can hand out one code to everyone you invite.
// This is NOT strong security -- it just keeps casual visitors out.
// Change this before sharing the game, and again any time you want to revoke access.
export const ACCESS_CODE = "CRICKET2026";

const SESSION_KEY = "cricket_access_granted";

export function hasAccess() {
  return sessionStorage.getItem(SESSION_KEY) === "true";
}

export function tryUnlock(code) {
  if (code === ACCESS_CODE) {
    sessionStorage.setItem(SESSION_KEY, "true");
    return true;
  }
  return false;
}
