import { findCloseLeadByEmail, createCloseOpportunity, updateCloseLeadStatus, createCloseNote, findOpportunityByCalendlyUri } from '../lib/close.js';
import { createGHLContact } from '../lib/ghl.js';
import { sendSlackMessage } from '../lib/slack.js';

// In-memory cache to catch exact-millisecond duplicates hitting the same serverless instance
const processedEvents = new Set();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { event, payload } = req.body;

    // Only care about new bookings
    if (event !== 'invitee.created') {
      console.log('[calendly] Ignoring event:', event);
      return res.status(200).json({ ok: true, skipped: true });
    }

    const email = payload?.email ?? null;
    const firstName = payload?.first_name ?? '';
    const lastName = payload?.last_name ?? '';
    const eventUri = payload?.uri || payload?.event || '';
    const startTime = payload?.scheduled_event?.start_time ?? null;
    const eventName = payload?.scheduled_event?.name ?? 'Strategy Call';

    if (!eventUri) return res.status(200).json({ ok: false, error: 'No event URI' });

    // ── 0. Instant Memory Lock (catches same-instance race conditions) ────────
    if (processedEvents.has(eventUri)) {
      console.log(`[calendly] INSTANT CACHE: Duplicate detected for ${eventUri}. Dropping.`);
      return res.status(200).json({ ok: true, skipped: true, reason: 'Instant cache hit' });
    }
    processedEvents.add(eventUri);
    // Cleanup memory after 2 minutes
    setTimeout(() => processedEvents.delete(eventUri), 120000);

    if (!email) {
      console.warn('[calendly] No email in payload — cannot match lead');
      return res.status(200).json({ ok: false, error: 'No email in payload' });
    }

    console.log(`[calendly] Booking received for: ${email}`);


    // ── 1. Find Close lead by email ───────────────────────────────────────────
    const closeLead = await findCloseLeadByEmail(email);

    if (!closeLead) {
      console.warn(`[calendly] No Close lead found for ${email}`);
      return res.status(200).json({ ok: false, reason: 'No matching Close lead found', email });
    }

    // ── 2. Update lead status to CALL BOOKED ─────────────────────────────────
    await updateCloseLeadStatus(closeLead.id, 'CALL BOOKED');

    // ── 3. Check for existing opportunity for this Calendly event ─────────────
    const existingOpp = await findOpportunityByCalendlyUri(closeLead.id, eventUri);
    if (existingOpp) {
      console.log(`[calendly] Opportunity already exists (${existingOpp.id}) for event ${eventUri}. Skipping.`);
      return res.status(200).json({ ok: true, skipped: true, reason: 'Opportunity already exists' });
    }

    // ── 4. Create opportunity ─────────────────────────────────────────────────
    const myOpp = await createCloseOpportunity(
      closeLead.id,
      { email, firstName, lastName },
      { uri: eventUri, start_time: startTime, name: eventName }
    );
    const opportunityId = myOpp.id;

    // ── 5. Update GHL contact tag to booked-call ──────────────────────────────
    await createGHLContact(
      { firstName, lastName, email, phone: '', budgetLabel: '', experience: '', situation: '' },
      ['qualified', 'booked-call']
    );

    // ── 5. Create a note on the Close lead ────────────────────────────────────
    const eventNameFullName = payload?.scheduled_event?.name ?? 'Strategy Call';
    const inviteeName = payload?.name || ([firstName, lastName].filter(Boolean).join(' ') || 'Invitee');

    let formattedStartTime = startTime || 'N/A';
    try {
      if (startTime) {
        const d = new Date(startTime);
        formattedStartTime = new Intl.DateTimeFormat('en-US', {
          hour: '2-digit', minute: '2-digit', hour12: true,
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
          timeZoneName: 'short'
        }).format(d).replace(/, /g, ' - ').replace('  ', ' '); // approximate target format
      }
    } catch (e) { }

    const endTime = payload?.scheduled_event?.end_time;
    let durationStr = '45 minutes';
    if (startTime && endTime) {
      const diffMins = Math.round((new Date(endTime) - new Date(startTime)) / 60000);
      if (diffMins > 0) durationStr = `${diffMins} minutes`;
    }

    const zoomLink = payload?.scheduled_event?.location?.join_url ?? 'N/A';

    const noteContent = `${eventNameFullName} - ${inviteeName}\n\nStart Time: ${formattedStartTime}\nDuration: ${durationStr}\n\nLocation: ${zoomLink}`;

    await createCloseNote(closeLead.id, noteContent);

    // ── 6. Send Slack notification to #new-calls-booked ───────────────────────
    try {
      const slackMessage = `📞 *New Call Booked!*\n\n*Name:* ${inviteeName}\n*Email:* ${email}\n*Event:* ${eventNameFullName}\n*Start Time:* ${formattedStartTime}`;

      await sendSlackMessage(slackMessage, process.env.SLACK_CALLS_WEBHOOK_URL);
      console.log(`[calendly] Slack notification sent for ${email}`);
    } catch (slackErr) {
      console.error('[calendly] Slack notification failed:', slackErr.message);
    }

    console.log(`[calendly] Close lead ${closeLead.id} → CALL BOOKED | Opportunity: ${opportunityId}`);
    return res.status(200).json({
      ok: true,
      closeLeadId: closeLead.id,
      closeOpportunityId: opportunityId,
    });

  } catch (err) {
    console.error('[calendly] Error:', err.message);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
