import { createClient } from '@vercel/kv';

// Helper to get DB client
// You must add Vercel KV to your project: https://vercel.com/docs/storage/vercel-kv
export function getDb() {
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        console.warn("Vercel KV not configured. Tasks won't persist on server.");
        return null;
    }
    return createClient({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
    });
}
