# 3D Cricket

A browser-based 3D cricket batting game (Three.js), with an access-code gate and simple name/password accounts so players can save their scores.

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
- **Accounts / scores**: works out of the box using the browser's local storage — no setup needed, but scores only persist on the device/browser the player used.
- **Game**: batting only. An AI bowler sends deliveries down the pitch; press **SPACE** (or tap the field on mobile) to swing as the ball arrives. Timing determines runs (dot ball, 1, 2, 4, 6) or getting bowled. Single innings, 1 wicket, 5 overs.

## Upgrading accounts to cross-device (Firebase, free)

To make scores follow a player across devices/browsers instead of being stuck on local storage:

1. Go to https://console.firebase.google.com, create a free project (no credit card required).
2. In the project, add a **Web App** — it will give you a `firebaseConfig` object. Copy it into `js/firebase-config.js`, replacing the placeholder values.
3. In the Firebase console, enable **Authentication → Sign-in method → Email/Password**.
4. In the Firebase console, create a **Firestore Database** (start in production mode) and set rules so each signed-in user can only read/write their own `players/{uid}` document, e.g.:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /players/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
5. Redeploy. The app automatically detects real Firebase keys and switches from local storage to Firebase — no other code changes needed.

## Deploying so you can share a URL

Recommended: **Firebase Hosting** (free, pairs naturally with the accounts setup above).

```
npm install -g firebase-tools
firebase login
firebase init hosting     # choose this folder as the public directory, single-page app: No
firebase deploy
```

This gives a URL like `https://your-project.web.app` you can share along with the access code. The source code stays in this private GitHub repo; only the built site is public at that URL.

Alternatives: Vercel, Netlify, or GitHub Pages (private-repo Pages requires a paid GitHub plan).

## Roadmap ideas (not built yet)

- Bowling mode / full match simulation, fielding, running between wickets
- Better crowd/stadium visuals, ball swing & spin physics
- Leaderboards across all players
- Multiplayer
