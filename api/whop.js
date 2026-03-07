import { sendSlackMessage } from '../lib/slack.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = req.body;
        const event = body.event || body.action || '';

        // Accept both V1 (underscore) and V2+ (dot) event naming
        const isPaymentSuccess = ['payment.succeeded', 'payment_succeeded'].includes(event);

        if (!isPaymentSuccess) {
            console.log('[whop] Ignoring event:', event);
            return res.status(200).json({ ok: true, skipped: true });
        }

        const data = body.data || {};
        const amount = data.final_amount ?? data.amount ?? 0;
        const currency = (data.currency || 'USD').toUpperCase();
        const customerEmail = data.customer_email || data.user?.email || 'Unknown';
        const customerName = data.customer_name || data.user?.name || '';
        const productName = data.product?.name || data.plan?.product?.name || data.membership?.product?.name || 'N/A';
        const paymentId = data.id || body.id || 'N/A';
        const createdAt = data.created_at || body.created_at || new Date().toISOString();

        // Format amount (Whop sends cents)
        const formattedAmount = (amount / 100).toLocaleString('en-US', {
            style: 'currency',
            currency: currency,
        });

        const message = `💰 *New Payment Received!*

*Name:* ${customerName || 'N/A'}
*Email:* ${customerEmail}
*Amount:* ${formattedAmount}`;

        await sendSlackMessage(message);

        console.log(`[whop] Payment notification sent to Slack: ${formattedAmount} from ${customerEmail}`);
        return res.status(200).json({ ok: true });

    } catch (err) {
        console.error('[whop] Error:', err.message);
        return res.status(200).json({ ok: false, error: err.message });
    }
}
