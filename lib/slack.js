// ─── Send a message to Slack via Incoming Webhook ─────────────────────────────
export async function sendSlackMessage(text, blocks = null) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
        throw new Error('SLACK_WEBHOOK_URL is not set');
    }

    const payload = { text };
    if (blocks) payload.blocks = blocks;

    const res = await fetch(webhookUrl, {
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
