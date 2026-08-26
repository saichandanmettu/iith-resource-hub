/* ------------------------------------------------------------
   Abhyas — vote counter backend
   Paste this into Extensions > Apps Script on a Google Sheet
   that has 0 in cell A1 of its first sheet.

   Deploy > New deployment > type "Web app"
     Execute as: Me
     Who has access: Anyone
   Copy the resulting /exec URL into releases.js's VOTE_API const.
   ------------------------------------------------------------ */
function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const cell = sheet.getRange('A1');
  const action = (e.parameter.action || 'read');

  if (action === 'vote') {
    const delta = e.parameter.delta === 'down' ? -1 : 1;
    const current = Number(cell.getValue()) || 0;
    const next = Math.max(0, current + delta);
    cell.setValue(next);
    return respond({ votes: next });
  }

  const current = Number(cell.getValue()) || 0;
  return respond({ votes: current });
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
