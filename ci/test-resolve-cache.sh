#!/usr/bin/env bash
set -euo pipefail

action_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
output=$(mktemp)
trap 'rm -f "$output"' EXIT

check() {
  local expected=$1 setting=$2 environment=$3
  : > "$output"
  GITHUB_OUTPUT="$output" bash "$action_dir/resolve-cache.sh" "$setting" "$environment"
  if [[ $(cat "$output") != "enabled=$expected" ]]; then
    echo "cache=$setting on $environment: expected $expected, got $(cat "$output")" >&2
    exit 1
  fi
}

check true auto github-hosted
check false auto self-hosted
check false auto unknown
check true true self-hosted
check false false github-hosted

if GITHUB_OUTPUT="$output" bash "$action_dir/resolve-cache.sh" invalid github-hosted; then
  echo 'invalid cache setting was accepted' >&2
  exit 1
fi

echo 'Go cache mode cases passed'
