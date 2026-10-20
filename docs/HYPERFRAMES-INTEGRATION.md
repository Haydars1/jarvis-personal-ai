# HyperFrames integration for hayırlıevlad

Source: https://github.com/heygen-com/hyperframes
Docs: https://hyperframes.heygen.com/guides/rendering

## Implemented

- Protected POST /api/video-pool/hyperframes/project creates a HyperFrames-compatible HTML composition for 9:16 Reels or 16:9 landscape, with a paused GSAP timeline and validated, escaped text.
- Video AI Havuzu has a HyperFrames project form and HTML download action.
- HyperFrames is in the source repository catalog as local-only; automatic third-party code execution is disabled.
- local-bridge/hyperframes-bridge.mjs supports doctor, lint, check, preview and render using a locally installed HyperFrames CLI without auto-install.

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

The endpoint prepares editable HTML, not a finished MP4. Cloudflare Workers cannot execute the heavy Chromium / FFmpeg stack. Actual MP4 requires the configured local machine or a separate container service. Automated remote rendering, an AI multi-scene director, durable job queue, storage and permissions are not included. Nothing is deployed by this PR; merging and deploying must be separately verified. Only process media you have permission to use.
