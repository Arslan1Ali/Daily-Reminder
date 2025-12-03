# Server example for Daily Task Reminder

This folder shows a minimal Express-based server that stores push subscriptions and can send Web Push notifications using `web-push`.

Important notes:

- Generate VAPID keys with `npx web-push generate-vapid-keys` and set `VAPID_PUBLIC` and `VAPID_PRIVATE` as environment variables.
- The server stores subscriptions in `subscriptions.json` (file-based, for demo only). In production use a database.
- To send a push to all subscribers (for testing):

  POST /api/push-all
  Body: { "title": "Reminder", "body": "Task is due" }

- To receive subscriptions from the client, the client calls POST /api/subscribe with `{ subscription }`.

Deployment:

- You can deploy this app separately (Heroku, DigitalOcean, Vercel serverless functions, etc.). For Vercel, implement serverless functions under the `api/` directory instead of a long-running Express server.

Security:

- Protect endpoints and secrets. Use HTTPS in production.

