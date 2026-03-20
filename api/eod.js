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

    const isWebinarDay = get('Is it webinar day?').toLowerCase().includes('yes');

    let message;

    if (isWebinarDay) {
      message = `📊 *New EOD Report* 🎥 _(Webinar Day)_

*Date:* ${get('Date of Reporting')}
*Setter:* ${get('Setter')}
*Setter Type:* ${get('Setter Type')}
*New DMs Assigned:* ${get('New DMs Assigned')}
*Booking Links Sent:* ${get('Booking Links Sent')}
*Booked Calls on Calendar:* ${get('Booked Calls on Calendar')}
*Calls Booked:* ${get('Number of Calls Booked')}
*Sets Showed:* ${get('Sets Showed')}
*Set No Showed:* ${get('Set No Showed')}
*Setter [Webinar]:* ${get('Setter [Webinar]')}
*Webinar Dial Confirmations:* ${get('Webinar Dial Confirmations')}
*Pickups [Webinar]:* ${get('Pickups [Webinar]')}

_Submitted: ${get('Timestamp')}_`;
    } else {
      message = `📊 *New EOD Report*

*Date:* ${get('Date of Reporting')}
*Setter:* ${get('Setter')}
*Setter Type:* ${get('Setter Type')}
*New DMs Assigned:* ${get('New DMs Assigned')}
*Booking Links Sent:* ${get('Booking Links Sent')}
*Booked Calls on Calendar:* ${get('Booked Calls on Calendar')}
*Calls Booked:* ${get('Number of Calls Booked')}
*Sets Showed:* ${get('Sets Showed')}
*Set No Showed:* ${get('Set No Showed')}

_Submitted: ${get('Timestamp')}_`;
    }

    await sendSlackMessage(message, process.env.SLACK_EOD_WEBHOOK_URL);

    console.log('[eod] Notification sent to Slack');
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('[eod] Error:', err.message);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
