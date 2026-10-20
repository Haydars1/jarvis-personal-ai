# HyperFrames integration for hayırlıevlad

Source: https://github.com/heygen-com/hyperframes
Docs: https://hyperframes.heygen.com/guides/rendering

## Implemented

- Protected POST /api/video-pool/hyperframes/project creates a HyperFrames-compatible HTML composition for 9:16 Reels or 16:9 landscape, with a paused GSAP timeline and validated, escaped text.
- Video AI Havuzu has a HyperFrames project form and HTML download action.
- HyperFrames is in the source repository catalog as local-only; automatic third-party code execution is disabled.
- local-bridge/hyperframes-bridge.mjs supports doctor, lint, check, preview and render using a locally installed HyperFrames CLI without auto-install.


## One-click cloud MP4 inside the app (new, not yet deployed)

- In Video AI Havuzu, fill in the title, subtitle, format and duration.
- Click **MP4 BULUTTA OLUŞTUR** to dispatch a separate **GitHub Actions workflow** on the default branch. The user's Windows PC does not need to be online.
- The app polls job status and downloads the completed Actions artifact using a server-side GitHub credential. The client locally extracts final.mp4 from the ZIP using browser-supported DeflateRaw decompression, downloads the MP4 and displays it in an HTML5 video preview. Browsers without ZIP decompression receive the ZIP file instead.
- The render job ID is stored locally so that the status can be resumed after reopening the page. Up to **3 manually initiated jobs per hour** are allowed per instance.
- Repo owner/repo must be Haydars1/jarvis-personal-ai in the app's encrypted GitHub credential manager, and that token needs Actions workflow dispatch/read permission. Missing or insufficient credentials are reported; no fake completed videos.
- Rendering runs on GitHub's Ubuntu runner with a pinned HyperFrames npm version (0.8.167), isolated per workflow execution, hard timeout of 20 minutes, max output size 20 MiB, and artifacts retained for three days. GitHub Actions availability and account usage limits apply.

Cloud workflow: .github/workflows/hyperframes-render.yml
Trusted runner: .github/scripts/hyperframes-render.mjs
Worker integration: src/application/video/hyperframes-cloud.js
API endpoints (all require app login):
- POST /api/video-pool/hyperframes/render
- GET /api/video-pool/hyperframes/render-status/:jobId
- GET /api/video-pool/hyperframes/render-download/:jobId

**Important:** Production is not yet deployed. The GitHub Actions workflow_dispatch endpoint becomes usable only after the workflow is merged to main and the Worker is redeployed. Unit/CI syntax checks do not prove a real MP4 render. A real dispatched Actions run and its resulting video must be tested before calling end-to-end operation verified.

## Windows setup for actual MP4

1. In the hayırlıevlad web app, open Video AI Havuzu and download the generated index.html.
2. Save index.html in its own project folder, e.g. C:\HyperFrames\6006-video\
3. Install Node.js 22+ and FFmpeg as needed. In a terminal, change to that project folder and explicitly run:
   npm install --save-dev hyperframes
4. Verify:
   npx hyperframes doctor
   npx hyperframes lint
   npx hyperframes check
5. Render:
   npx hyperframes render --output final.mp4

If the hayırlıevlad repo is cloned locally, the optional bridge can be called from its root:
   node local-bridge/hyperframes-bridge.mjs render "C:\HyperFrames\6006-video"

Other supported actions are doctor, lint, check and preview. The bridge is strictly local, has no server listener and does not install npm dependencies.

## Development tests

   node --test tests/hyperframes-video.test.js
   npm run check
   npx wrangler deploy --dry-run

## Boundaries

The endpoint prepares editable HTML, not a finished MP4. Cloudflare Workers cannot execute the heavy Chromium / FFmpeg stack. Actual MP4 requires the configured local machine or the separate GitHub Actions workflow. Automated remote rendering, an AI multi-scene director, durable job queue, storage and permissions are not included. Nothing is deployed by this PR; merging and deploying must be separately verified. Only process media you have permission to use.
