import { findCloseLeadByEmail, createCloseNote } from './lib/close.js';

async function test() {
    try {
        const email = 'alex@alexecomsales.com'; // Try to match an actual sample
        console.log("Looking for lead:", email);
        const lead = await findCloseLeadByEmail(email);

        if (!lead) {
            console.log("No lead found to test. Close returned nothing for", email);
            return;
        }

        console.log("Found lead:", lead.id);
        console.log("Creating note...");
        const result = await createCloseNote(lead.id, "Test note: checking if notes work in Close UI!");

        console.log("Success! Close returned:");
        console.log(JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("Failed to create note!");
        console.error(err.message);
    }
}

test();
