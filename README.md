# Alex Ecoms — Webhook Automation

Typeform → GHL + Close.com lead routing for the Alex Ecoms VSL funnel.

---

## Flow

```
Typeform Submit
├── DISQUALIFIED (< $1k budget)
│   ├── GHL: Create contact (tags: disqualified, free-course)
│   └── GHL: Enrol in nurture workflow
│
└── QUALIFIED (≥ $1k budget)
    ├── GHL: Create contact (tags: qualified, awaiting-booking)
    ├── GHL: Add to qualified pipeline
    └── Close.com: Create lead (status: Potential)

Calendly Booking (invitee.created)
├── Close.com: Find lead by email → Create Opportunity (status: Active)
└── GHL: Update contact tags → booked-call
```

---

## Deploy to Vercel

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Clone / open this project in your IDE, then deploy
```bash
cd alex-ecoms-webhook
vercel
```
Follow the prompts — link to your Vercel account, create a new project.

### 3. Add environment variables in Vercel dashboard
Go to your project → **Settings** → **Environment Variables** and add all values from `.env.example`:

| Variable | Where to find it |
|---|---|
| `GHL_API_KEY` | GHL → Settings → Integrations → API Keys |
| `GHL_LOCATION_ID` | GHL → Settings → Business Profile |
| `GHL_DISQUALIFIED_WORKFLOW_ID` | GHL → Automations → open your nurture workflow → copy ID from URL |
| `GHL_QUALIFIED_PIPELINE_ID` | GHL → Opportunities → Pipelines → copy pipeline ID from URL |
| `GHL_QUALIFIED_STAGE_ID` | Same pipeline page → click the stage → copy stage ID |
| `CLOSE_API_KEY` | Close → Settings → API Keys → Generate |

### 4. Redeploy after adding env vars
```bash
vercel --prod
```

Your webhook URLs will be:
- `https://YOUR_PROJECT.vercel.app/api/typeform`
- `https://YOUR_PROJECT.vercel.app/api/calendly`

---

## Connect Typeform

1. Typeform → your form → **Connect** → **Webhooks** → **Add a webhook**
2. URL: `https://YOUR_PROJECT.vercel.app/api/typeform`
3. Save — done

---

## Connect Calendly

1. Calendly → **Integrations** → **API & Webhooks**
2. Generate a **Personal Access Token**
3. Create a webhook subscription:
   - URL: `https://YOUR_PROJECT.vercel.app/api/calendly`
   - Events: `invitee.created`
4. Save

---

## Test It

**Typeform disqualified path:**
- Submit form with budget = "Less than $1,000"
- Check Vercel function logs
- Verify contact appears in GHL with `disqualified` tag + enrolled in nurture workflow

**Typeform qualified path:**
- Submit form with budget = "$2,500 to $4,000" or higher
- Verify GHL contact with `qualified` tag + pipeline stage
- Verify Close.com lead created with status Potential

**Calendly booking:**
- Book a call using the same email as a qualified Typeform submission
- Verify Close.com lead upgraded to Opportunity
- Verify GHL contact tag updated to `booked-call`

---

## Logs

View real-time logs in Vercel dashboard → your project → **Functions** tab.
Or via CLI: `vercel logs`
