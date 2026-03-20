// api/sheets.js
// Required env vars:
//   GOOGLE_API_KEY      (Google Cloud API key with Sheets API enabled)
//   PCF_SPREADSHEET_ID  = 1l8j8fYNIb7EKMh-zNydfdnqZ-hgN6aig3W21hbwRMug
//   EOD_SPREADSHEET_ID  = 1fsDVo9sE5xjUNRbs4my-w3aqRip34iIROerdNmQuooc
//   PCF_SHEET_NAME      (default: "Form Responses 1")
//   EOD_SHEET_NAME      (default: "Form Responses 1")
// Both sheets must be set to "Anyone with the link can view"

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing GOOGLE_API_KEY env var' });

  try {
    const [pcf, eod] = await Promise.all([
      fetchSheet(apiKey, process.env.PCF_SPREADSHEET_ID, process.env.PCF_SHEET_NAME || 'Form Responses 1'),
      fetchSheet(apiKey, process.env.EOD_SPREADSHEET_ID, process.env.EOD_SHEET_NAME || 'Form Responses 1'),
    ]);
    res.status(200).json({ pcf, eod });
  } catch (err) {
    console.error('sheets error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function fetchSheet(apiKey, id, name) {
  if (!id) throw new Error(`Missing spreadsheet ID for sheet: ${name}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(name)}?key=${apiKey}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (data.error) throw new Error(`Sheets API error: ${data.error.message}`);
  const rows = data.values || [];
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])));
}
