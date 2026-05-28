# Phase 11 — PWA Polish + Mobile: Manual Test Guide

This phase added an installable PWA, runtime caching for read flows, and an offline write queue (notes + tasks). These instructions cover how to verify each piece in a local Chrome session.

## 1. Start the dev server

```bash
# from repo root
npm install
npm run dev
```

This starts the Fastify API on `http://localhost:3001` and the Vite/React frontend on `http://localhost:5173`. Open the frontend in **Chrome** (or any Chromium-based browser; Safari can't show DevTools service worker UI).

> The service worker is enabled in dev (`devOptions.enabled: true`). The browser will register `/dev-sw.js?dev-sw` automatically.

## 2. Confirm the service worker is registered

1. Open Chrome DevTools (Cmd+Opt+I / F12).
2. Go to the **Application** panel.
3. Select **Service workers** in the left sidebar.
4. Expected:
   - **Source:** `dev-sw.js?dev-sw` (or `sw.js` in a production build) at `http://localhost:5173/`
   - **Status:** `activated and is running`
   - **Scope:** `http://localhost:5173/`
5. While you're there:
   - **Manifest** → confirms name `Tax Resolution CRM`, short_name `TaxCRM`, theme color `#0ea5e9`, two icons (192 + 512).
   - **Storage → Cache Storage** → after browsing, you should see `workbox-precache-*`, `contacts-cache`, `contact-detail-cache`, and `activity-cache` entries populate as you visit pages.
   - **Storage → IndexedDB → `tax-crm-offline` → `pending-writes`** — this is where queued offline writes live.

## 3. Test offline mode

1. Log in as the seeded admin (`admin@taxrelief.local` / `admin123`).
2. Navigate to `/contacts` and open any contact detail page so its data is cached (Network panel will show a `from disk cache` hit on subsequent loads).
3. In DevTools, switch to the **Network** panel and toggle **Offline** (the dropdown next to "Disable cache").
4. Expected behavior:
   - The **yellow "You're offline" banner** appears below the top nav bar.
   - Reload the contact detail page — it still loads from the Workbox cache (network is offline; SW serves the cached HTML/JS/CSS, and `contact-detail-cache` serves the `/contacts/:id` API response stale).
   - **Log a note** from the contact detail panel:
     - You'll see a green toast: "Note saved — will sync when back online".
     - The banner's queued count increments by 1.
     - In DevTools → Application → IndexedDB → `tax-crm-offline` → `pending-writes`, you'll see a row with `method: "POST"`, `url: "/contacts/<id>/activities"`, `type: "note"`.
   - **Create a task** (TasksSidebar → "+ New") while offline:
     - The form shows "Task queued for sync" then auto-closes.
     - Queue count increments again; a new row appears in the IDB store.
5. Switch Network back to **Online**. Expected:
   - The banner disappears.
   - The `useOfflineQueue` hook listens for the `window 'online'` event, calls `replayQueue(api)`, which POSTs each queued write to the live API and removes successful entries from IDB.
   - Refresh the contact page — the queued note appears in the timeline; the queued task appears in the task list.
   - The `pending-writes` IDB store is back to empty.

> Note: while offline, write API responses are not cached (only GET requests are). The Workbox cache is for **reads**; the IDB queue handles **writes**.

## 4. Test the install prompt

### Desktop Chrome
1. Visit `http://localhost:5173/` (must be `http://localhost` or HTTPS for installability).
2. Chrome shows an **Install icon** (a monitor with a down arrow) in the right edge of the address bar.
3. Click it → "Install Tax Resolution CRM?" → Install.
4. The app launches in its own window with no browser chrome, using the 192/512 PWA icons and `#0ea5e9` theme color.

### iOS Safari
1. Deploy somewhere with HTTPS (DigitalOcean for production, or run `ngrok http 5173` locally).
2. On iPhone Safari → Share sheet → "Add to Home Screen".
3. The `apple-touch-icon` (192x192 solid `#0ea5e9` PNG) appears as the app icon; `apple-mobile-web-app-capable=yes` means it launches without Safari chrome.

### Android Chrome
1. Same as desktop: an install banner / Add to Home Screen prompt appears once `beforeinstallprompt` fires.
2. The PWA icon is used on the home screen.

## 5. The `/pwa-test` debug page

Open `http://localhost:5173/pwa-test` (must be logged in; route is behind the auth guard).

What you'll see:

| Card | What it shows |
|------|---------------|
| **Service worker** | `Active` if `navigator.serviceWorker.controller` is set, otherwise `Not active`. |
| **Network** | Live `navigator.onLine` reading; flips when you toggle DevTools offline. |
| **Queued writes** | Count of items currently in the `pending-writes` IDB store. |

Three buttons:

- **Simulate Offline Note** — calls `enqueue({ url: '/contacts/test-contact/activities', method: 'POST', ... })` directly, bypassing the network. Use this to seed the queue without flipping DevTools offline. The pending count and the "Pending items" list both update.
- **Clear Queue** — wipes every entry in the `pending-writes` store.
- **Replay Queue** — manually triggers `replayQueue(api)`. If you're offline or the URL doesn't exist (`/contacts/test-contact/...`), the items stay in the queue and the activity log notes the attempt. If you're online and the URL points at a real contact, the matching write is POSTed and the item is removed.

Below the buttons:

- **Pending items** — table of every queued write with its IDB id, method, URL, type, contact id, and timestamp.
- **Activity log** — last 8 actions taken on this page (enqueue / clear / replay), each timestamped.

This page is the fastest way to verify the offline machinery without faking the network state across the rest of the app.

## 6. Running the unit tests

```bash
cd crm/frontend
npm test
```

Coverage added in this phase:

- `src/lib/offlineQueue.test.ts` — enqueue stores the item and returns an id; getQueue returns it back; dequeue removes a single item; clearQueue empties everything.
- `src/components/OfflineBanner.test.tsx` — banner is hidden when `navigator.onLine === true`; renders on the `offline` window event; disappears again on the `online` event.

Tests use `fake-indexeddb` (loaded via `src/test/setup.ts`) so IDB works in `jsdom`.

## 7. Regenerating the PWA icons

```bash
node scripts/gen-pwa-icons.js
```

This writes solid `#0ea5e9` PNGs at `crm/frontend/public/pwa-192x192.png` and `pwa-512x512.png`. The script uses `sharp` (installed as a devDependency of `@tax/frontend`). Replace the script's behavior once Katie's real brand assets land.
