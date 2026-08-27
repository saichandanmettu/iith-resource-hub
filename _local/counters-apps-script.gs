/* ------------------------------------------------------------
   Abhyas — per-resource download/share/view counter backend

   Same pattern as votes-apps-script.gs (the release-vote counter
   already live on this site) — one more Apps Script web app, not a
   new architecture. Paste this into Extensions > Apps Script on a
   fresh Google Sheet. No header row needed; the script creates rows
   as resources get their first click.

   Sheet layout (first sheet, created automatically as needed):
     Column A: resource id
     Column B: download count
     Column C: share count
     Column D: view count

   Deploy > New deployment > type "Web app"
     Execute as: Me
     Who has access: Anyone
   Copy the resulting /exec URL into resource.js's COUNTER_API const.

   Same inheritable-account caveat as the vote counter (see
   HANDOVER.md §3.2): this stops working if the deploying Google
   account is deactivated, and fails silently. Same fix if that
   happens: redeploy this file under a different account.
   ------------------------------------------------------------ */
function doGet(e) {
  const id = String((e && e.parameter && e.parameter.id) || "").trim();
  const action = (e && e.parameter && e.parameter.action) || "read";

  if (!id) return respond({ error: "missing id" });

  /* Views fire on every page load, so concurrent requests are far more
     frequent than click-driven download/share events. Wrap read-modify-write
     in ScriptLock to prevent lost updates. */
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
  } catch (err) {
    return respond({ error: "busy" });
  }

  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]) === id) { rowIndex = i + 1; break; }
    }
    if (rowIndex === -1) {
      sheet.appendRow([id, 0, 0, 0]);
      rowIndex = sheet.getLastRow();
    }

    let downloads = Number(sheet.getRange(rowIndex, 2).getValue()) || 0;
    let shares = Number(sheet.getRange(rowIndex, 3).getValue()) || 0;
    // Older 3-column rows have an empty column D; treat missing/blank as 0
    let views = Number(sheet.getRange(rowIndex, 4).getValue()) || 0;

    if (action === "download") {
      downloads += 1;
      sheet.getRange(rowIndex, 2).setValue(downloads);
    } else if (action === "share") {
      shares += 1;
      sheet.getRange(rowIndex, 3).setValue(shares);
    } else if (action === "view") {
      views += 1;
      sheet.getRange(rowIndex, 4).setValue(views);
    }

    return respond({ id: id, views: views, downloads: downloads, shares: shares });
  } finally {
    lock.releaseLock();
  }
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
