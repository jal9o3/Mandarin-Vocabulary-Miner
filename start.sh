#!/usr/bin/env bash
set -o errexit

cd hanlearn_backend
python -m gunicorn hanlearn_backend.asgi:application -k uvicorn.workers.UvicornWorker
