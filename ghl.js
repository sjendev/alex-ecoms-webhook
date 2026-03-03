const GHL_BASE = 'https://services.leadconnectorhq.com';

const headers = () => ({
  'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
  'Content-Type':  'application/json',
  'Version':       '2021-07-28',
});

// ─── Create or update a contact in GHL ───────────────────────────────────────
export async function createGHLContact(lead, tags = []) {
  const payload = {
    locationId: process.env.GHL_LOCATION_ID,
    firstName:  lead.firstName,
    lastName:   lead.lastName,
    email:      lead.email,
    phone:      lead.phone,
    tags,
    customFields: [
      { key: 'budget',     field_value: lead.budgetLabel  ?? '' },
      { key: 'experience', field_value: lead.experience   ?? '' },
      { key: 'situation',  field_value: lead.situation    ?? '' },
      { key: 'source',     field_value: 'Typeform - Alex Ecoms VSL' },
    ],
  };

  const res = await fetch(`${GHL_BASE}/contacts/upsert`, {
    method:  'POST',
    headers: headers(),
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GHL createContact failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.contact; // returns full contact object incl. id
}

// ─── Enrol a contact into a GHL workflow ─────────────────────────────────────
export async function enrollGHLWorkflow(contactId, workflowId) {
  const res = await fetch(
    `${GHL_BASE}/contacts/${contactId}/workflow/${workflowId}`,
    {
      method:  'POST',
      headers: headers(),
      body:    JSON.stringify({ eventStartTime: new Date().toISOString() }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GHL enrollWorkflow failed: ${res.status} ${err}`);
  }

  return true;
}

// ─── Update a contact's pipeline stage in GHL ─────────────────────────────────
export async function updateGHLOpportunity(contactId, pipelineId, stageId, name) {
  const payload = {
    locationId:  process.env.GHL_LOCATION_ID,
    contactId,
    pipelineId,
    pipelineStageId: stageId,
    name,
    status: 'open',
  };

  const res = await fetch(`${GHL_BASE}/opportunities/`, {
    method:  'POST',
    headers: headers(),
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GHL createOpportunity failed: ${res.status} ${err}`);
  }

  return res.json();
}
