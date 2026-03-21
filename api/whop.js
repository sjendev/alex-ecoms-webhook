import { sendSlackMessage } from '../lib/slack.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = req.body;
        const data = body.data || {};

        // Log full payload for debugging
        console.log('[whop] Full payload:', JSON.stringify(body).slice(0, 2000));

        // Whop doesn't send an event field — the webhook subscription type
        // determines what events arrive. Check for payment data.
        const isPayment = data.id?.startsWith('pay_') || data.substatus === 'succeeded';

        if (!isPayment) {
            console.log('[whop] Ignoring non-payment webhook');
            return res.status(200).json({ ok: true, skipped: true });
        }

        const amount = data.total ?? data.usd_total ?? data.final_amount ?? data.amount ?? 0;
        const currency = (data.currency || 'USD').toUpperCase();
        const customerEmail = data.user?.email || data.membership?.user?.email || 'Unknown';
        const customerName = data.user?.name || data.user?.username || '';

        const paymentId = data.id || body.id || 'N/A';
        const createdAt = data.paid_at || data.created_at || body.timestamp || new Date().toISOString();

        // Format amount (Whop sends dollars, not cents)
        const formattedAmount = Number(amount).toLocaleString('en-US', {
            style: 'currency',
            currency: currency,
        });

        const blocks = [
            { type: 'header', text: { type: 'plain_text', text: '💰 New Payment Received!' } },
            { type: 'section', fields: [
                { type: 'mrkdwn', text: `*Name:*\n${customerName || 'N/A'}` },
                { type: 'mrkdwn', text: `*Email:*\n${customerEmail}` },
                { type: 'mrkdwn', text: `*Amount:*\n${formattedAmount}` },
            ]},
            { type: 'image', image_url: 'https://alex-ecoms-webhook.vercel.app/takemymoney-leo.gif', alt_text: 'Take my money' },
        ];

        const text = `💰 New Payment: ${formattedAmount} from ${customerEmail}`;
        await sendSlackMessage(text, null, blocks);

        console.log(`[whop] Payment notification sent to Slack: ${formattedAmount} from ${customerEmail}`);
        return res.status(200).json({ ok: true });

    } catch (err) {
        console.error('[whop] Error:', err.message);
        return res.status(200).json({ ok: false, error: err.message });
    }
}
