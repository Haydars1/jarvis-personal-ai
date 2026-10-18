---
name: moneyprinterturbo-video-production
description: Produce short videos from a topic using the official MoneyPrinterTurbo agent skill, with licensed footage, subtitles, voice and soundtrack. Requires a Python-capable runner; this repository's Cloudflare Worker cannot execute video rendering.
license: MIT
---
# MoneyPrinterTurbo — video production skill

Official project: https://github.com/harry0703/MoneyPrinterTurbo
Official agent skill: https://raw.githubusercontent.com/harry0703/MoneyPrinterTurbo/main/docs/skill/SKILL.md

## What this does
User provides topic, language, style, duration and aspect ratio (9:16, 16:9, 1:1). Generate an original script, match licensed stock footage or user-provided assets, synthesize speech, subtitles, soundtrack, then render and return a video artifact.

## Agent execution contract
1. Confirm the topic, target audience and output format; use reasonable defaults when omitted.
2. If a local/remote Python runner is available, install official maintained package in an isolated virtualenv: `python -m pip install mpt` (Python >=3.11), or follow upstream Docker instructions. Do not install unofficial similarly named packages.
3. Follow the upstream skill's current instructions and verify the actual CLI via `mpt cli --help`; do not guess CLI flags.
4. Use configured provider credentials only on the server, never embed keys in client-side JS or git.
5. Use the stock footage sources and licenses allowed by the user's account; reject unlicensed copyrighted media.
6. Generate and review a low-cost preview before running expensive full-quality jobs.
7. Store output artifact and return a download link and production manifest; label unavailable stages accurately.
8. External publication is a separate action and requires explicit user approval.

## JARVIS architecture
Cloudflare Worker: authenticated job intake, queue/status, user approval, durable metadata.
Python runner (separate process): official MoneyPrinterTurbo, FFmpeg, media downloads and rendering.
Storage: R2/object store for video assets; D1 for job metadata. Never render HD video inside a Worker request.
Runner interface: `POST /jobs`, `GET /jobs/{id}`, `POST /jobs/{id}/cancel`, `GET /jobs/{id}/result`; implement and secure these endpoints before enabling production.
Secrets: MPT_RUNNER_TOKEN, model/TTS/stock media keys only in server secret manager.

## Verification
- Runner actually starts and reports version
- `mpt cli --help` passes
- Sample video renders and is playable
- Video includes correct script, licensed assets, voice and subtitles
- 9:16, 16:9, 1:1 tested
- Cost/permission gate works before external paid APIs
- JARVIS can fetch job status and finished artifact
- ChatGPT: can inspect the upstream skill, plan jobs and work with local media in a supported session; this file does NOT install an app into ChatGPT's core runtime.
