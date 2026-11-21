FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HOME=/tmp
WORKDIR /app
COPY requirements.txt ./
RUN apt-get update && apt-get install -y --no-install-recommends libseccomp2 \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir -r requirements.txt \
    && useradd --system --user-group --uid 10001 --no-create-home --home-dir /tmp tooling
COPY server.py executor.py suites.py ./
USER 10001:10001
EXPOSE 8080
CMD ["python", "server.py"]
