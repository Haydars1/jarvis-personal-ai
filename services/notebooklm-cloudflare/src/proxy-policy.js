// Defensive secondary MCP tool allowlist at the internal Cloudflare boundary.
// Never import arbitrary tools from the NotebookLM server.
export const MCP_METHODS = new Set(['initialize', 'notifications/initialized', 'tools/call']);
export const NOTEBOOK_READ_TOOLS = new Set(['notebook_list', 'source_list', 'chat_ask']);
export function checkMcpRequest(message) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return false;
  if (!MCP_METHODS.has(message.method)) return false;
  if (message.method === 'tools/call') {
    return NOTEBOOK_READ_TOOLS.has(message.params?.name)
      && !!message.params.arguments && typeof message.params.arguments === 'object'
      && !Array.isArray(message.params.arguments);
  }
  return true;
}
