# adewaskar/jarvis integration

Source: https://github.com/adewaskar/jarvis
License: MIT

## Why it is useful

- Browser voice loop with wake word / local VAD / barge-in
- Headless agent bridge pattern
- MCP-style tool access with a permission gate
- Capability detection and graceful voice fallbacks
- HUD/display concepts for rich media
- Diagnostics-oriented runtime behavior

## What to reuse conceptually in JARVIS Personal AI

1. **Action-first agent bridge**
   - Keep chat as the interface, but route actionable requests to tools/capabilities first.
   - Preserve a permission gate for effectful operations.
2. **Voice reliability**
   - Local VAD-like interruption semantics.
   - Barge-in: user speech should stop current TTS immediately.
   - Capability probing and fallback between speech engines.
3. **Tool safety**
   - Read-only by default for effectful external tools.
   - Explicit capability metadata for connected integrations.
4. **Rich output**
   - Support image/video/resource cards instead of text-only answers.
5. **Diagnostics**
   - Expose runtime capability/health information in diagnostics, not in normal user-facing answers.

## Deliberately NOT copied

- No dependency on Claude Code as the only brain.
- No laptop-only localhost bridge requirement.
- No assumption that ~/.claude.json exists.
- No unrestricted write mode.
- No wholesale UI replacement of the native iOS / Cloudflare architecture.

## Target architecture mapping

adewaskar browser/bridge concepts -> existing JARVIS cloud/native stack:

- browser wake/VAD -> iOS VoiceEngine / native voice controls
- bridge/server.mjs -> Cloudflare application capability runtime
- MCP tool gate -> agent execution permission policy
- capability probe -> provider/capability registry + health
- HUD media -> native/PWA media/resource rendering
- diagnostics -> JARVIS diagnostics/trace UI

The integration should be additive and test-driven, using the existing feature/learning-engine branch until acceptance.
