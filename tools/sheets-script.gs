/**
 * Dagsloggen till Google Kalkylark
 *
 * Klistra in hela den här filen i kalkylarket:
 *   Tillägg  ->  Apps Script  ->  ersätt allt i Code.gs  ->  spara
 *
 * Publicera sedan:
 *   Distribuera  ->  Ny distribution  ->  typ: webbapp
 *   Kör som: jag själv
 *   Vem har åtkomst: alla
 *   Distribuera, godkänn behörigheterna, kopiera webbadressen
 *
 * Byt ut TOKEN nedan mot ett eget ord först. Samma ord sätts sedan i varje
 * app med:  npx wrangler secret put SHEET_TOKEN
 */

const TOKEN = "BYT_UT_MIG";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.token !== TOKEN) {
      return svar({ ok: false, error: "fel token" });
    }
    skrivRad(data);
    return svar({ ok: true });
  } catch (err) {
    return svar({ ok: false, error: String(err) });
  }
}

function doGet() {
  return svar({ ok: true, message: "Dagsloggen lyssnar. Apparna skriver hit 23.58." });
}

function svar(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Skriver en rad för dagen i appens egen flik. Finns raden redan skrivs den
 * över, så det går att skicka om en dag utan att den hamnar dubbelt.
 *
 * Förväntar sig:
 *   { token, app, title, date, weekday, done, total, streak,
 *     tasks: [{ id, text, done }] }
 */
function skrivRad(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const namn = (data.title || data.app || "Okänd").substring(0, 90);
  let ark = ss.getSheetByName(namn);
  if (!ark) {
    ark = ss.insertSheet(namn);
    ark.appendRow(["Datum", "Veckodag", "Klara", "Totalt", "Andel", "Streak"]);
    ark.setFrozenRows(1);
    ark.setFrozenColumns(1);
  }

  const FASTA = 6; // kolumnerna ovan
  const bredd = Math.max(ark.getLastColumn(), FASTA);
  const rubriker = ark.getRange(1, 1, 1, bredd).getValues()[0];

  // en kolumn per uppgift, nya uppgifter läggs till sist
  const tasks = data.tasks || [];
  const kolumnFor = {};
  tasks.forEach(function (t) {
    const etikett = t.text || t.id;
    let i = rubriker.indexOf(etikett);
    if (i === -1) {
      rubriker.push(etikett);
      i = rubriker.length - 1;
      ark.getRange(1, i + 1).setValue(etikett);
    }
    kolumnFor[t.id] = i;
  });

  const rad = new Array(rubriker.length).fill("");
  rad[0] = data.date;
  rad[1] = data.weekday || "";
  rad[2] = data.done;
  rad[3] = data.total;
  rad[4] = data.total ? Math.round((data.done / data.total) * 100) / 100 : 0;
  rad[5] = data.streak === null || data.streak === undefined ? "" : data.streak;
  tasks.forEach(function (t) {
    rad[kolumnFor[t.id]] = t.done ? "JA" : "NEJ";
  });

  // finns dagen redan? skriv över den raden i så fall
  const datum = ark.getLastRow() > 1 ? ark.getRange(2, 1, ark.getLastRow() - 1, 1).getDisplayValues() : [];
  let radnr = -1;
  for (let i = 0; i < datum.length; i++) {
    if (String(datum[i][0]).trim() === String(data.date).trim()) {
      radnr = i + 2;
      break;
    }
  }
  if (radnr === -1) radnr = ark.getLastRow() + 1;

  ark.getRange(radnr, 1, 1, rad.length).setValues([rad]);
  ark.getRange(radnr, 5).setNumberFormat("0%");
}
