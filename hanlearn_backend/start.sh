#!/usr/bin/env bash
set -o errexit

exec python -m gunicorn hanlearn_backend.asgi:application \
	-k uvicorn.workers.UvicornWorker \
	--workers "${WEB_CONCURRENCY:-1}" \
	--timeout "${GUNICORN_TIMEOUT:-60}" \
	--graceful-timeout "${GUNICORN_GRACEFUL_TIMEOUT:-30}" \
	--max-requests "${GUNICORN_MAX_REQUESTS:-300}" \
	--max-requests-jitter "${GUNICORN_MAX_REQUESTS_JITTER:-50}" \
	--keep-alive "${GUNICORN_KEEPALIVE:-5}"
