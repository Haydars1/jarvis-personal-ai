#!/usr/bin/env bash
set -euo pipefail

PROMPT_PATH="${1:-}"
MODEL_ID="${2:-qwen2.5-coder-1.5b-local}"
if [ -z "$PROMPT_PATH" ] || [ ! -f "$PROMPT_PATH" ]; then
  echo "patch fallback prompt file required" >&2
  exit 2
fi

PATCH_MAX_FILES=3
PATCH_CONTEXT="/tmp/jarvis-local-patch-context.txt"
PATCH_REQUEST="/tmp/jarvis-local-patch-request.json"
PATCH_RESPONSE="/tmp/jarvis-local-patch-response.json"
PATCH_FILE="/tmp/jarvis-local.patch"
BACKLOG_PATH=".jarvis-runtime/skill-backlog.json"

# Give the small local model a bounded, concrete view of the native-skill system.
# This avoids requiring interactive tool calling while still grounding edits in current source.
node --input-type=module <<'NODE' > "$PATCH_CONTEXT"
import { existsSync, readFileSync } from 'node:fs';
const prompt=readFileSync(process.env.PROMPT_PATH||'/tmp/jarvis-local-dev-prompt.txt','utf8').slice(0,6500);
const backlogPath='.jarvis-runtime/skill-backlog.json';
const backlog=existsSync(backlogPath)?readFileSync(backlogPath,'utf8').slice(0,5000):'{"skills":[]}';
const candidates=[
  'src/lib/native-skill-adapters.js',
  'src/application/capabilities/native-skill-executor.js',
  'tests/native-skill-executor.test.js'
];
console.log('TASK\n'+prompt+'\n\nSKILL BACKLOG\n'+backlog);
for(const path of candidates){
  if(!existsSync(path))continue;
  console.log(`\n\n===== FILE: ${path} =====\n`+readFileSync(path,'utf8').slice(0,14000));
}
NODE

PROMPT_PATH="$PROMPT_PATH" PATCH_CONTEXT="$PATCH_CONTEXT" PATCH_REQUEST="$PATCH_REQUEST" MODEL_ID="$MODEL_ID" node --input-type=module <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
const context=readFileSync(process.env.PATCH_CONTEXT,'utf8');
const instruction=`You are JARVIS's keyless local emergency patch generator.\n\n${context}\n\nReturn only a unified diff suitable for git apply. No prose and no markdown fences. Make exactly one small useful change. Prefer the first low/medium-risk unadapted repository skill in the backlog when feasible. You may modify at most 3 files and only paths under src/, public/, tests/, or docs/. Do not modify .github, schema, package files, deployment config, credentials, or generated assets. Include a focused regression test when practical. Do not delete or rename files. Keep the patch minimal and based only on the exact file contents shown above.`;
writeFileSync(process.env.PATCH_REQUEST,JSON.stringify({
  model:process.env.MODEL_ID,
  messages:[{role:'user',content:instruction}],
  temperature:0,
  max_tokens:2048
}));
NODE

curl -fsS \
  -H 'Content-Type: application/json' \
  --data-binary @"$PATCH_REQUEST" \
  http://127.0.0.1:8080/v1/chat/completions \
  > "$PATCH_RESPONSE"

PATCH_RESPONSE="$PATCH_RESPONSE" PATCH_FILE="$PATCH_FILE" node --input-type=module <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
const body=JSON.parse(readFileSync(process.env.PATCH_RESPONSE,'utf8'));
let text=String(body?.choices?.[0]?.message?.content||'').trim();
text=text.replace(/^```(?:diff|patch)?\s*/i,'').replace(/\s*```$/,'').trim();
if(!text.includes('+++ ')||!text.includes('--- '))process.exit(2);
writeFileSync(process.env.PATCH_FILE,text+'\n');
NODE

if grep -Eq '^(deleted file mode|rename from|rename to) ' "$PATCH_FILE"; then
  echo "local patch attempted delete/rename" >&2
  exit 1
fi
if grep -q '^+++ /dev/null' "$PATCH_FILE"; then
  echo "local patch attempted file deletion" >&2
  exit 1
fi

mapfile -t patch_files < <(sed -n 's#^+++ b/##p' "$PATCH_FILE" | sort -u)
if [ "${#patch_files[@]}" -eq 0 ] || [ "${#patch_files[@]}" -gt "$PATCH_MAX_FILES" ]; then
  echo "local patch has invalid file count: ${#patch_files[@]}" >&2
  exit 1
fi
for path in "${patch_files[@]}"; do
  case "$path" in
    src/*|public/*|tests/*|docs/*) ;;
    *)
      echo "local patch touched blocked path: $path" >&2
      exit 1
      ;;
  esac
done

# Reject any old-side path outside the same allowlist (except /dev/null for a new file).
while IFS= read -r old_path; do
  [ "$old_path" = "/dev/null" ] && continue
  old_path="${old_path#a/}"
  case "$old_path" in
    src/*|public/*|tests/*|docs/*) ;;
    *) echo "local patch referenced blocked old path: $old_path" >&2; exit 1 ;;
  esac
done < <(sed -n 's#^--- ##p' "$PATCH_FILE")

git apply --check "$PATCH_FILE"
git apply --whitespace=nowarn "$PATCH_FILE"

echo "Local unified-diff fallback applied ${#patch_files[@]} file(s)."
