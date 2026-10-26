#!/usr/bin/env bash
set -euo pipefail

action_dir="$(cd "$(dirname "$0")" && pwd)"
test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT

git init --bare "$test_dir/origin.git" >/dev/null
git init -b main "$test_dir/source" >/dev/null
git -C "$test_dir/source" config user.name Test
git -C "$test_dir/source" config user.email test@example.com
git -C "$test_dir/source" config commit.gpgsign false
echo first > "$test_dir/source/file"
git -C "$test_dir/source" add file
git -C "$test_dir/source" commit -m first >/dev/null
git -C "$test_dir/source" tag v0.6.0
git -C "$test_dir/source" remote add origin "$test_dir/origin.git"
git -C "$test_dir/source" push origin main --tags >/dev/null

git clone --depth 1 --branch main "file://$test_dir/origin.git" "$test_dir/workspace" >/dev/null
echo second > "$test_dir/source/file"
git -C "$test_dir/source" commit -am second >/dev/null
git -C "$test_dir/source" tag v0.7.0
git -C "$test_dir/source" push origin main --tags >/dev/null

export GITHUB_WORKSPACE="$test_dir/workspace"
bash "$action_dir/checkout-release-tag.sh" v0.7.0
test "$(git -C "$GITHUB_WORKSPACE" rev-parse HEAD)" = "$(git -C "$GITHUB_WORKSPACE" rev-parse v0.7.0)"
git -C "$GITHUB_WORKSPACE" rev-parse --verify v0.6.0 >/dev/null

if bash "$action_dir/checkout-release-tag.sh" '../bad' >/dev/null 2>&1; then
  echo 'Expected invalid tag to be rejected' >&2
  exit 1
fi

echo 'release tag checkout test passed'
