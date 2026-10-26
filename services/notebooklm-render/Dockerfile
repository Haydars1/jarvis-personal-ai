# Free-tier Render deployment of experimental, single-user NotebookLM MCP.
# Google credentials are runtime-only and must never enter the image/repo.
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 NOTEBOOKLM_MCP_ALLOW_EXTERNAL_BIND=1
RUN pip install --no-cache-dir "notebooklm-py[mcp]==0.8.5" && useradd --create-home --uid 10001 nb
WORKDIR /app
COPY services/notebooklm-render/bootstrap.py /app/bootstrap.py
USER nb
EXPOSE 10000
CMD ["python", "/app/bootstrap.py"]
