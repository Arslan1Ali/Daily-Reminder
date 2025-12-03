import { getDb } from './db.js';

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const { subscription, tasks } = req.body;
        
        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ error: 'Missing subscription' });
        }

        const db = getDb();
        if (db) {
            // Store tasks mapped to the subscription endpoint
            // Key: "user:<endpoint_hash>" -> { subscription, tasks }
            // For simplicity in this demo, we use the endpoint URL as part of the key
            const key = `user:${Buffer.from(subscription.endpoint).toString('base64')}`;
            
            await db.set(key, { subscription, tasks });
            return res.status(200).json({ ok: true });
        } else {
            return res.status(500).json({ error: 'Database not configured (Vercel KV)' });
        }
    }
    res.status(405).end();
}
