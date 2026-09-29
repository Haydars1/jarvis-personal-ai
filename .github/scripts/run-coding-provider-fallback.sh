#!/usr/bin/env bash
set -euo pipefail

PROMPT_PATH="${1:-}"
if [ -z "$PROMPT_PATH" ] || [ ! -f "$PROMPT_PATH" ]; then
  echo "prompt file required" >&2
  exit 2
fi
PROMPT="$(cat "$PROMPT_PATH")"

cat > /tmp/opencode-jarvis.json <<'JSON'
{
  "$schema": "https://opencode.ai/config.json",
  "providers": {
    "anthropic": {
      "package": "@opencode/ai/providers/anthropic",
      "settings": { "apiKey": "{env:ANTHROPIC_API_KEY}" }
    },
    "deepseek": {
      "package": "@opencode/ai/providers/openai-compatible",
      "settings": { "baseURL": "https://api.deepseek.com/v1", "apiKey": "{env:DEEPSEEK_API_KEY}" },
      "models": { "deepseek-v4-pro": { "name": "DeepSeek V4 Pro" } }
    },
    "mistral": {
      "package": "@opencode/ai/providers/openai-compatible",
      "settings": { "baseURL": "https://api.mistral.ai/v1", "apiKey": "{env:MISTRAL_API_KEY}" },
      "models": { "mistral-medium-latest": { "name": "Mistral Medium Latest" } }
    },
    "google": {
      "package": "@opencode/ai/providers/google",
      "settings": { "apiKey": "{env:GEMINI_API_KEY}" }
    },
    "xai": {
      "package": "@opencode/ai/providers/xai",
      "settings": { "apiKey": "{env:XAI_API_KEY}" }
    },
    "openrouter": {
      "package": "@opencode/ai/providers/openrouter",
      "settings": { "apiKey": "{env:OPENROUTER_API_KEY}" }
    },
    "groq": {
      "package": "@opencode/ai/providers/openai-compatible",
      "settings": { "baseURL": "https://api.groq.com/openai/v1", "apiKey": "{env:GROQ_API_KEY}" },
      "models": { "qwen/qwen3.8-27b": { "name": "Qwen 3.8 27B" } }
    }
  }
}
JSON

export OPENCODE_CONFIG=/tmp/opencode-jarvis.json
export OPENCODE_DISABLE_AUTOUPDATE=true

# Coding-specific preference. This is not a global provider order.
# Each task family in JARVIS has its own ranking; this script is only for repository coding.
candidates=(
  "ANTHROPIC_API_KEY|anthropic/claude-sonnet-4-5|Anthropic"
  "DEEPSEEK_API_KEY|deepseek/deepseek-v4-pro|DeepSeek"
  "MISTRAL_API_KEY|mistral/mistral-medium-latest|Mistral"
  "GEMINI_API_KEY|google/gemini-3.8-flash|Gemini"
  "XAI_API_KEY|xai/grok-4.7|xAI"
  "OPENROUTER_API_KEY|openrouter/openrouter/auto|OpenRouter Auto"
  "GROQ_API_KEY|groq/qwen/qwen3.8-27b|Groq"
)

errors=()
for entry in "${candidates[@]}"; do
  IFS='|' read -r keyvar model label <<<"$entry"
  if [ -z "${!keyvar:-}" ]; then
    continue
  fi

  echo "Trying coding provider: $label ($model)"
  git reset --hard HEAD >/dev/null
  git clean -fd >/dev/null

  set +e
  opencode run --standalone --model "$model" --agent build "$PROMPT"
  agent_rc=$?
  set -e

  if [ "$agent_rc" -ne 0 ]; then
    errors+=("$label:agent:$agent_rc")
    continue
  fi

  set +e
  npm run check
  check_rc=$?
  set -e

  if [ "$check_rc" -eq 0 ]; then
    echo "provider=$label" >> "$GITHUB_OUTPUT"
    echo "model=$model" >> "$GITHUB_OUTPUT"
    exit 0
  fi

  errors+=("$label:tests:$check_rc")
done

git reset --hard HEAD >/dev/null
git clean -fd >/dev/null
printf 'No fallback coding provider succeeded. %s\n' "${errors[*]:-no configured fallback API keys}" >&2
exit 1
