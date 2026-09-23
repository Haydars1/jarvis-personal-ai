function cleanContent(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function recentConversationContext(history, options = {}) {
  const maxTurns = Math.max(1, Math.min(8, Number(options.maxTurns) || 4));
  const maxChars = Math.max(80, Math.min(4000, Number(options.maxChars) || 1600));
  if (!Array.isArray(history) || !history.length) return '';

  const messages = history
    .filter(item => item && (item.role === 'user' || item.role === 'assistant'))
    .map(item => ({ role: item.role, content: cleanContent(item.content) }))
    .filter(item => item.content);

  const selected = messages.slice(-(maxTurns * 2));
  const lines = selected.map(item => `${item.role === 'user' ? 'Kullanıcı' : 'JARVIS'}: ${item.content}`);
  let context = lines.join('\n');
  if (context.length <= maxChars) return context;

  context = context.slice(context.length - maxChars);
  const firstBreak = context.indexOf('\n');
  if (firstBreak >= 0) context = context.slice(firstBreak + 1);
  return context.slice(-maxChars);
}
