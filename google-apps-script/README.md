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
6. In the game's repo, copy `js/collect-config.example.js` to
   `js/collect-config.js` (this file is gitignored — it will never be
   committed) and paste the URL in:
   ```js
   export const COLLECT_ENDPOINT = "https://script.google.com/macros/s/.../exec";
   ```
7. Deploy the game as usual. `js/collect-config.js` needs to exist on
   whatever machine/host actually builds or serves the deployed copy — since
   it's gitignored, that means placing it there manually outside of git
   (e.g. copy it in as a manual step before running `firebase deploy`, or
   however you're hosting).

Each row appended will have: `playedAt, name, runs, wickets, balls, ip, city,
region, country, connectionType, downlinkMbps`.

To revoke access later, go to **Deploy → Manage deployments** and archive it —
the endpoint stops accepting requests immediately.
