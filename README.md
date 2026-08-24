# 3D Cricket

A browser-based 3D cricket batting game (Three.js), gated by a shared access code. Players just enter a name to play -- no account or password.

## Play it locally

No build step, no install. Just serve the folder over HTTP (opening `index.html` directly as a `file://` URL will not work — ES modules require a server):

```
# Python
python -m http.server 8000

# or Node
npx serve .
```

Then open `http://localhost:8000`.

## How it works right now

- **Access code**: set in `js/access-gate.js` (`ACCESS_CODE`). Anyone you share the code with can get past the gate. Change it any time to revoke access — just redeploy.
- **Disclaimer**: shown once per browser, before the name prompt, stating plainly what is and isn't stored. Keep it accurate — update it if what the app collects ever changes.
- **Name / scores**: no account, no password. A player types a name and it's remembered (with their high score) in that browser's local storage only. Different browser or device = a fresh start.
- **Optional stats**: on the disclaimer screen there's an unchecked-by-default checkbox to also send name, score, approximate region (city/country from IP), and connection type/speed to a Google Sheet you control. Nothing is sent unless a player explicitly checks it. See `google-apps-script/README.md` to wire this up (optional — the game works fully without it).
- **Game**: batting only. An AI bowler sends deliveries down the pitch; press **SPACE** (or tap the field on mobile) to swing as the ball arrives. Timing determines runs (dot ball, 1, 2, 4, 6) or getting bowled. Single innings, 1 wicket, 5 overs. A pause button in the HUD lets you resume, restart the innings, or quit to the menu mid-game.
- **Visuals**: procedural blocky, articulated players (helmet/pads/gloves on the batsman, cap on the bowler) with animated limbs -- the bowler's full-body delivery action and the batsman's swing (torso turn, front-foot step) play out each ball, not just a single moving prop. A seamed ball, tiered stadium stands, boundary advertising boards, and floodlight towers round out the scene — all generated in code, no external 3D model files. The in-game camera sits close behind the batsman for an over-the-shoulder view of each delivery.

## Deploying so you can share a URL

This repo auto-deploys to GitHub Pages on every push to `main` via
`.github/workflows/deploy.yml`. One-time setup:

1. Repo → **Settings → Pages** → **Source: GitHub Actions** (not "deploy from
   branch" — the workflow handles that).
2. Repo → **Settings → Secrets and variables → Actions → New repository
   secret**, name it `COLLECT_ENDPOINT`, value = your Apps Script Web App URL
   (see `google-apps-script/README.md`). The workflow writes this into
   `js/collect-config.js` only inside the deploy artifact — it never touches
   the repo itself. Skip this secret entirely if you don't want the live site
   collecting stats; the game still works fine, the checkbox just becomes a
   no-op.
3. Push to `main` (or re-run the workflow manually from the **Actions** tab).
   GitHub gives you a URL like `https://<username>.github.io/3D-Games/` —
   that's what you share with testers, along with the access code.

## Roadmap ideas (not built yet)

- A shared leaderboard across players/devices (would need a small backend — e.g. Firestore with just name + score, no accounts)
- Bowling mode / full match simulation, fielding, running between wickets
- Ball swing & spin physics, difficulty levels, different shot types
- Sound effects and commentary-style feedback
- Multiplayer
