// ─── Typeform Form & Field IDs ────────────────────────────────────────────────
export const FORM_ID = 'HBZFtBLy';

export const ENDING_REFS = {
  DISQUALIFIED: '902bf817-f78e-430e-b43e-e48dd23deffa', // → free course redirect
  QUALIFIED:    'cc0d67cf-2599-43aa-982e-b8c07d6dca35', // → /booking (Calendly)
};

export const FIELD_IDS = {
  experience:  'ZhIaVt0eMdT8', // Q1 - experience with digital products
  situation:   'auXS51VdiIQl', // Q2 - current situation
  willingness: '3oyTt4mvaQDP', // Q3 - willing to invest
  budget:      'e6Tb0ELakk6R', // Q4 - budget (the qualifier)
  firstName:   'i5gTn26CyDrN', // Q5
  lastName:    'GZ4oUEYdRoTj', // Q6
  phone:       'ToGzN7ccQDXI', // Q7
  email:       'MKjswrCoXRzb', // Q8
  callConfirm: 'VHUEHQjL8sOd', // Q9 - qualified only
};

export const BUDGET_LABELS = {
  '769e9698-e9bb-4b31-9762-2a3ac489189a': '$4,000+',
  'd935c618-449a-481c-a7ec-c4e8fcfe1687': '$2,500 to $4,000',
  '6c636113-2a80-4b1e-9e6d-9d2b89205b54': '$1,000 to $2,500',
  '938f2733-16a1-404a-a01a-7128c88e9ecc': 'Less than $1,000',
};

// ─── Parse a Typeform payload into clean lead data ────────────────────────────
export function parseTypeformPayload(body) {
  const response  = body.form_response;
  const answers   = response.answers ?? [];
  const endingRef = response.ending?.ref ?? null;

  const get = (fieldId) => answers.find(a => a.field.id === fieldId);

  const budgetAnswer = get(FIELD_IDS.budget);
  const budgetLabel  = budgetAnswer?.choice?.label ?? null;
  const budgetRef    = budgetAnswer?.choice?.ref   ?? null;

  return {
    // Routing
    endingRef,
    isDisqualified: endingRef === ENDING_REFS.DISQUALIFIED,
    isQualified:    endingRef === ENDING_REFS.QUALIFIED,

    // Contact
    firstName: get(FIELD_IDS.firstName)?.text        ?? '',
    lastName:  get(FIELD_IDS.lastName)?.text         ?? '',
    email:     get(FIELD_IDS.email)?.email           ?? '',
    phone:     get(FIELD_IDS.phone)?.phone_number    ?? '',

    // Qualification context
    budgetLabel,
    budgetRef,
    experience: get(FIELD_IDS.experience)?.choice?.label ?? '',
    situation:  get(FIELD_IDS.situation)?.choice?.label  ?? '',

    // Meta
    formResponseToken: response.token,
    submittedAt:       response.submitted_at,
  };
}
