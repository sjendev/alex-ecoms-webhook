# Alex Ecoms — Webhook Automation System

## Project Purpose
Routes leads from the Alex Ecoms VSL funnel (Typeform → GHL + Close.com) and handles Calendly bookings.

## Current Status: READY TO DEPLOY
All code is written and tested against real Typeform payloads. Next step is deploying to Vercel and connecting webhooks.

---

## What This Does

```
Typeform Submit
├── DISQUALIFIED (budget = "Less than $1,000")
│   ├── GHL: Create contact (tags: disqualified, free-course)
│   └── GHL: Add to "Youtube Funnel - Disqualified Leads" pipeline → "Free Course Sent" stage
│
└── QUALIFIED (budget = $1k+)
    ├── GHL: Create contact (tags: qualified, awaiting-booking)
    ├── GHL: Add to "Youtube Qualified Leads" pipeline → "Awaiting Booking" stage
    └── Close.com: Create lead (status: NEW LEAD NO CALL BOOKED)

Calendly Booking (invitee.created)
├── Close.com: Find lead by email → update status to "CALL BOOKED"
├── Close.com: Create Opportunity (value: $4,000, status: Active)
└── GHL: Update contact tags → booked-call
```

---

## File Structure
```
alex-ecoms-webhook/
├── api/
│   ├── typeform.js       — Typeform webhook handler (main routing logic)
│   └── calendly.js       — Calendly booking handler
├── lib/
│   ├── typeform.js       — Field ID constants + payload parser
│   ├── ghl.js            — GHL API: createContact, enrollWorkflow, updateOpportunity
│   └── close.js          — Close API: createLead, findLeadByEmail, updateStatus, createOpportunity
├── .env.example          — All env vars (IDs already filled in where known)
├── package.json          — Node module config
├── CLAUDE.md             — This file
└── README.md             — Deploy instructions
```

---

## Typeform Form Details
- **Form ID:** `HBZFtBLy`
- **Disqualified ending ref:** `902bf817-f78e-430e-b43e-e48dd23deffa`
- **Qualified ending ref:** `cc0d67cf-2599-43aa-982e-b8c07d6dca35`
- **Qualifier field ID:** `e6Tb0ELakk6R` (Q4 — budget question)
- **Disqualified answer ref:** `938f2733-16a1-404a-a01a-7128c88e9ecc` (Less than $1,000)

## GHL IDs (already in .env.example)
- **Location ID:** `vQF42dKTFoRn30T8YNse`
- **Qualified Pipeline:** `Or6oHwwuXmA3jnCrUCWS` → "Youtube Qualified Leads"
  - Awaiting Booking stage: `11bff9fd-dcec-4b43-9aec-00986bc6a267`
  - Booked stage: `b29381c0-5ca9-4ab4-874c-a22c64925adb`
- **Disqualified Pipeline:** `rmv3B4fAzJk1Ncj9Mphg` → "Youtube Funnel - Disqualified Leads"
  - Free Course Sent stage: `f9ef5c76-8db3-4306-b166-69209fe27554`
- **Workflow:** SKIP (nurture sequence not built yet — update when ready)

## Close.com Statuses Used
- Qualified lead created → `NEW LEAD NO CALL BOOKED`
- Calendly books → `CALL BOOKED`
- Disqualified leads → GHL only (not sent to Close)

---

## Environment Variables Still Needed
The following must be added before deploying:
- `GHL_API_KEY` — from GHL → Settings → Private Integrations
- `CLOSE_API_KEY` — from Close → Settings → API Keys

All other IDs are already filled in `.env.example`.

---

## Next Steps (DO THESE IN ORDER)

### Step 1: Check Node.js is installed
```bash
node -v
```
If not installed: https://nodejs.org (install LTS version)

### Step 2: Install Vercel CLI
```bash
npm i -g vercel
```

### Step 3: Deploy to Vercel
```bash
cd alex-ecoms-webhook
vercel
```
- Create a new project when prompted
- Follow the CLI prompts (default answers are fine)
- Note your deployment URL e.g. `https://alex-ecoms-webhook.vercel.app`

### Step 4: Add environment variables in Vercel dashboard
Go to your project → Settings → Environment Variables and add:

| Variable | Value |
|---|---|
| `GHL_API_KEY` | your GHL private integration key |
| `GHL_LOCATION_ID` | `vQF42dKTFoRn30T8YNse` |
| `GHL_QUALIFIED_PIPELINE_ID` | `Or6oHwwuXmA3jnCrUCWS` |
| `GHL_QUALIFIED_STAGE_AWAITING_BOOKING` | `11bff9fd-dcec-4b43-9aec-00986bc6a267` |
| `GHL_QUALIFIED_STAGE_BOOKED` | `b29381c0-5ca9-4ab4-874c-a22c64925adb` |
| `GHL_DISQUALIFIED_PIPELINE_ID` | `rmv3B4fAzJk1Ncj9Mphg` |
| `GHL_DISQUALIFIED_STAGE_ID` | `f9ef5c76-8db3-4306-b166-69209fe27554` |
| `GHL_DISQUALIFIED_WORKFLOW_ID` | `SKIP` |
| `CLOSE_API_KEY` | your Close.com API key |

### Step 5: Redeploy with env vars
```bash
vercel --prod
```

### Step 6: Connect Typeform webhook
1. Typeform → your form → Connect → Webhooks → Add a webhook
2. URL: `https://YOUR_VERCEL_URL/api/typeform`
3. Save

### Step 7: Connect Calendly webhook
1. Calendly → Integrations → API & Webhooks
2. Generate a Personal Access Token
3. Create webhook subscription:
   - URL: `https://YOUR_VERCEL_URL/api/calendly`
   - Events: `invitee.created`
4. Save

### Step 8: Test end to end
**Test disqualified:**
- Submit Typeform with budget = "Less than $1,000"
- Check GHL → Opportunities → "Youtube Funnel - Disqualified Leads" pipeline
- Should see new contact in "Free Course Sent" stage

**Test qualified:**
- Submit Typeform with budget = "$2,500 to $4,000" or higher
- Check GHL → Opportunities → "Youtube Qualified Leads" → "Awaiting Booking"
- Check Close.com → Leads → should show "NEW LEAD NO CALL BOOKED"

**Test Calendly booking:**
- Book a call using the same email as a qualified Typeform submission
- Check Close.com → lead status should change to "CALL BOOKED"
- Check Close.com → Opportunities → new opportunity should appear
- Check GHL → contact tags should include "booked-call"

---

## Future: Add Nurture Workflow for Disqualified Leads
When ready:
1. Build workflow in GHL → Automations
2. Copy the workflow ID from the URL
3. Update `GHL_DISQUALIFIED_WORKFLOW_ID` in Vercel env vars from `SKIP` to the real ID
4. Redeploy — no code changes needed

---

## Key Business Rules (do not change without updating code)
1. Branching is on `form_response.ending.ref` — not the budget answer value
2. Partial Typeform responses are ignored (skipped if no ending ref)
3. Calendly matches to Close lead by **email** — must be exact match
4. Always returns HTTP 200 to Typeform/Calendly even on errors (prevents retry floods)
5. GHL uses `contacts/upsert` — safe to call multiple times, won't create duplicates

---

## ICP Context
- Primary: Side Hustle Sam (make money online audience)
- Secondary: Time-poor 9-5 workers
- Program: $4K Etsy coaching using AI tools
- Client: Alex Ecoms (Etsy course creator)
- Partners: Sjen + Eli (ES Consulting)
