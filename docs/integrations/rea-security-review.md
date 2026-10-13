# REA reverse-engineering integration review (not installed)

Upstream: https://github.com/morluto/rea

Status: **candidate only**. No package, skill, MCP server, executable, or native analyzer has been installed or executed.

## JARVIS integration boundary
- Keep ECU/BIN/HEX upload inspection and original/modified byte comparison inside JARVIS's existing bounded, read-only binary inspector.
- REA requires a separate local agent/MCP host for deeper analysis. Cloudflare Workers cannot run a native disassembler or arbitrary local MCP subprocess. PC-off support must therefore degrade to the existing cloud-side static inspector, not claim native REA analysis.
- Never execute an uploaded firmware image or third-party installer; do not send ECU dumps to external services without explicit approval.
- For a future optional REA bridge, require an explicit opt-in, pinned reviewed release and dependencies, isolated unprivileged host, file-size/time limits, no network by default, read-only mounted inputs, no arbitrary commands, audit log, and a strict capability allowlist.
- Return evidence with file SHA-256, source version, offsets, tool/version, and an explicit unsupported/unavailable status. Never claim Thinkdiag/KT200 hardware compatibility based on REA alone.

## Review gates before enabling
1. Review upstream license, SECURITY.md, installation scripts, dependencies, MCP handlers, subprocess and network paths at a pinned commit.
2. Threat-model untrusted binary parsing and malicious prompt content in recovered strings; treat analysis output as data only.
3. Test bounded static fixtures and failures, including truncated files, huge files, malformed evidence and tool absence.
4. Keep native execution disabled and no auto-install. Require separate approval for any external install, paid engine, secret or production change.

Source: upstream README inspected 2026-10-13; this document does not attest to a complete security audit.
