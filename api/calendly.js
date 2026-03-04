import { findCloseLeadByEmail, createCloseOpportunity, updateCloseLeadStatus, createCloseNote, findAllActiveOpportunities, deleteCloseOpportunity } from '../lib/close.js';
import { createGHLContact } from '../lib/ghl.js';

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

    // ── 3. Create opportunity (both concurrent instances may do this) ─────────
    const myOpp = await createCloseOpportunity(
      closeLead.id,
      { email, firstName, lastName },
      { uri: eventUri, start_time: startTime, name: eventName }
    );
    console.log(`[calendly] Created opportunity ${myOpp.id} for lead ${closeLead.id}`);

    // ── 4. Wait 1s then reconcile duplicates ──────────────────────────────────
    await new Promise(r => setTimeout(r, 1000));

    const allOpps = await findAllActiveOpportunities(closeLead.id);
    console.log(`[calendly] Found ${allOpps.length} active opportunities for lead ${closeLead.id}`);

    if (allOpps.length > 1) {
      // Keep the oldest opportunity, delete the rest
      allOpps.sort((a, b) => new Date(a.date_created) - new Date(b.date_created));
      const keepId = allOpps[0].id;

      for (const opp of allOpps.slice(1)) {
        console.log(`[calendly] Deleting duplicate opportunity ${opp.id}`);
        await deleteCloseOpportunity(opp.id);
      }

      // If MY opportunity was NOT the one kept, skip note creation
      if (myOpp.id !== keepId) {
        console.log(`[calendly] My opportunity ${myOpp.id} was a duplicate. Skipping note.`);
        return res.status(200).json({ ok: true, deduplicated: true });
      }
    }

    const opportunityId = allOpps.length > 1 ? allOpps[0].id : myOpp.id;

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

    const noteContent = `${eventNameFullName} - ${inviteeName}

Start Time: ${formattedStartTime}
Duration: ${durationStr}

Location: ${zoomLink}`;

    await createCloseNote(closeLead.id, noteContent);

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
