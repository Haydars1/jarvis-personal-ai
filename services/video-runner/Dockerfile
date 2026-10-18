FROM python:3.11-slim
WORKDIR /app
COPY services/video-runner/server.py /app/server.py
ENV PORT=10000
EXPOSE 10000
CMD ["python","server.py"]
