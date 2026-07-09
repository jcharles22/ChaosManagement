#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${HOME}/ChaosManagement"
REPO_URL="https://github.com/jcharles22/ChaosManagement.git"
BRANCH="main"

if [[ ! -d "${REPO_DIR}/.git" ]]; then
  git clone --branch "${BRANCH}" "${REPO_URL}" "${REPO_DIR}"
fi

cd "${REPO_DIR}"
git fetch origin "${BRANCH}"
git reset --hard "origin/${BRANCH}"

cd server
npm ci
npm run build

if systemctl is-active --quiet chaos-server; then
  sudo systemctl restart chaos-server
else
  echo "chaos-server is not running — complete initial systemd setup first."
  exit 1
fi

sudo systemctl status chaos-server --no-pager
