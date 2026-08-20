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
- **Game**: batting only. An AI bowler sends deliveries down the pitch; press **SPACE** (or tap the field on mobile) to swing as the ball arrives. Timing determines runs (dot ball, 1, 2, 4, 6) or getting bowled. Single innings, 1 wicket, 5 overs.

## Deploying so you can share a URL

Any static host works since there's no backend. Simple free options:

**GitHub Pages** (pairs naturally with a public repo):
1. Repo → **Settings → Pages** → Source: deploy from branch `main`, root.
2. GitHub gives you a URL like `https://<username>.github.io/3D-Games/`.

**Firebase Hosting / Vercel / Netlify** also work, if you'd rather:
```
npm install -g firebase-tools
firebase login
firebase init hosting     # choose this folder as the public directory, single-page app: No
firebase deploy
```

## Roadmap ideas (not built yet)

- A shared leaderboard across players/devices (would need a small backend — e.g. Firestore with just name + score, no accounts)
- Bowling mode / full match simulation, fielding, running between wickets
- Better crowd/stadium visuals, ball swing & spin physics
- Multiplayer
