#!/usr/bin/env bash
set -euo pipefail

APP_NAME="lliga_sobresalt"
REPO_ARCHIVE_BASE="https://github.com/YampiSLabs/lliga_sobresalt/archive"
APP_ROOT="/opt/${APP_NAME}"
RELEASES_DIR="${APP_ROOT}/releases"
SHARED_ENV="${APP_ROOT}/shared/.env"
CURRENT_LINK="${APP_ROOT}/current"
COMPOSE_FILE="docker-compose.prod.yml"
PROJECT_NAME="lliga_sobresalt"
HEALTH_CONTAINER="lliga_sobresalt_backend"

requested_command="${SSH_ORIGINAL_COMMAND:-}"

if [[ $# -gt 0 ]]; then
  deploy_sha="${1:-}"
elif [[ "${requested_command}" =~ ^deploy[[:space:]]+([0-9a-f]{40})$ ]]; then
  deploy_sha="${BASH_REMATCH[1]}"
else
  echo "Usage: deploy <40-char-git-sha>" >&2
  exit 64
fi

if [[ ! "${deploy_sha}" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Invalid deploy sha: ${deploy_sha}" >&2
  exit 64
fi

if [[ ! -f "${SHARED_ENV}" ]]; then
  echo "Missing shared environment file: ${SHARED_ENV}" >&2
  exit 66
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
release_dir="${RELEASES_DIR}/${timestamp}-${deploy_sha:0:12}"
archive_path="$(mktemp)"
cleanup() {
  local rc=$?
  rm -f "${archive_path}"
  if [[ $rc -ne 0 ]]; then
    # Tear down any containers started during a failed deploy before removing the dir.
    if [[ -f "${release_dir}/${COMPOSE_FILE}" ]]; then
      (cd "${release_dir}" && docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" --env-file .env down 2>/dev/null) || true
    fi
    rm -rf "${release_dir}"
  fi
}
trap cleanup EXIT

mkdir -p "${release_dir}"

echo "Deploying ${APP_NAME} backend at ${deploy_sha}"
curl -fsSL "${REPO_ARCHIVE_BASE}/${deploy_sha}.tar.gz" -o "${archive_path}"
tar -xzf "${archive_path}" --strip-components=1 -C "${release_dir}"
cp -p "${SHARED_ENV}" "${release_dir}/.env"

cd "${release_dir}"

docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" --env-file .env config >/dev/null
docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" --env-file .env build
docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" --env-file .env up -d

for _ in $(seq 1 60); do
  status="$(docker inspect -f '{{.State.Health.Status}}' "${HEALTH_CONTAINER}" 2>/dev/null || true)"
  echo "health=${status:-unknown}"
  if [[ "${status}" == "healthy" ]]; then
    ln -sfn "${release_dir}" "${CURRENT_LINK}"
    docker exec "${HEALTH_CONTAINER}" python manage.py check --deploy
    docker exec "${HEALTH_CONTAINER}" python - <<'PY'
import sys
import urllib.request
import urllib.error

failed = False
for path in ("/api/ranking/", "/api/incidents/", "/api/seasons/"):
    req = urllib.request.Request(
        "http://127.0.0.1:8000" + path,
        headers={"Host": "sobresalt.yampi.eu", "X-Forwarded-Proto": "https"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status != 200:
                print(f"FAIL {path}: HTTP {response.status}", file=sys.stderr)
                failed = True
            else:
                print(path, response.status)
    except Exception as exc:
        print(f"FAIL {path}: {exc}", file=sys.stderr)
        failed = True
sys.exit(1 if failed else 0)
PY
    echo "deployed_release=${release_dir}"
    # Release dirs are named YYYYMMDDTHHMMSSZ-<sha>, so lexicographic sort == chronological sort.
    find "${RELEASES_DIR}" -maxdepth 1 -mindepth 1 -type d | sort | head -n -5 | xargs -r rm -rf
    exit 0
  fi
  sleep 5
done

echo "Backend did not become healthy" >&2
docker compose -p "${PROJECT_NAME}" -f "${COMPOSE_FILE}" --env-file .env ps >&2
docker logs --tail 160 "${HEALTH_CONTAINER}" >&2 || true
exit 1
