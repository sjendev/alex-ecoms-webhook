const CLOSE_BASE = 'https://api.close.com/api/v1';

const headers = () => ({
  'Authorization': 'Basic ' + Buffer.from(`${process.env.CLOSE_API_KEY}:`).toString('base64'),
  'Content-Type': 'application/json',
});

// ─── Create a lead in Close.com ───────────────────────────────────────────────
export async function createCloseLead(lead, source = 'Typeform - Alex Ecoms VSL') {
  const payload = {
    name: `${lead.firstName} ${lead.lastName}`,
    status: 'NEW LEAD NO CALL BOOKED',
    assigned_to: 'user_5h9JkUQVYBm7OybUS3D7YV7F5EbDQRxaP3w9unKZyl4',
    contacts: [
      {
        name: `${lead.firstName} ${lead.lastName}`,
        emails: [{ email: lead.email, type: 'office' }],
        phones: lead.phone ? [{ phone: lead.phone, type: 'office' }] : [],
      },
    ],
    custom: Object.fromEntries(
      Object.entries({
        'Budget': lead.budgetLabel || undefined,
        'Experience': lead.experience || undefined,
        'Situation': lead.situation || undefined,
        'Source': source,
        'Typeform Token': lead.formResponseToken || undefined,
      }).filter(([, v]) => v !== undefined)
    ),
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

// ─── Find ALL active opportunities for a lead ──────────────────────────────
export async function findAllActiveOpportunities(leadId) {
  const res = await fetch(`${CLOSE_BASE}/opportunity/?lead_id=${leadId}&status_type=active`, {
    headers: headers(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Close findOpportunities failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.data || [];
}

// ─── Find an opportunity by Calendly event URI ──────────────────────────────
// Close returns custom fields with internal IDs (cf_xxx), not display names,
// so we check ALL custom field values for a match.
export async function findOpportunityByCalendlyUri(leadId, calendlyUri) {
  const opps = await findAllActiveOpportunities(leadId);
  return opps.find(opp => {
    if (!opp.custom) return false;
    return Object.values(opp.custom).includes(calendlyUri);
  }) || null;
}

// ─── Delete an opportunity ──────────────────────────────────────────────────
export async function deleteCloseOpportunity(oppId) {
  const res = await fetch(`${CLOSE_BASE}/opportunity/${oppId}/`, {
    method: 'DELETE',
    headers: headers(),
  });

  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Close deleteOpportunity failed: ${res.status} ${err}`);
  }

  return true;
}

// ─── Create an opportunity on an existing lead ────────────────────────────────
export async function createCloseOpportunity(leadId, lead, calendlyEvent) {
  const payload = {
    lead_id: leadId,
    assigned_to: 'user_5h9JkUQVYBm7OybUS3D7YV7F5EbDQRxaP3w9unKZyl4',
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
