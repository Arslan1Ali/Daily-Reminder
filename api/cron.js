import { getDb } from './db.js';
const webpush = require('web-push');

// Configure VAPID
const VAPID_PUBLIC = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const CONTACT = process.env.VAPID_CONTACT || 'mailto:example@example.com';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails(CONTACT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export default async function handler(req, res) {
    // Vercel Cron authentication
    // const authHeader = req.headers.authorization;
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { return res.status(401).end('Unauthorized'); }

    const db = getDb();
    if (!db) return res.status(500).json({ error: 'No DB' });

    // 1. Scan all users
    // In production, use a more efficient data structure (e.g., sorted sets by time)
    const keys = await db.keys('user:*');
    let notificationsSent = 0;

    const now = new Date();
    const currentHour = String(now.getHours()).padStart(2, '0');
    const currentMinute = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${currentHour}:${currentMinute}`;

    for (const key of keys) {
        const userData = await db.get(key);
        if (!userData || !userData.tasks || !userData.subscription) continue;

        const { tasks, subscription } = userData;
        const dueTasks = tasks.filter(t => !t.completedToday && t.dueTime <= currentTime);

        // Simple logic: If any task is due and not completed, send a generic reminder
        // A real implementation would track "lastAlertTime" per task on the server to avoid spamming
        if (dueTasks.length > 0) {
            const taskTitles = dueTasks.map(t => t.title).join(', ');
            const payload = JSON.stringify({
                title: 'Task Reminder',
                body: `You have due tasks: ${taskTitles}`,
                tag: 'daily-reminder'
            });

            try {
                await webpush.sendNotification(subscription, payload);
                notificationsSent++;
            } catch (err) {
                if (err.statusCode === 410) {
                    // Subscription expired, delete user
                    await db.del(key);
                }
                console.error('Push failed', err);
            }
        }
    }

    res.status(200).json({ success: true, notificationsSent });
}
