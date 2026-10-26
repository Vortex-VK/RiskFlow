FROM node:24-bookworm-slim AS frontend
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY contracts/ /build/contracts/
COPY fixtures/ /build/fixtures/
RUN npm run build

FROM python:3.13-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    RISKFLOW_FIXTURES_DIR=/app/fixtures/scenarios \
    RISKFLOW_FRONTEND_DIR=/app/frontend \
    RISKFLOW_DATA_DIR=/app/.data
WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app/ ./app/
COPY backend/ml/ ./ml/
COPY backend/model_artifacts/ ./model_artifacts/
COPY fixtures/scenarios/ ./fixtures/scenarios/
COPY --from=frontend /build/frontend/dist/ ./frontend/
RUN mkdir -p /app/.data && chown 10001:10001 /app/.data
USER 10001:10001
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=2)"
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
