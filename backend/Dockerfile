FROM python:3.13-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN python -m app.db.migrate

EXPOSE 3002
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3002"]
