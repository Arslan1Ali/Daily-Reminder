const CACHE_NAME = 'daily-reminder-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => response || fetch(event.request))
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clientList) => {
            for (const client of clientList) {
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

// Handle push events so notifications appear even when page is closed
self.addEventListener('push', (event) => {
    let payload = { title: 'Reminder', body: 'You have a task reminder.' };
    try {
        if (event.data) payload = event.data.json();
    } catch (e) {
        // Ignore parse errors and use fallback
    }

    const title = payload.title || 'Reminder';
    const options = {
        body: payload.body || '',
        tag: payload.tag || 'task-reminder',
        data: payload.data || {},
        // Add vibration pattern for supportive devices
        vibrate: payload.vibrate || [100, 50, 100]
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

// Ensure subscription refresh handling (some browsers fire this)
self.addEventListener('pushsubscriptionchange', (event) => {
    // In production you'd re-subscribe and send the new subscription to your server
    console.log('pushsubscriptionchange', event);
});
