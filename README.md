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
- Google Places API Key is held by the Netlify `places` function (`GOOGLE_PLACES_API_KEY`). It is not entered in the app.
- Company AI (voice-note cleanup and business-card scan) is provided by Valley Techlogic via the tracker. Paste a Field Logger Key from My Field Logger — you do not need an Anthropic or OpenRouter key on the phone.

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

## Visit history
Search results show a count pill when this device or a teammate has already logged that *physical location* — not just the same company name. Two buildings with the same name stay separate. The pill is green for a prior visit, amber `Due` when a follow-up date is today or overdue, red `Skip` when the last visit was Not Interested within 90 days, and muted `Today` if you already logged it today.

Nearby re-ranks: follow-ups first, never-visited next, already-today / recent not-interested last.

On Log Visit, a Previous visits panel sits below Voice Note with last contact, outcome, temperature, and one-tap reuse of the last contact. History is read-only except that reuse button.

Team history uses the same Tracker URL and Field Logger Key as visit ingest (`GET /api/visits/history` and `POST /api/visits/history-batch` on the tracker). The portal is VPN-only and is never called from the phone. Offline, cached team rows from the last 24 hours still show; otherwise the pill and timeline fall back to this device.

## Data storage
- Visits: IndexedDB (`valley-field-logger`, store `visits`). Schema is versioned; migrations run automatically on first open. v3 adds `placeId` so history can key off the Google Place, not just the name.
- Settings (Field Logger Key, sync URL, device ID, sync log): browser `localStorage` under `vfl-*` keys. The Field Logger Key is sent only as the `X-FIELD-LOGGER-KEY` header on visit ingest, history lookup, and company AI (`/api/ai/*`) — never in the JSON body. The OpenRouter key never lands on the device.

## Built with
- React + Vite
- IndexedDB via [`idb`](https://github.com/jakearchibald/idb)
- Deployed on Netlify
