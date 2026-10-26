#!/usr/bin/env bash
set -euo pipefail

tag_name="${1:?release tag is required}"
workspace="${GITHUB_WORKSPACE:?GITHUB_WORKSPACE is required}"

if ! git check-ref-format "refs/tags/$tag_name"; then
  echo "Invalid release tag: $tag_name" >&2
  exit 1
fi

# Release Please creates the tag after the caller's checkout, so fetch it and
# the history GoReleaser needs before changing HEAD.
if git -C "$workspace" rev-parse --is-shallow-repository | grep -qx true; then
  git -C "$workspace" fetch --force --tags --unshallow origin
else
  git -C "$workspace" fetch --force --tags origin
fi

git -C "$workspace" rev-parse --verify "refs/tags/$tag_name^{commit}" >/dev/null
git -C "$workspace" checkout --detach "refs/tags/$tag_name"
echo "GoReleaser will build $(git -C "$workspace" rev-parse --short HEAD) ($tag_name)"
