---
name: reverse-engineer-anything
description: Analyze owned or explicitly authorized applications, packages, binaries and web UIs using evidence-led reverse engineering. Use only when source code is unavailable or insufficient; never infer functionality without evidence.
license: MIT
---
# Reverse Engineer Anything (REA) — hayırlıevlad skill

Upstream: https://github.com/tianyin231/Rea
Official setup: `npx rea-agents setup` (requires local or remote agent runtime with Node.js and npm).
**This repository skill is an integration guide, not proof that the REA MCP server or any binary-analysis engine has been installed.**

## Workflow
1. Establish explicit ownership/authorization and permitted scope. Decline access-control bypass, DRM circumvention, credential extraction or third-party service intrusion.
2. Identify target (web page, package, Electron app, .NET assembly, native executable, or hardware UI) and available source. Prefer source code analysis when available.
3. If REA MCP tools are registered, inspect their actual capabilities; otherwise report the missing runtime and do not invent analysis results.
4. Create a hypothesis, gather reproducible passive/static evidence, compare behavior, and document uncertainty.
5. Record findings with target version, hashes, timestamps, screenshots or traces where authorized, tool version, and reproduction steps.
6. Produce an independent, license-compliant implementation specification rather than copying protected code or branding.
7. Keep generated code on a feature branch, run tests and security review, and require user confirmation for deployment, destructive actions or account interactions.

## Suggested integrations
- Analyze user-owned desktop apps and local utilities.
- Audit existing JARVIS frontend flows and competitor-inspired UX without copying code.
- Document authorized ECU diagnostic UI and communication protocols; do not bypass anti-theft or safety controls.
- Connect to a separately deployed OpenDots computer only after user authentication, per-tool permission gating and audit logs.

## Prerequisites for real execution
- Node/npm runtime with network and an approved installation target.
- Agent host supporting MCP registration (Codex, Claude Code, etc.).
- Optional authorized Ghidra/IDA/Hopper engine for native analysis.
- Human approval before REA setup changes agent configuration.

## Verification
- `npx rea-agents --help` resolves on chosen host.
- `npx rea-agents setup` is reviewed and completed on chosen host.
- Agent's MCP tool inventory lists actual REA tools.
- A permitted sample target produces evidence-backed findings.
- A follow-up invocation retrieves evidence and does not silently assert installation.
