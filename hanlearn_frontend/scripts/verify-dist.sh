#!/usr/bin/env bash
set -euo pipefail

required_files=(
  "dist/index.html"
  "dist/hanlearn-mark.svg"
  "dist/wordlists/inclusive/new/1.min.json"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing required build artifact: $file" >&2
    exit 1
  fi
done

echo "Build artifact check passed."
