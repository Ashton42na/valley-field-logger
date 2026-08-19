# Valley Field Logger

## App Info
- Live URL: https://glittering-semifreddo-dea3d3.netlify.app
- GitHub Repo: valley-field-logger
- Local Folder: C:\Users\AFortuna\valley-field-logger

## To run locally
npm run dev

## To push updates live
git add .
git commit -m "your message"
git push

## API Keys needed
- Google Places API Key (enter in app Settings)
- Anthropic API Key (enter in app Settings)
Get Google key at: console.cloud.google.com
Get Anthropic key at: console.anthropic.com

## Sync to remote tracker
The app stores visits locally in IndexedDB and pushes them to the tracker when a Field Logger Key is set.
Configure in Settings:
- Tracker URL — defaults to `https://tracker.vtlinsider.com`. Visits are POSTed to `<url>/api/visits`. Must be `https://` (or `http://localhost` for dev).
- Field Logger Key — the `flk_…` key from the portal (My Field Logger). Sent as `X-FIELD-LOGGER-KEY`. This is both how the app authenticates and how visits are credited to you. Required to sync.

Behavior:
- Visits are queued locally and flushed when the device is online, after each save (debounced), and on demand via "Sync Now". Bursty triggers are coalesced into a single flush.
- Each request includes a stable `visitUid` and a `deviceId` so the tracker can de-dupe; `409 Conflict` is treated as success.
- Failed deliveries are retried with exponential backoff (1s, 2s, 4s, … capped at 5 min) up to 5 attempts, then marked permanently failed. "Sync Now" resets failed rows to pending so they retry immediately.
- Server response bodies are sanitized (length-capped, control chars stripped, API key redacted) before being persisted or rendered.
- Sync status (pending / sent / failed) and the last 100 sync log entries are visible in Settings.

## Data storage
- Visits: IndexedDB (`vfl-db`, store `visits`). Schema is versioned; migrations run automatically on first open.
- Settings (Anthropic key, Field Logger Key, sync URL, device ID, sync log): browser `localStorage` under `vfl-*` keys. The Field Logger Key is sent only as the `X-FIELD-LOGGER-KEY` header on visit ingest — never in the JSON body.

## Built with
- React + Vite
- IndexedDB via [`idb`](https://github.com/jakearchibald/idb)
- Deployed on Netlify
