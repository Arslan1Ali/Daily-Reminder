# Daily Task Reminder — Push Notifications & Deployment Guide

This project is a minimal SPA that demonstrates reminders, escalation, speech, and offline support. To show notifications when the app is closed (notification shade on mobile), you must use the Web Push API backed by a server that can send push messages to the browser's push service using VAPID keys.

## Quick summary
- Client: subscribes to PushManager and sends subscription to your server (`/api/subscribe`).
- Service Worker: handles `push` events and displays notifications even when the page is closed.
- Server: stores subscriptions and uses `web-push` with VAPID keys to send pushes.

## Generate VAPID keys
Run locally where you manage server code:

```powershell
npx web-push generate-vapid-keys --json
```

This prints `publicKey` and `privateKey`. Keep the private key secret.

## Environment variables for the server
- `VAPID_PUBLIC` — public VAPID key
- `VAPID_PRIVATE` — private VAPID key
- `VAPID_CONTACT` — contact e-mail (e.g. `mailto:admin@example.com`)

## Example: Run the demo server locally

```powershell
cd server
npm install
$Env:VAPID_PUBLIC = "<your-public-key>"
$Env:VAPID_PRIVATE = "<your-private-key>"
node index.js
```

Then open the SPA at `http://localhost:8000`, click **Enable**, create a task, and use `POST http://localhost:3000/api/push-all` to trigger a push (for testing).

## GitHub & Vercel Deployment
- Push the repo to GitHub:

```powershell
git init
git add .
git commit -m "Initial reminder app"
git remote add origin <git-repo-url>
git push -u origin main
```

- Deploy to Vercel:
  - If you have the server code, convert the server endpoints into Vercel Serverless Functions under `api/` (see `server/` for Express example).
  - Add VAPID env vars in Vercel dashboard (`VAPID_PUBLIC`, `VAPID_PRIVATE`, `VAPID_CONTACT`).
  - Vercel will build and host your static app; serverless functions will handle subscriptions and sending push messages.

## Browser support & caveats
- Push support is best on Chrome (desktop + Android). Browser support varies; check up-to-date compatibility for target platforms.
- iOS Safari historically had limited Web Push support; behavior depends on the iOS and Safari versions.
- For reliable background reminders when the app is closed, server-side push scheduling is recommended. The client-side scheduler is only active while the app/tab is open.

## Next steps I can implement for you
- Convert `server/index.js` into Vercel `api/subscribe.js` and `api/push-all.js` functions.
- Add a small admin UI to the SPA to trigger pushes for testing.
- Add CI workflow to build and deploy to Vercel automatically.

Tell me which of the above you want me to implement next and I'll proceed.
