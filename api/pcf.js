import { sendSlackMessage } from '../lib/slack.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const d = req.body;
    // Google Apps Script sends namedValues as arrays — unwrap if needed
    const get = (key) => {
      const val = d[key];
      return Array.isArray(val) ? val[0] : (val ?? 'N/A');
    };

    const message = `📋 *New PCF Submission*

*Call Date:* ${get('Call Date')}
*Lead Name:* ${get('Lead Name')}
*Lead Email:* ${get('Lead Email')}
*Closer:* ${get('Closer')}
*Setter:* ${get('Setter')}
*Lead Source:* ${get('Lead Source')}
*Call Type:* ${get('Call Type')}
*Revenue:* ${get('Revenue')}
*Cash Collected:* ${get('Cash Collected')}
*Notes:* ${get('(CC) Notes')}

_Submitted: ${get('Timestamp')}_`;

    await sendSlackMessage(message, process.env.SLACK_PCF_WEBHOOK_URL);

    console.log('[pcf] Notification sent to Slack');
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[pcf] Error:', err.message);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
