# Wiring up the stats sheet

The game can optionally send a row per game (name, score, approximate region,
connection info) to a Google Sheet, only when a player checks the consent box
on the disclaimer screen. Setup is entirely in your own Google account —
takes about 5 minutes, free.

1. Create a new Google Sheet (sheets.new). Name it whatever you like.
2. In the sheet, go to **Extensions → Apps Script**.
3. Delete the placeholder code and paste in the contents of `Code.gs` from
   this folder.
4. Click **Deploy → New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy**, authorize it (it'll warn you it's an unverified app —
   that's expected since you just wrote it; click through Advanced → Go to
   project (unsafe)), and copy the **Web app URL** it gives you.
6. For **local testing**: copy `js/collect-config.example.js` to
   `js/collect-config.js` (this file is gitignored — it will never be
   committed) and paste the URL in:
   ```js
   export const COLLECT_ENDPOINT = "https://script.google.com/macros/s/.../exec";
   ```
7. For the **live/deployed site**: don't put the URL in any file. Instead add
   it as a GitHub repo secret named `COLLECT_ENDPOINT` (Settings → Secrets and
   variables → Actions) — the deploy workflow (`.github/workflows/deploy.yml`)
   writes it into `js/collect-config.js` only inside the deployed artifact, so
   it never appears in the repo or its history. See the main `README.md`'s
   deploy section for the full setup.

Each row appended will have: `playedAt, name, runs, wickets, balls, ip, city,
region, country, connectionType, downlinkMbps`.

To revoke access later, go to **Deploy → Manage deployments** and archive it —
the endpoint stops accepting requests immediately.
