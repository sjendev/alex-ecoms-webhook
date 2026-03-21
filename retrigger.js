#!/usr/bin/env node
// Manual retrigger script for missed Calendly webhooks
import 'dotenv/config';
import { findCloseLeadByEmail, createCloseLead, createCloseOpportunity, updateCloseLeadStatus, createCloseNote, findOpportunityByCalendlyUri } from './lib/close.js';
import { createGHLContact } from './lib/ghl.js';
import { sendSlackMessage } from './lib/slack.js';

const bookings = [
  {
    firstName: 'Michael',
    lastName: 'Courcelle',
    email: 'iesinvestor@gmail.com',
    eventName: 'Strategy Session IG',
    startTime: '2026-03-17T19:00:00Z', // 2pm EST
    endTime:   '2026-03-17T19:45:00Z', // 2:45pm EST
    zoomLink:  'Google Meet (link not captured)',
    source:    'instagram',
  },
  // Add more entries here as needed
];

async function formatTime(startTime) {
  if (!startTime) return 'N/A';
  const d = new Date(startTime);
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    timeZone: 'America/New_York',
    timeZoneName: 'short'
  }).format(d);
}

async function processBooking(booking) {
  const { firstName, lastName, email, eventName, startTime, endTime, zoomLink, source } = booking;
  const isInstagram = source === 'instagram';
  const fullName = `${firstName} ${lastName}`;
  const eventUri = `manual-retrigger-${email}-${startTime}`; // synthetic URI for dedup

  console.log(`\n── Processing: ${fullName} (${email}) ──`);

  // 1. Find or create Close lead
  let closeLead = await findCloseLeadByEmail(email);
  if (!closeLead) {
    console.log(`  Creating new Close lead...`);
    const closeSource = isInstagram ? 'Instagram Booking' : 'YouTube Booking';
    closeLead = await createCloseLead(
      { firstName, lastName, email, phone: '', budgetLabel: '', experience: '', situation: '' },
      closeSource
    );
    console.log(`  Created lead: ${closeLead.id}`);
  } else {
    console.log(`  Found existing lead: ${closeLead.id}`);
  }

  // 2. Update status to CALL BOOKED
  await updateCloseLeadStatus(closeLead.id, 'CALL BOOKED');
  console.log(`  Status → CALL BOOKED`);

  // 3. Check for duplicate opportunity
  const existingOpp = await findOpportunityByCalendlyUri(closeLead.id, eventUri);
  if (existingOpp) {
    console.log(`  Opportunity already exists (${existingOpp.id}), skipping.`);
    return;
  }

  // 4. Create opportunity
  const opp = await createCloseOpportunity(
    closeLead.id,
    { email, firstName, lastName },
    { uri: eventUri, start_time: startTime, name: eventName }
  );
  console.log(`  Opportunity created: ${opp.id}`);

  // 5. GHL contact
  try {
    const sourceTags = isInstagram ? ['qualified', 'booked-call', 'instagram'] : ['qualified', 'booked-call', 'youtube'];
    await createGHLContact(
      { firstName, lastName, email, phone: '', budgetLabel: '', experience: '', situation: '' },
      sourceTags
    );
    console.log(`  GHL contact updated`);
  } catch (ghlErr) {
    console.warn(`  GHL skipped (${ghlErr.message})`);
  }

  // 6. Create note
  const formattedStart = await formatTime(startTime);
  let durationStr = '45 minutes';
  if (startTime && endTime) {
    const diffMins = Math.round((new Date(endTime) - new Date(startTime)) / 60000);
    if (diffMins > 0) durationStr = `${diffMins} minutes`;
  }
  const noteContent = `${eventName} - ${fullName}\n\nStart Time: ${formattedStart}\nDuration: ${durationStr}\n\nLocation: ${zoomLink}`;
  await createCloseNote(closeLead.id, noteContent);
  console.log(`  Note created`);

  // 7. Slack
  const slackEmoji = isInstagram ? '📱' : '🎥';
  const slackSource = isInstagram ? 'Instagram' : 'YouTube';
  const slackMessage = `${slackEmoji} *New ${slackSource} Call Booked!*\n\n*Name:* ${fullName}\n*Email:* ${email}\n*Event:* ${eventName}\n*Start Time:* ${formattedStart}`;
  await sendSlackMessage(slackMessage, process.env.SLACK_CALLS_WEBHOOK_URL);
  console.log(`  Slack notification sent`);

  console.log(`  ✓ Done: ${fullName}`);
}

(async () => {
  for (const booking of bookings) {
    try {
      await processBooking(booking);
    } catch (err) {
      console.error(`  ERROR for ${booking.email}:`, err.message);
    }
  }
  console.log('\nAll done.');
})();
