FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y git gcc libpq-dev netcat-openbsd && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python packages
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install -r requirements.txt
# Install ClickHouse Django backend from GitHub
RUN apt-get update && \
    apt-get install -y git curl ca-certificates gcc libpq-dev netcat-openbsd && \
    rm -rf /var/lib/apt/lists/*
# Copy project files
COPY . .

# Expose Django dev port
EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]