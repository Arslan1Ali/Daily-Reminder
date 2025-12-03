const express = require('express');
const bodyParser = require('body-parser');
const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

const SUBS_FILE = path.join(__dirname, 'subscriptions.json');
function loadSubs() {
  try {
    return JSON.parse(fs.readFileSync(SUBS_FILE));
  } catch (e) {
    return [];
  }
}
function saveSubs(subs) {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
}

const app = express();
app.use(bodyParser.json());

// Configure VAPID from env
const VAPID_PUBLIC = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const CONTACT = process.env.VAPID_CONTACT || 'mailto:you@example.com';
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(CONTACT, VAPID_PUBLIC, VAPID_PRIVATE);
} else {
  console.warn('VAPID keys not set. Set VAPID_PUBLIC and VAPID_PRIVATE environment variables.');
}

// Endpoint to receive subscription from client and store it
app.post('/api/subscribe', (req, res) => {
  const sub = req.body.subscription;
  if (!sub) return res.status(400).json({ error: 'Missing subscription' });

  const subs = loadSubs();
  // naive dedupe by endpoint
  if (!subs.find(s => s.endpoint === sub.endpoint)) {
    subs.push(sub);
    saveSubs(subs);
  }
  res.status(201).json({ ok: true });
});

// Endpoint to trigger a push to all stored subscriptions (for testing)
app.post('/api/push-all', async (req, res) => {
  const { title = 'Reminder', body = 'You have a task due.' } = req.body || {};
  const payload = JSON.stringify({ title, body });

  const subs = loadSubs();
  const results = [];
  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, payload);
      results.push({ endpoint: sub.endpoint, ok: true });
    } catch (err) {
      results.push({ endpoint: sub.endpoint, ok: false, error: err.message });
    }
  }

  res.json({ results });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Push server listening on ${PORT}`));
