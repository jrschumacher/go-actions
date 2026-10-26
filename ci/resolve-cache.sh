#!/usr/bin/env bash
set -euo pipefail

setting=${1:?cache setting is required}
runner_environment=${2:?runner environment is required}

case "$setting" in
  auto)
    if [[ "$runner_environment" == github-hosted ]]; then
      enabled=true
    else
      enabled=false
    fi
    ;;
  true|false)
    enabled=$setting
    ;;
  *)
    echo "::error::cache must be auto, true, or false" >&2
    exit 2
    ;;
esac

echo "enabled=$enabled" >> "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
