FROM python:3.11-slim
WORKDIR /srv
COPY ml /srv/ml
COPY backend/requirements.txt /srv/backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt ./ml
COPY backend /srv/backend
WORKDIR /srv/backend
# Artifacts are trained from ml/data/raw on first start if missing.
RUN python -m agrisense_ml.train --data-dir /srv/ml/data/raw --out /srv/ml/artifacts
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
