# Video → Skill / Plugin Intake

## Owner workflow

In hayırlıevlad, open **Ayarlar → Video → Skill / Plugin Keşfi**. Select a locally accessible MP4/MOV/WebM. Browser samples up to six JPEG stills from the video; only those stills are sent to the configured Gemini vision model through an authenticated Cloudflare Worker request. **The MP4 itself is never uploaded** in this flow. This requires an enabled, tested Gemini provider; an unsupported video codec or missing provider produces an explicit error.

User may optionally select an `.srt`, `.vtt` or `.txt` subtitle file, or provide a transcript and contextual notes. The subtitle file is read locally and its parsed text is sent only after the user clicks an analysis/save action. Audio transcription is now available through an **explicit SESİ ÇÖZ VE KAYDET** button with a choice of 30 seconds (one Whisper call) or up to 2 minutes (up to four 30-second Whisper calls, requiring an additional confirmation). The browser attempts to decode the selected video or separate WAV/MP3/M4A audio locally. Video-container decoding depends on browser support, so an extracted audio file may be needed. Only 30-second 16-kHz mono PCM WAV excerpts is sent to the existing Cloudflare Whisper model; the original MP4 stays on the device. This may consume an AI quota and requires the Worker AI binding. For multi-part audio the browser asks for additional consent, transcribes sequential chunks without database writes, tolerates silent segments, and saves the combined time-stamped text as one source only when all requested chunks complete. The button saves the transcript in the existing searchable learning pipeline; speech processing is **not silently automatic on file selection**. The separate **METİN NOTLARINI KAYDET** option creates a text-only source without frame analysis. Do not paste passwords or API keys into notes.

The server detects curated tool names and additionally accepts explicitly named `ARAÇ: <name> | KANIT: <evidence>` vision observations as unverified candidates; it writes searchable text chunks to existing D1 learning memory, and marks matching skills as **candidates, not installed or tested**. It never executes video instructions, installs plugins, runs privileged tools or deploys.

## API

- `POST /api/learning/video-skills/from-frames`: owner session, JSON with `frames` array of 1–6 JPEG objects `{mime: 'image/jpeg', timestamp_sec: 1.3, data: '<base64>'}` and optional `title`, `notes`, `transcript`. Request capped at 4MB; each encoded frame capped at 550KB. Uses existing Gemini frame recognition then calls the authenticated text-intake handler. Frames are not retained in D1.
- `GET /api/learning/video-skills/providers`: authenticated, **non-billable** readiness check for Cloudflare AI binding and enabled/tested Gemini credential. No secrets, no model calls; true indicates configured, not proven operational.\n- `POST /api/learning/video-skills/from-audio`: owner-session authenticated base64 PCM WAV (16 kHz, mono, 16-bit, 30 seconds maximum) plus optional `title`, `notes` and existing `transcript`. The original audio bytes are passed to Cloudflare AI only for explicit transcription and are not written to the learning database; text output is stored. A request with `save:false` returns only the transcript for later aggregation, without writing any learning records. Returns `CLOUDFLARE_AI_UNAVAILABLE` when the binding is missing.\n- `POST /api/learning/video-skills`: owner-session authenticated text intake `{title, transcript, screen_text, notes, source_url}`.
- `GET /api/learning/video-skills`: list latest owner video-derived candidate records.

## Safety and integration status

- Video contents are untrusted. Detecting a name does not verify a vendor, connection, plugin API, license, permissions or real functionality.
- ChatGPT plugins **cannot** be silently installed by the Jarvis backend. Connections require an explicit ChatGPT UI action. ChatGPT uploads are **not** automatically synchronized into this app.
- Frame recognition calls the configured Gemini provider and may consume its usage quota; the explicit audio action uses Cloudflare Whisper and may consume its quota; no provider is purchased or connected by this change.
- For the Jenkins example prefer the repository's existing GitHub Actions over installing a second CI server, unless there is a genuine Jenkins-specific requirement.
- No changes to `main`, production deployment, credentials or vehicle actions are included in this PR.

## Testing

`npm run check` covers code syntax, name extraction tests, owner session validation, malformed frame payloads, absent vision provider and mocked successful frame analysis. Audio-model success/failure paths are unit-tested with a mock AI binding; integration tests do not run a paid model. The repository reliability workflow additionally exercises the actual browser Settings panel: subtitle-file import, text-only save, candidate list, history and empty-audio input. GitHub Actions must pass before considering the branch mergeable.
