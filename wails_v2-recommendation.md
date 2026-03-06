# Wails v2 — go-actions Recommendation

One-shot CI/CD setup for Wails v2 desktop apps using go-actions. All CI runs on Linux (cheaper, faster). Only the release app build runs on macOS.

## Key Differences from Wails v3

| | Wails v2 | Wails v3 |
|---|---|---|
| Config file | `wails.json` | `build/config.yml` |
| Build command | `wails build` | `wails3 build` |
| CLI install | `go install github.com/wailsapp/wails/v2/cmd/wails@latest` | `go install github.com/wailsapp/wails/v3/cmd/wails3@latest` |
| Linux WebKit package | `libwebkit2gtk-4.0-dev` | `libwebkit2gtk-4.1-dev` |
| Linux soup package | Not required | `libsoup-3.0-dev` |

## CI Workflow

Create `.github/workflows/ci.yaml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: write

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: jrschumacher/go-actions/self-validate@v3

  test:
    needs: [validate]
    runs-on: ubuntu-latest
    steps:
      - name: Install Linux build dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libgtk-3-dev \
            libwebkit2gtk-4.0-dev

      - uses: actions/checkout@v4

      - name: Create frontend dist stub
        run: mkdir -p frontend/dist

      - uses: jrschumacher/go-actions/ci@v3
        with:
          job: test
          test-args: '-v -race -coverprofile=coverage.out ./internal/...'

  lint:
    needs: [validate]
    runs-on: ubuntu-latest
    steps:
      - name: Install Linux build dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libgtk-3-dev \
            libwebkit2gtk-4.0-dev

      - uses: actions/checkout@v4

      - name: Create frontend dist stub
        run: mkdir -p frontend/dist

      - uses: jrschumacher/go-actions/ci@v3
        with:
          job: lint

  security:
    needs: [validate]
    runs-on: ubuntu-latest
    steps:
      - name: Install Linux build dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libgtk-3-dev \
            libwebkit2gtk-4.0-dev

      - uses: actions/checkout@v4

      - name: Create frontend dist stub
        run: mkdir -p frontend/dist

      - uses: jrschumacher/go-actions/ci@v3
        with:
          job: security

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - run: npm ci

      - name: Build frontend
        run: npm run build

      - name: Run tests
        run: npm test

  comment:
    needs: [test, lint, security, frontend]
    runs-on: ubuntu-latest
    if: always() && github.event_name == 'pull_request'
    steps:
      - uses: jrschumacher/go-actions/comment@v3
```

### Why each step matters

- **Linux build deps**: Wails v2 uses GTK and WebKit2GTK 4.0 on Linux. Without these, CGO can't find the C headers and `go build` fails.
- **`mkdir -p frontend/dist`**: Wails v2 apps typically have `//go:embed all:frontend/dist` in `app.go`. In a clean CI checkout, this directory doesn't exist and compilation fails.
- **`./internal/...` for tests**: If your root package has embed directives requiring built frontend assets, scope tests to packages that don't depend on the embedded frontend.
- **Frontend job**: Runs independently to validate TypeScript/framework code compiles and tests pass.

## Release Workflow

Create `.github/workflows/release.yaml`:

```yaml
name: Release

on:
  push:
    branches: [main]

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    outputs:
      release_created: ${{ steps.release.outputs.release_created }}
      tag_name: ${{ steps.release.outputs.tag_name }}
      version: ${{ steps.release.outputs.version }}
    steps:
      - uses: googleapis/release-please-action@v4
        id: release
        with:
          token: ${{ secrets.RELEASE_PLEASE_TOKEN }}

  release-app:
    needs: release-please
    if: needs.release-please.outputs.release_created == 'true'
    runs-on: macos-latest
    env:
      VERSION: ${{ needs.release-please.outputs.version }}
      TAG_NAME: ${{ needs.release-please.outputs.tag_name }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ needs.release-please.outputs.tag_name }}

      - uses: actions/setup-go@v5
        with:
          go-version-file: go.mod

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install Wails CLI
        run: go install github.com/wailsapp/wails/v2/cmd/wails@latest

      - name: Install frontend dependencies
        working-directory: frontend
        run: npm ci

      - name: Build macOS app
        run: wails build -platform darwin/universal

      - name: Package and upload
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          cd build/bin
          zip -r "${{ github.event.repository.name }}_macOS.zip" *.app
          shasum -a 256 "${{ github.event.repository.name }}_macOS.zip" > checksums.txt
          gh release upload "${TAG_NAME}" \
            "${{ github.event.repository.name }}_macOS.zip" \
            checksums.txt
```

### Why macOS only for release

- Wails desktop apps link against native frameworks (Cocoa, WebKit). Cross-compilation from Linux doesn't work for `.app` bundles.
- Code signing and notarization (if needed) require macOS.
- `macos-latest` runners cost more, so only use them for the actual build — all CI stays on Linux.

## Configuration Files

### `.goreleaser.yaml`

Wails apps can't use GoReleaser's `go build` — they need `wails build` for proper frontend embedding and native bundling. Skip the build and let GoReleaser handle the GitHub release only:

```yaml
version: 2

builds:
  - skip: true

release:
  draft: false
  prerelease: auto
```

### `.golangci.yml`

```yaml
version: 2

run:
  timeout: 5m
  modules-download-mode: readonly

linters:
  enable:
    - errcheck
    - govet
    - ineffassign
    - staticcheck
    - unused
    - misspell
    - unconvert
    - unparam
  settings:
    misspell:
      locale: US
  exclusions:
    paths:
      - vendor
      - node_modules
      - build
      - '.*\.pb\.go$'
      - '.*_generated\.go$'
    rules:
      - path: _test\.go
        linters:
          - errcheck

formatters:
  enable:
    - gofmt
    - goimports

issues:
  max-issues-per-linter: 0
  max-same-issues: 0
```

### `.release-please-config.json`

```json
{
  "packages": {
    ".": {
      "release-type": "go",
      "package-name": "your-module-name"
    }
  }
}
```

### `.release-please-manifest.json`

```json
{
  ".": "0.1.0"
}
```

## Secrets Required

| Secret | Purpose | Scopes needed |
|--------|---------|---------------|
| `RELEASE_PLEASE_TOKEN` | PAT for creating release PRs | `contents:write`, `pull_requests:write` |

`GITHUB_TOKEN` is available automatically and used for uploading release assets.

## Checklist

- [ ] `.github/workflows/ci.yaml` — CI on Linux
- [ ] `.github/workflows/release.yaml` — Release Please + macOS build
- [ ] `.golangci.yml` — With `version: 2` and Wails exclusions
- [ ] `.goreleaser.yaml` — With `skip: true`
- [ ] `.release-please-config.json`
- [ ] `.release-please-manifest.json`
- [ ] Create `RELEASE_PLEASE_TOKEN` secret in repo settings
