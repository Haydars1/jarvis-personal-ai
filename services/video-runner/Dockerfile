FROM python:3.11-slim
WORKDIR /app
ENV PIP_NO_CACHE_DIR=1 PORT=10000
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
RUN python -m pip install --no-cache-dir "mpt==1.3.8" && python -m pip show mpt
COPY services/video-runner/server.py /app/server.py
EXPOSE 10000
CMD ["python","server.py"]
