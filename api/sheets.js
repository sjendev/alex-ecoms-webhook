// api/sheets.js
// Required env vars:
//   GOOGLE_SERVICE_ACCOUNT_EMAIL
//   GOOGLE_PRIVATE_KEY  (the full PEM key, newlines as \n)
//   PCF_SPREADSHEET_ID  (from the PCF sheet URL)
//   EOD_SPREADSHEET_ID  (from the EOD sheet URL)
//   PCF_SHEET_NAME      (default: "Form Responses 1")
//   EOD_SHEET_NAME      (default: "Form Responses 1")

import { createSign } from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = await getAccessToken();
    const [pcf, eod] = await Promise.all([
      fetchSheet(token, process.env.PCF_SPREADSHEET_ID, process.env.PCF_SHEET_NAME || 'Form Responses 1'),
      fetchSheet(token, process.env.EOD_SPREADSHEET_ID, process.env.EOD_SHEET_NAME || 'Form Responses 1'),
    ]);
    res.status(200).json({ pcf, eod });
  } catch (err) {
    console.error('sheets error:', err);
    res.status(500).json({ error: err.message });
  }
}

async function getAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY');

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(claim));
  const toSign = `${header}.${body}`;

  const sign = createSign('RSA-SHA256');
  sign.update(toSign);
  const sig = sign.sign(key, 'base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const jwt = `${toSign}.${sig}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error(`Auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function fetchSheet(token, id, name) {
  if (!id) throw new Error(`Missing spreadsheet ID for sheet: ${name}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(name)}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await resp.json();
  if (data.error) throw new Error(`Sheets API error: ${JSON.stringify(data.error)}`);
  const rows = data.values || [];
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])));
}

function b64url(str) {
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
