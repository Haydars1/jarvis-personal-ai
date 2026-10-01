#!/usr/bin/env bash
set -euo pipefail

PROMPT_PATH="${1:-}"
if [ -z "$PROMPT_PATH" ] || [ ! -f "$PROMPT_PATH" ]; then
  echo "prompt file required" >&2
  exit 2
fi

CACHE_ROOT="${LOCAL_CODER_CACHE:-$HOME/.cache/jarvis-local-coder}"
LLAMA_RELEASE="b11146"
LLAMA_ARCHIVE_NAME="llama-b11146-bin-ubuntu-x64.tar.gz"
LLAMA_ARCHIVE_URL="https://github.com/ggml-org/llama.cpp/releases/download/$LLAMA_RELEASE/$LLAMA_ARCHIVE_NAME"
LLAMA_ARCHIVE_SHA256="c150306eb16b5ab696f76a8bdf810c35fd98a24e82158742e6fa28f420ff8410"
LLAMA_ROOT="$CACHE_ROOT/llama-$LLAMA_RELEASE"
MODEL_REPO="bartowski/Qwen2.5-Coder-1.5B-Instruct-GGUF:Q4_K_M"
MODEL_ID="qwen2.5-coder-1.5b-local"
SERVER_LOG="/tmp/jarvis-llama-server.log"
CONFIG_PATH="/tmp/opencode-local.json"
LOCAL_PROMPT_PATH="/tmp/jarvis-local-dev-prompt.txt"
SOURCE_BACKLOG_PATH="/tmp/jarvis-skill-backlog.json"
WORKSPACE_RUNTIME_DIR=".jarvis-runtime"
WORKSPACE_BACKLOG_PATH="$WORKSPACE_RUNTIME_DIR/skill-backlog.json"
TOOL_PROBE_REQUEST="/tmp/jarvis-tool-probe-request.json"
TOOL_PROBE_RESPONSE="/tmp/jarvis-tool-probe-response.json"

mkdir -p "$CACHE_ROOT" "$CACHE_ROOT/models"
export LLAMA_CACHE="$CACHE_ROOT/models"

find_llama_server() {
  find "$LLAMA_ROOT" -type f -name llama-server -perm -u+x -print -quit 2>/dev/null || true
}

LLAMA_BIN="$(find_llama_server)"
if [ -z "$LLAMA_BIN" ]; then
  rm -rf "$LLAMA_ROOT"
  mkdir -p "$LLAMA_ROOT"
  archive="$(mktemp /tmp/llama-bin.XXXXXX.tar.gz)"
  cleanup_archive() { rm -f "$archive"; }
  trap cleanup_archive RETURN

  curl --fail --location --retry 3 --retry-all-errors \
    --connect-timeout 20 --max-time 180 \
    --output "$archive" "$LLAMA_ARCHIVE_URL"
  echo "$LLAMA_ARCHIVE_SHA256  $archive" | sha256sum --check --status || {
    echo "llama.cpp binary archive checksum mismatch" >&2
    rm -rf "$LLAMA_ROOT"
    exit 1
  }
  tar -xzf "$archive" -C "$LLAMA_ROOT"
  rm -f "$archive"
  trap - RETURN

  LLAMA_BIN="$(find_llama_server)"
  if [ -z "$LLAMA_BIN" ]; then
    echo "verified llama.cpp archive did not contain llama-server" >&2
    rm -rf "$LLAMA_ROOT"
    exit 1
  fi
fi

cat > "$CONFIG_PATH" <<'JSON'
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "llama.cpp": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "JARVIS local llama.cpp",
      "options": {
        "baseURL": "http://127.0.0.1:8080/v1"
      },
      "models": {
        "qwen2.5-coder-1.5b-local": {
          "name": "Qwen2.5 Coder 1.5B Local Emergency Coder",
          "limit": {
            "context": 8192,
            "output": 2048
          }
        }
      }
    }
  }
}
JSON

