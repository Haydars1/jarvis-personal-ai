"""Secure Render Free startup: return setup-required until BOTH secrets exist.

The actual MCP server is notebooklm-py (not a mocked replacement).
A fresh Free service is safe to create without any user Google credentials.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import os
import sys

PORT = int(os.environ.get("PORT", "10000"))
TOKEN = os.environ.get("NOTEBOOKLM_MCP_TOKEN", "").strip()
AUTH = os.environ.get("NOTEBOOKLM_AUTH_JSON", "").strip()

if TOKEN and AUTH:
    os.environ["NOTEBOOKLM_MCP_ALLOW_EXTERNAL_BIND"] = "1"
    os.environ["NOTEBOOKLM_MCP_STRICT_IDS"] = "1"
    print("NotebookLM MCP configured; starting remote server.", flush=True)
    os.execvp("notebooklm-mcp", [
        "notebooklm-mcp", "--transport", "http", "--host", "0.0.0.0", "--port", str(PORT),
    ])

class SetupRequired(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200 if self.path in ("/", "/health") else 503)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(b'{"status":"setup_required","live_notebooklm":false}')

    def do_POST(self):
        self.send_response(503)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(b'{"error":"NOTEBOOKLM_GOOGLE_AUTH_NOT_CONFIGURED"}')

    def log_message(self, _format, *args):
        pass  # Never log request paths or headers from this public endpoint.

print("NotebookLM not configured: service will refuse MCP requests until secrets are set.", flush=True)
ThreadingHTTPServer(("0.0.0.0", PORT), SetupRequired).serve_forever()
