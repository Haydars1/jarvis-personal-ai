function cleanContent(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function recentTurns(messages, maxTurns) {
  let userTurns = 0;
  let start = messages.length;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'user') userTurns += 1;
    start = index;
    if (userTurns >= maxTurns) break;
  }
  return messages.slice(start);
}

function boundedLines(messages, maxChars) {
  const lines = messages.map(item => {
    const prefix = item.role === 'user' ? 'Kullanıcı: ' : 'JARVIS: ';
    const room = Math.max(0, maxChars - prefix.length);
    return `${prefix}${item.content.slice(0, room)}`;
  });
  const kept = [];
  let used = 0;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    const separator = kept.length ? 1 : 0;
    if (used + separator + line.length > maxChars) break;
    kept.unshift(line);
    used += separator + line.length;
  }
  if (kept.length) return kept.join('\n');
  return lines.at(-1)?.slice(0, maxChars) || '';
}

export function recentConversationContext(history, options = {}) {
  const maxTurns = Math.max(1, Math.min(8, Number(options.maxTurns) || 4));
  const maxChars = Math.max(80, Math.min(4000, Number(options.maxChars) || 1600));
  if (!Array.isArray(history) || !history.length) return '';

  const messages = history
    .filter(item => item && (item.role === 'user' || item.role === 'assistant'))
    .map(item => ({ role: item.role, content: cleanContent(item.content) }))
    .filter(item => item.content);

  return boundedLines(recentTurns(messages, maxTurns), maxChars);
}
