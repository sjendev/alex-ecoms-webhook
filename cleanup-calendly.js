const token = process.argv[2];
const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
};

async function run() {
    try {
        const meRes = await fetch('https://api.calendly.com/users/me', { headers });
        const meData = await meRes.json();
        const userUri = meData.resource.uri;
        const orgUri = meData.resource.current_organization;

        // Check ORG
        const orgUrl = `https://api.calendly.com/webhook_subscriptions?scope=organization&organization=${encodeURIComponent(orgUri)}`;
        const orgRes = await fetch(orgUrl, { headers });
        const orgHooks = (await orgRes.json()).collection || [];

        // Check USER
        const userUrl = `https://api.calendly.com/webhook_subscriptions?scope=user&user=${encodeURIComponent(userUri)}`;
        const userRes = await fetch(userUrl, { headers });
        const userHooks = (await userRes.json()).collection || [];

        const allHooks = [...orgHooks, ...userHooks];
        console.log(`Found ${orgHooks.length} ORG hooks and ${userHooks.length} USER hooks.`);

        const vercelHooks = allHooks.filter(w => w.callback_url.includes('alex-ecoms-webhook'));

        if (vercelHooks.length <= 1) {
            console.log(`Only ${vercelHooks.length} webhook(s) pointing to Vercel overall. No duplicates!`);
            return;
        }

        console.log(`Found ${vercelHooks.length} webhooks pointing to Vercel app in total! Deleting extras...`);
        const hooksToDelete = vercelHooks.slice(1);

        for (const hw of hooksToDelete) {
            console.log(`Deleting duplicate: ${hw.uri}`);
            await fetch(hw.uri, { method: 'DELETE', headers });
        }
        console.log("Deleted duplicates.");
    } catch (err) {
        console.error("Error:", err.message);
    }
}

run();
