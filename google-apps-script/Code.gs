// Paste this into script.google.com (see README.md in this folder for setup).
// Appends one row per game to the active Google Sheet.

const HEADERS = [
  "playedAt", "name", "runs", "wickets", "balls",
  "ip", "city", "region", "country",
  "connectionType", "downlinkMbps",
];

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }

  const data = JSON.parse(e.postData.contents);
  sheet.appendRow(HEADERS.map((key) => data[key] ?? ""));

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
