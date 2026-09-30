#!/usr/bin/env bash
set -euo pipefail

PROMPT_PATH="${1:-}"
if [ -z "$PROMPT_PATH" ] || [ ! -f "$PROMPT_PATH" ]; then
  echo "prompt file required" >&2
  exit 2
fi

CACHE_ROOT="${LOCAL_CODER_CACHE:-$HOME/.cache/jarvis-local-coder}"
LLAMA_VERSION="v0.5.0"
LLAMA_SRC="$CACHE_ROOT/llama.cpp-$LLAMA_VERSION"
LLAMA_BIN="$LLAMA_SRC/build/bin/llama-server"
MODEL_REPO="Qwen/Qwen3-1.7B-GGUF:Q4_K_M"
MODEL_ID="qwen3-1.7b-local"
SERVER_LOG="/tmp/jarvis-llama-server.log"
CONFIG_PATH="/tmp/opencode-local.json"
LOCAL_PROMPT_PATH="/tmp/jarvis-local-dev-prompt.txt"

mkdir -p "$CACHE_ROOT" "$CACHE_ROOT/models"
export LLAMA_CACHE="$CACHE_ROOT/models"

if [ ! -x "$LLAMA_BIN" ]; then
  rm -rf "$LLAMA_SRC"
  git clone --depth=1 --branch "$LLAMA_VERSION" https://github.com/ggml-org/llama.cpp.git "$LLAMA_SRC"
  cmake -S "$LLAMA_SRC" -B "$LLAMA_SRC/build" \
    -DCMAKE_BUILD_TYPE=Release \
    -DGGML_NATIVE=OFF \
    -DLLAMA_CURL=ON
  cmake --build "$LLAMA_SRC/build" --target llama-server -j2
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

cat "$PROMPT_PATH" > "$LOCAL_PROMPT_PATH"
cat >> "$LOCAL_PROMPT_PATH" <<'EOF'

LOCAL EMERGENCY FALLBACK RULES:
- You are the last-resort keyless local coding agent on a small CPU model.
- Make exactly ONE small, concrete, testable improvement. Do not attempt broad refactors.
- Modify at most 3 files total and only under src/, public/, tests/, or docs/.
- Do not edit .github/, schema.sql, wrangler.toml, package.json, package-lock.json, secrets, credentials, deployment settings, or billing/configuration.
- Prefer fixing an existing bug, incomplete path, deterministic test gap, or small maintainability problem you can verify locally.
- Do not weaken or delete tests. Do not make network calls from product code solely to satisfy this task.
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
