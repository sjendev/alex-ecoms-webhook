import { findCloseLeadByEmail, createCloseOpportunity, updateCloseLeadStatus, createCloseNote } from '../lib/close.js';
import { createGHLContact } from '../lib/ghl.js';

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
    const eventUri = payload?.event ?? '';
    const startTime = payload?.scheduled_event?.start_time ?? null;
    const eventName = payload?.scheduled_event?.name ?? 'Strategy Call';

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

    // ── 3. Create opportunity on the Close lead ───────────────────────────────
    const opportunity = await createCloseOpportunity(
      closeLead.id,
      { email, firstName, lastName },
      { uri: eventUri, start_time: startTime, name: eventName }
    );

    // ── 4. Update GHL contact tag to booked-call ──────────────────────────────
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

    const noteContent = `${eventNameFullName} - ${inviteeName}

Start Time: ${formattedStartTime}
Duration: ${durationStr}

Location: ${zoomLink}`;

    await createCloseNote(closeLead.id, noteContent);

    console.log(`[calendly] Close lead ${closeLead.id} → CALL BOOKED | Opportunity: ${opportunity.id}`);
    return res.status(200).json({
      ok: true,
      closeLeadId: closeLead.id,
      closeOpportunityId: opportunity.id,
    });

  } catch (err) {
    console.error('[calendly] Error:', err.message);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
