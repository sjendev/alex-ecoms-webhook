# Alex Ecoms Webhook

Vercel serverless webhook system routing Typeform leads → GHL + Close.com, and Calendly bookings → Close.com.

**Live URL:** `https://alex-ecoms-webhook-gamma.vercel.app`

## Flow
- Typeform qualified → GHL contact + Close lead (status: NEW LEAD NO CALL BOOKED)
- Typeform disqualified → GHL contact only
- Calendly booking → Close status → CALL BOOKED + opportunity + note with Zoom link

## Calendly Links
- IG: `https://calendly.com/riley-alexecomsales/strategy-session-ig`
- YT: `https://calendly.com/riley-alexecomsales/30min`

Detection in `api/calendly.js` uses `eventName.toLowerCase().includes('ig')` — IG events must have "ig" in the Calendly event type name.

## Key IDs
- GHL Location: `vQF42dKTFoRn30T8YNse`
- Qualified pipeline: `Or6oHwwuXmA3jnCrUCWS`
- Disqualified pipeline: `rmv3B4fAzJk1Ncj9Mphg`
- Typeform form: `HBZFtBLy`
- Qualified ending ref: `cc0d67cf-2599-43aa-982e-b8c07d6dca35`
- Disqualified ending ref: `902bf817-f78e-430e-b43e-e48dd23deffa`

## Files
- `api/typeform.js` — main routing logic
- `api/calendly.js` — booking handler
- `lib/close.js` — Close API helpers
- `lib/ghl.js` — GHL API helpers
- `lib/typeform.js` — payload parser

## Deploy
```bash
git add . && git commit -m "message" && git push origin main
```
Vercel auto-deploys on push.