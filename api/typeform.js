import { parseTypeformPayload } from '../lib/typeform.js';
import { createGHLContact, enrollGHLWorkflow, updateGHLOpportunity } from '../lib/ghl.js';
import { createCloseLead } from '../lib/close.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const lead = parseTypeformPayload(req.body);

    if (!lead.isDisqualified && !lead.isQualified) {
      console.log('[typeform] Ignoring unknown ending ref:', lead.endingRef);
      return res.status(200).json({ ok: true, skipped: true });
    }

    console.log(`[typeform] ${lead.isQualified ? 'QUALIFIED' : 'DISQUALIFIED'} — ${lead.email}`);

    // ── DISQUALIFIED PATH ──────────────────────────────────────────────────────
    if (lead.isDisqualified) {
      const contact = await createGHLContact(lead, ['disqualified', 'free-course']);

      await updateGHLOpportunity(
        contact.id,
        process.env.GHL_DISQUALIFIED_PIPELINE_ID,
        process.env.GHL_DISQUALIFIED_STAGE_ID,
        `${lead.firstName} ${lead.lastName} — ${lead.budgetLabel}`
      );

      if (process.env.GHL_DISQUALIFIED_WORKFLOW_ID !== 'SKIP') {
        await enrollGHLWorkflow(contact.id, process.env.GHL_DISQUALIFIED_WORKFLOW_ID);
      }

      console.log(`[typeform] Disqualified contact created in GHL: ${contact.id}`);
      return res.status(200).json({ ok: true, path: 'disqualified', ghlContactId: contact.id });
    }

    // ── QUALIFIED PATH ─────────────────────────────────────────────────────────
    if (lead.isQualified) {
      const contact = await createGHLContact(lead, ['qualified', 'awaiting-booking']);

      await updateGHLOpportunity(
        contact.id,
        process.env.GHL_QUALIFIED_PIPELINE_ID,
        process.env.GHL_QUALIFIED_STAGE_AWAITING_BOOKING,
        `${lead.firstName} ${lead.lastName} — ${lead.budgetLabel}`
      );

      const closeLead = await createCloseLead(lead);

      console.log(`[typeform] Qualified — GHL: ${contact.id} | Close: ${closeLead.id}`);
      return res.status(200).json({
        ok: true,
        path: 'qualified',
        ghlContactId: contact.id,
        closeLeadId:  closeLead.id,
      });
    }

  } catch (err) {
    console.error('[typeform] Error:', err.message);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
