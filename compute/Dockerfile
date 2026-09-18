FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY pyproject.toml /app/pyproject.toml
COPY ecu_worker /app/ecu_worker
RUN pip install --no-cache-dir .

EXPOSE 8080
CMD ["uvicorn", "ecu_worker.server:app", "--host", "0.0.0.0", "--port", "8080"]
