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
MODEL_REPO="Qwen/Qwen3-1.7B-GGUF:Q8_0"
MODEL_ID="qwen3-1.7b-local"
SERVER_LOG="/tmp/jarvis-llama-server.log"
CONFIG_PATH="/tmp/opencode-local.json"
LOCAL_PROMPT_PATH="/tmp/jarvis-local-dev-prompt.txt"
SOURCE_BACKLOG_PATH="/tmp/jarvis-skill-backlog.json"
WORKSPACE_RUNTIME_DIR=".jarvis-runtime"
WORKSPACE_BACKLOG_PATH="$WORKSPACE_RUNTIME_DIR/skill-backlog.json"

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
        "qwen3-1.7b-local": {
          "name": "Qwen3 1.7B Local Emergency Coder",
          "limit": {
            "context": 16384,
            "output": 4096
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
  --ctx-size 16384 \
  --parallel 1 \
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
- Do not edit .github/, schema.sql, wrangler.toml, package.json, package-lock.json, secrets, credentials, deployment settings, or billing/configuration.
- Prefer fixing an existing bug, incomplete path, deterministic test gap, or small maintainability problem you can verify locally.
- Do not weaken or delete tests. Do not make network calls from product code solely to satisfy this task.
- The repository skill backlog is available at .jarvis-runtime/skill-backlog.json inside the workspace.
- Leave changes uncommitted. The workflow will inspect, test, and promote them only if every gate passes.
EOF

export OPENCODE_CONFIG="$CONFIG_PATH"
export OPENCODE_DISABLE_AUTOUPDATE=true

git reset --hard HEAD >/dev/null
git clean -fd >/dev/null

set +e
opencode run --standalone --model "llama.cpp/$MODEL_ID" --agent build "$(cat "$LOCAL_PROMPT_PATH")"
agent_rc=$?
set -e

if [ "$agent_rc" -ne 0 ]; then
  echo "local coding agent failed with exit code $agent_rc" >&2
  git reset --hard HEAD >/dev/null
  git clean -fd >/dev/null
  exit 1
fi

mapfile -t changed_files < <(git status --porcelain | sed -E 's/^.. //' | sed -E 's/.* -> //')
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

echo "provider=Local Qwen3" >> "$GITHUB_OUTPUT"
echo "model=$MODEL_REPO" >> "$GITHUB_OUTPUT"
echo "Local keyless coding fallback produced verified changes."
