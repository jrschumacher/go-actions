# Prebuilt go-actions CLI binaries — design

**Issue:** [#75 — publish prebuilt go-actions CLI and govulncheck binaries instead of building from source every run](https://github.com/jrschumacher/go-actions/issues/75)

**Date:** 2026-04-21

## Scope

Ship prebuilt `go-actions` CLI binaries as release assets and have `ci/action.yaml` download them instead of rebuilding from source on every job.

**In scope:**

- Linux amd64/arm64 (tested in CI)
- Windows amd64/arm64 (built and published, untested)
- macOS amd64/arm64 (built and published, untested)
- Source-build fallback for refs without a `VERSION` file (`@main`, arbitrary SHAs, forks, pre-release development)

**Out of scope (follow-up issues):**

- `govulncheck` distribution — evaluated and deferred. `govulncheck` runs in one job (security) and piggybacks on the already-installed Go toolchain. Complexity of caching or bundling outweighs the ~10–30s per-PR saving. The original issue conflated this with the CLI; the CLI is the actual hot path (rebuilt in every job).
- Windows CI integration testing — requires a Windows runner that does not exist today.
- macOS CI integration testing — requires a macOS runner.

## Problem

`ci/action.yaml` lines 94–102 run `go build` against the checked-out `cli/` directory on every job. For a repo that runs test + lint + security on every PR, that is three Go toolchain installs plus three full CLI rebuilds per PR. Every consumer of this action pays the cost.

## Approach

### Version resolution (baked `VERSION` file)

The action is consumed as `@v3` (and other moving refs), while releases are tagged `go-actions-vX.Y.Z`. The download step needs to map the ref to a concrete release version without a GitHub API call.

**Mechanism:** a `VERSION` file at the repo root is updated by release-please on each release. The `update-action-tags` job in `release.yaml` already force-moves `v3` and `v3.2` to the release-please merge commit, so `@v3` checkouts automatically see the updated `VERSION`.

**Release-please configuration** (`release-please-config.json`):

```json
"packages": {
  ".": {
    "release-type": "simple",
    "component": "go-actions",
    "package-name": "go-actions",
    "extra-files": ["VERSION"]
  }
}
```

Seed `VERSION` at the repo root with the current version (`3.2.0` at time of writing).

Trade-offs considered:

- **Runtime GitHub API resolution** — rejected: adds a network hop, rate-limit risk, fails when `api.github.com` is flaky.
- **Try `github.action_ref` directly then fall back** — rejected: more complex, no meaningful benefit over the baked file.

### Download step

Replace `ci/action.yaml` lines 94–102 (`Build go-actions CLI`) with a single composite step that:

1. Reads `VERSION` from the action checkout (`$ACTION_PATH/../VERSION`).
2. Detects OS/arch from `$RUNNER_OS` and `$RUNNER_ARCH`.
3. Constructs the GoReleaser archive URL:
   `https://github.com/jrschumacher/go-actions/releases/download/go-actions-v${version}/go-actions_${version}_${os}_${arch}.${ext}`
   where `ext` is `zip` on Windows and `tar.gz` elsewhere.
4. Downloads and extracts into `$RUNNER_TEMP`.
5. Exports the install path via `GO_ACTIONS_BIN` in `$GITHUB_ENV` for the next step.
6. On any failure (missing `VERSION`, 404, corrupt archive, unsupported arch), falls back to `go build -o "$GO_ACTIONS_BIN" ./cmd/go-actions`.

Reference implementation (bash, targets Linux/Windows/macOS runners):

```bash
set -e
bin_name="go-actions"
[ "$RUNNER_OS" = "Windows" ] && bin_name="go-actions.exe"
install_path="$RUNNER_TEMP/$bin_name"

os=$(echo "$RUNNER_OS" | tr '[:upper:]' '[:lower:]')
case "$RUNNER_ARCH" in
  X64) arch=amd64 ;;
  ARM64) arch=arm64 ;;
  *) arch="" ;;
esac

version_file="$ACTION_PATH/../VERSION"
if [ -n "$arch" ] && [ -f "$version_file" ]; then
  version=$(tr -d '[:space:]' < "$version_file")
  ext="tar.gz"; [ "$os" = "windows" ] && ext="zip"
  url="https://github.com/jrschumacher/go-actions/releases/download/go-actions-v${version}/go-actions_${version}_${os}_${arch}.${ext}"
  tmp=$(mktemp -d)
  if curl -sSfL "$url" -o "$tmp/archive.$ext"; then
    if [ "$ext" = "zip" ]; then
      unzip -q "$tmp/archive.$ext" -d "$tmp"
    else
      tar -xzf "$tmp/archive.$ext" -C "$tmp"
    fi
    mv "$tmp/$bin_name" "$install_path"
    chmod +x "$install_path"
    echo "GO_ACTIONS_BIN=$install_path" >> "$GITHUB_ENV"
    echo "Installed prebuilt go-actions v$version"
    exit 0
  fi
  echo "Prebuilt binary fetch failed; falling back to source build"
else
  echo "No VERSION file or unsupported arch ($RUNNER_ARCH); building from source"
fi

cd "$ACTION_PATH/../cli"
go build -o "$install_path" ./cmd/go-actions
echo "GO_ACTIONS_BIN=$install_path" >> "$GITHUB_ENV"
echo "Built go-actions from source"
```

The subsequent `Run check` step (line 172) changes `/tmp/go-actions` to `"$GO_ACTIONS_BIN"` so it works on Windows (no `/tmp`) and with either install path.

### GoReleaser

No changes. The existing `cli/.goreleaser.yaml` already produces:

- `go-actions_<version>_linux_amd64.tar.gz`
- `go-actions_<version>_linux_arm64.tar.gz`
- `go-actions_<version>_darwin_amd64.tar.gz`
- `go-actions_<version>_darwin_arm64.tar.gz`
- `go-actions_<version>_windows_amd64.zip`
- `go-actions_<version>_windows_arm64.zip`
- `checksums.txt`

All Windows and macOS builds are cross-compiled on `ubuntu-latest`.

## Testing

- **Unit:** none; the change is bash inside a composite action.
- **Integration (Linux, `ubuntu-latest`):** two smoke jobs added to `.github/workflows/ci.yaml`:
  1. Runs the action against a minimal fixture Go project and asserts the log contains `Installed prebuilt go-actions v` (confirms the fast path).
  2. Runs the action against a ref without `VERSION` (e.g., by deleting the file before the action step) and asserts `Built go-actions from source` (confirms the fallback).
- **Windows:** no CI coverage. Binaries are documented as untested. Follow-up issue tracks runner provisioning.
- **macOS:** no CI coverage. Follow-up issue tracks runner provisioning.
- **Post-release:** the existing `test-actions` job in `release.yaml` exercises the action after each release. It runs on `ubuntu-latest` and will hit the prebuilt path once the first release with `VERSION` ships.

## Rollout

1. Add `VERSION` file at repo root containing `3.2.0`.
2. Add `"extra-files": ["VERSION"]` to `release-please-config.json`.
3. Update `ci/action.yaml` with the download-or-build step and swap the `Run check` binary path.
4. Add Linux integration smoke jobs to `.github/workflows/ci.yaml`.
5. Update README with platform-support matrix.
6. Merge. Release-please opens a release PR that bumps `VERSION` to the next version. On merge, the `v3` tag moves to the new commit, and consumers on `@v3` start hitting the prebuilt path on their next run.

## Backwards compatibility

The fallback means any ref that does not yet have a `VERSION` file (historical commits, forks, feature branches, `@main` between releases) continues to build from source exactly as it does today. No consumer breakage is possible from this change in isolation.

## Release-job ordering

`release.yaml` runs `update-action-tags` and `goreleaser` in parallel once release-please creates a release. There is a short window where `@v3` points to the new commit (with the bumped `VERSION`) before GoReleaser finishes uploading the release assets. Consumers triggered during this window hit a 404 and transparently fall back to source-build — slower but correct.

If this window becomes a problem in practice, sequence `update-action-tags` after `goreleaser` (add `needs: goreleaser` or gate on its success).

## Follow-ups

1. **Windows integration testing** — provision a Windows runner (gso or GitHub-hosted), add Windows jobs to the integration smoke matrix, remove the "untested" caveat from the README.
2. **macOS integration testing** — provision a macOS runner, same treatment as Windows.
3. **govulncheck distribution** — revisit if/when `go install` becomes a measurable bottleneck; options include `actions/cache` keyed on version + Go minor + OS/arch, or bundling a pinned govulncheck into our release assets.
