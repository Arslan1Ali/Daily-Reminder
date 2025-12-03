const webpush = require('web-push');

// Configure VAPID
const VAPID_PUBLIC = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const CONTACT = process.env.VAPID_CONTACT || 'mailto:example@example.com';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(CONTACT, VAPID_PUBLIC, VAPID_PRIVATE);
}

// In-memory store for demo purposes (Vercel functions are ephemeral, so this will reset)
// For production, you MUST use a database (MongoDB, Postgres, Redis, etc.)
// This is just to demonstrate the endpoint working for a single session or if the container is warm.
let subscriptions = []; 

// NOTE: On Vercel, you should connect to a real database (e.g. Vercel KV, MongoDB Atlas, Supabase)
// to store subscriptions persistently.

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const sub = req.body.subscription;
    if (!sub) {
      return res.status(400).json({ error: 'Missing subscription' });
    }

    // In a real app: await db.saveSubscription(sub);
    console.log('Received subscription:', sub);
    
    // For this demo, we just acknowledge it. 
    // Without a DB, we can't really store it persistently in a serverless function.
    return res.status(201).json({ ok: true, warning: "Subscription received but not stored persistently (add a DB!)" });
  } else {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
  }
}
