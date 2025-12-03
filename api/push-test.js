const webpush = require('web-push');

const VAPID_PUBLIC = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const CONTACT = process.env.VAPID_CONTACT || 'mailto:example@example.com';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(CONTACT, VAPID_PUBLIC, VAPID_PRIVATE);
}

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { subscription, title, body } = req.body;
    
    // In this demo, the client sends the subscription BACK to us to test the push
    // because we don't have a database connected in this simple example.
    // In a real app, you'd fetch 'subscription' from your database.
    
    if (!subscription) {
      return res.status(400).json({ error: 'Missing subscription (pass it in body for this demo)' });
    }

    const payload = JSON.stringify({ 
      title: title || 'Reminder', 
      body: body || 'This is a test reminder.' 
    });

    try {
      await webpush.sendNotification(subscription, payload);
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Push error:', error);
      return res.status(500).json({ error: error.message });
    }
  } else {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
  }
}
