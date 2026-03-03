const CLOSE_BASE = 'https://api.close.com/api/v1';

const headers = () => ({
  'Authorization': 'Basic ' + Buffer.from(`${process.env.CLOSE_API_KEY}:`).toString('base64'),
  'Content-Type': 'application/json',
});

// ─── Create a lead in Close.com ───────────────────────────────────────────────
export async function createCloseLead(lead) {
  const payload = {
    name: `${lead.firstName} ${lead.lastName}`,
    status: 'NEW LEAD NO CALL BOOKED',
    contacts: [
      {
        name: `${lead.firstName} ${lead.lastName}`,
        emails: [{ email: lead.email, type: 'office' }],
        phones: [{ phone: lead.phone, type: 'office' }],
      },
    ],
    custom: {
      'Budget': lead.budgetLabel || null,
      'Experience': lead.experience || null,
      'Situation': lead.situation || null,
      'Source': 'Typeform - Alex Ecoms VSL',
      'Typeform Token': lead.formResponseToken || null,
    },
  };

  const res = await fetch(`${CLOSE_BASE}/lead/`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Close createLead failed: ${res.status} ${err}`);
  }

  return res.json();
}

// ─── Find a Close lead by email ───────────────────────────────────────────────
export async function findCloseLeadByEmail(email) {
  const query = encodeURIComponent(`email:"${email}"`);
  const res = await fetch(`${CLOSE_BASE}/lead/?query=${query}&_fields=id,display_name,contacts,status`, {
    headers: headers(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Close findLead failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.data?.[0] ?? null;
}

// ─── Update lead status in Close.com ─────────────────────────────────────────
export async function updateCloseLeadStatus(leadId, status) {
  const res = await fetch(`${CLOSE_BASE}/lead/${leadId}/`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Close updateLeadStatus failed: ${res.status} ${err}`);
  }

  return res.json();
}

// ─── Find an opportunity by Calendly Event URI ────────────────────────────────
export async function findCloseOpportunityByEventUri(leadId, eventUri) {
  const res = await fetch(`${CLOSE_BASE}/opportunity/?lead_id=${leadId}`, {
    headers: headers(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Close findOpportunity failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  const opportunities = data.data || [];
  return opportunities.find(opp => opp.custom && opp.custom['Calendly Event'] === eventUri) || null;
}

// ─── Create an opportunity on an existing lead ────────────────────────────────
export async function createCloseOpportunity(leadId, lead, calendlyEvent) {
  const payload = {
    lead_id: leadId,
    note: `Booked via Calendly. Event: ${calendlyEvent.name ?? 'Strategy Call'}`,
    value: 400000, // $4,000 in cents
    value_period: 'one_time',
    confidence: 50,
    custom: {
      'Calendly Event': calendlyEvent.uri || null,
      'Call Start Time': calendlyEvent.start_time || null,
      'Invitee Email': lead.email || null,
    },
  };

  const res = await fetch(`${CLOSE_BASE}/opportunity/`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Close createOpportunity failed: ${res.status} ${err}`);
  }

  return res.json();
}

// ─── Create a note on an existing lead ─────────────────────────────────────────
export async function createCloseNote(leadId, text) {
  const payload = {
    lead_id: leadId,
    note: text,
  };

  const res = await fetch(`${CLOSE_BASE}/activity/note/`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Close createNote failed: ${res.status} ${err}`);
  }

  return res.json();
}
