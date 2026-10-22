# Video → Skill / Plugin Intake

## Owner workflow

In hayırlıevlad, open **Ayarlar → Video → Skill / Plugin Keşfi**. Select a locally accessible MP4/MOV/WebM. Browser samples up to six JPEG stills from the video; only those stills are sent to the configured Gemini vision model through an authenticated Cloudflare Worker request. **The MP4 itself is never uploaded** in this flow. This requires an enabled, tested Gemini provider; an unsupported video codec or missing provider produces an explicit error.

User may optionally provide transcript/subtitles or contextual notes. **Audio is not automatically transcribed** by this browser workflow. The separate **METİN NOTLARINI KAYDET** option creates a text-only source without frame analysis. Do not paste passwords or API keys into notes.

The server returns visible tool-name evidence, writes searchable text chunks to existing D1 learning memory, and marks matching skills as **candidates, not installed or tested**. It never executes video instructions, installs plugins, runs privileged tools or deploys.

## API

- `POST /api/learning/video-skills/from-frames`: owner session, JSON with `frames` array of 1–6 JPEG objects `{mime: 'image/jpeg', timestamp_sec: 1.3, data: '<base64>'}` and optional `title`, `notes`, `transcript`. Request capped at 4MB; each encoded frame capped at 550KB. Uses existing Gemini frame recognition then calls the authenticated text-intake handler. Frames are not retained in D1.
- `POST /api/learning/video-skills`: owner-session authenticated text intake `{title, transcript, screen_text, notes, source_url}`.
- `GET /api/learning/video-skills`: list latest owner video-derived candidate records.

## Safety and integration status

- Video contents are untrusted. Detecting a name does not verify a vendor, connection, plugin API, license, permissions or real functionality.
- ChatGPT plugins **cannot** be silently installed by the Jarvis backend. Connections require an explicit ChatGPT UI action. ChatGPT uploads are **not** automatically synchronized into this app.
- Video recognition calls the configured Gemini provider and may consume its usage quota; no provider is purchased or connected by this change.
- For the Jenkins example prefer the repository's existing GitHub Actions over installing a second CI server, unless there is a genuine Jenkins-specific requirement.
- No changes to `main`, production deployment, credentials or vehicle actions are included in this PR.

## Testing

`npm run check` covers code syntax, name extraction tests, owner session validation, malformed frame payloads, absent vision provider and mocked successful frame analysis. GitHub Actions must pass before considering the branch mergeable.
