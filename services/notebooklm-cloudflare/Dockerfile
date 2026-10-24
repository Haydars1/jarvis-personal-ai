# Version-pinned experimental single-tenant NotebookLM MCP runtime.
# Google session data must never be baked into this image.
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN pip install --no-cache-dir "notebooklm-py[mcp]==0.8.5"
RUN useradd --create-home --uid 10001 notebooklm
USER notebooklm
WORKDIR /home/notebooklm
EXPOSE 9420
CMD ["notebooklm-mcp", "--transport", "http", "--host", "0.0.0.0", "--port", "9420"]
