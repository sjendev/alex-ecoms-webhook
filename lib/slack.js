// ─── Send a message to Slack via Incoming Webhook ─────────────────────────────
export async function sendSlackMessage(text, webhookUrl = null) {
    const url = webhookUrl || process.env.SLACK_WEBHOOK_URL;

    if (!url) {
        throw new Error('No Slack webhook URL provided');
    }

    const payload = { text };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Slack webhook failed: ${res.status} ${err}`);
    }

    return true;
}