cleanup() {
  if [ -n "${SERVER_PID:-}" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

"$LLAMA_BIN" \
  -hf "$MODEL_REPO" \
  --alias "$MODEL_ID" \
  --host 127.0.0.1 \
  --port 8080 \
  --ctx-size 8192 \
  --parallel 1 \
  --temp 0 \
  --jinja \
  >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!

ready=0
for _ in $(seq 1 180); do
  if curl -fsS http://127.0.0.1:8080/health >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    break
  fi
  sleep 2
done

if [ "$ready" -ne 1 ]; then
  echo "local llama.cpp server did not become ready" >&2
  tail -n 120 "$SERVER_LOG" >&2 || true
  exit 1
fi

cat > "$TOOL_PROBE_REQUEST" <<EOF
{"model":"$MODEL_ID","messages":[{"role":"user","content":"Call the ping tool exactly once with value ready."}],"tools":[{"type":"function","function":{"name":"ping","description":"Verify function calling.","parameters":{"type":"object","properties":{"value":{"type":"string"}},"required":["value"],"additionalProperties":false}}}],"tool_choice":"required","temperature":0,"max_tokens":128}
EOF

if ! curl -fsS \
  -H 'Content-Type: application/json' \
  --data-binary @"$TOOL_PROBE_REQUEST" \
  http://127.0.0.1:8080/v1/chat/completions \
  > "$TOOL_PROBE_RESPONSE"; then
  echo "local llama.cpp tool-call probe failed" >&2
  tail -n 80 "$SERVER_LOG" >&2 || true
  exit 1
fi

if ! TOOL_PROBE_RESPONSE="$TOOL_PROBE_RESPONSE" node --input-type=module <<'NODE'
import { readFileSync } from 'node:fs';
const body=JSON.parse(readFileSync(process.env.TOOL_PROBE_RESPONSE,'utf8'));
const message=body?.choices?.[0]?.message||{};
const calls=message?.tool_calls;
let ok=false;
if(Array.isArray(calls)&&calls.length===1&&calls[0]?.function?.name==='ping'){
  try{
    const args=JSON.parse(calls[0]?.function?.arguments||'{}');
    ok=args.value==='ready';
  }catch{}
}
if(!ok&&typeof message?.content==='string'){
  const cleaned=message.content.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  try{
    const parsed=JSON.parse(cleaned);
    ok=parsed?.name==='ping'&&parsed?.arguments?.value==='ready';
  }catch{}
}
if(!ok)process.exit(1);
NODE
then
  echo "local llama.cpp tool-call probe failed" >&2
  cat "$TOOL_PROBE_RESPONSE" >&2 || true
  tail -n 80 "$SERVER_LOG" >&2 || true
  exit 1
fi

echo "Local llama.cpp tool-call probe passed."

mkdir -p "$WORKSPACE_RUNTIME_DIR"
if ! grep -qxF "$WORKSPACE_RUNTIME_DIR/" .git/info/exclude 2>/dev/null; then
  echo "$WORKSPACE_RUNTIME_DIR/" >> .git/info/exclude
fi
if [ -f "$SOURCE_BACKLOG_PATH" ]; then
  cp "$SOURCE_BACKLOG_PATH" "$WORKSPACE_BACKLOG_PATH"
else
  printf '%s\n' '{"skills":[],"error":"skill backlog unavailable"}' > "$WORKSPACE_BACKLOG_PATH"
fi
sed "s#${SOURCE_BACKLOG_PATH}#${WORKSPACE_BACKLOG_PATH}#g" "$PROMPT_PATH" > "$LOCAL_PROMPT_PATH"
cat >> "$LOCAL_PROMPT_PATH" <<'EOF'

LOCAL EMERGENCY FALLBACK RULES:
- You are the last-resort keyless local coding agent on a small CPU model.
- Make exactly ONE small, concrete, testable improvement. Do not attempt broad refactors.
- Modify at most 3 files total and only under src/, public/, tests/, or docs/.
- Do not edit .github/, .jarvis-runtime/, schema.sql, wrangler.toml, package.json, package-lock.json, secrets, credentials, deployment settings, or billing/configuration.
- Before using Edit, read the exact current text of the target file and make the smallest possible replacement; if an exact edit misses, re-read that file before trying again.
- Prefer fixing an existing bug, incomplete path, deterministic test gap, or small maintainability problem you can verify locally.
- Do not weaken or delete tests. Do not make network calls from product code solely to satisfy this task.
- The repository skill backlog is read-only reference material at .jarvis-runtime/skill-backlog.json inside the workspace. Never edit it.
- Once one useful change and its focused regression test are complete, run npm run check and stop; do not start a second feature.
- Leave changes uncommitted. The workflow will inspect, test, and promote them only if every gate passes.
EOF

export OPENCODE_CONFIG="$CONFIG_PATH"
export OPENCODE_DISABLE_AUTOUPDATE=true

git reset --hard HEAD >/dev/null
git clean -fd >/dev/null

# OpenCode is useful when the model emits native tool calls, but this small model
# must not consume the entire workflow if it cannot drive tools. Give it a short
# bounded attempt, then fall back to a validated unified-diff path using the same
# already-running local model.
set +e
timeout 180s opencode run --standalone --model "llama.cpp/$MODEL_ID" --agent build "$(cat "$LOCAL_PROMPT_PATH")"
agent_rc=$?
set -e

mapfile -t changed_files < <(git status --porcelain | sed -E 's/^.. //' | sed -E 's/.* -> //')
if [ "$agent_rc" -ne 0 ] || [ "${#changed_files[@]}" -eq 0 ]; then
  echo "OpenCode local edit path unavailable; trying verified unified-diff fallback."
  git reset --hard HEAD >/dev/null
  git clean -fd >/dev/null
  bash .github/scripts/run-local-patch-fallback.sh "$LOCAL_PROMPT_PATH" "$MODEL_ID"
  mapfile -t changed_files < <(git status --porcelain | sed -E 's/^.. //' | sed -E 's/.* -> //')
fi

if [ "${#changed_files[@]}" -eq 0 ]; then
  echo "local coding agent produced no file changes" >&2
  exit 1
fi

if [ "${#changed_files[@]}" -gt 3 ]; then
  echo "local coding agent exceeded the 3-file safety limit" >&2
  git reset --hard HEAD >/dev/null
  git clean -fd >/dev/null
  exit 1
fi

for path in "${changed_files[@]}"; do
  case "$path" in
    src/*|public/*|tests/*|docs/*) ;;
    *)
      echo "local coding agent touched blocked path: $path" >&2
      git reset --hard HEAD >/dev/null
      git clean -fd >/dev/null
      exit 1
      ;;
  esac
done

set +e
npm run check
check_rc=$?
set -e
if [ "$check_rc" -ne 0 ]; then
  echo "local coding changes failed npm run check" >&2
  git reset --hard HEAD >/dev/null
  git clean -fd >/dev/null
  exit 1
fi

echo "provider=Local Qwen2.5 Coder" >> "$GITHUB_OUTPUT"
echo "model=$MODEL_REPO" >> "$GITHUB_OUTPUT"
echo "Local keyless coding fallback produced verified changes."
