#!/usr/bin/env bash
set -o errexit

python -m gunicorn hanlearn_backend.asgi:application -k uvicorn.workers.UvicornWorker
