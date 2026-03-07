# go-actions

Composite GitHub Actions for Go projects. Provides CI (test, lint, benchmark, security), release automation, and configuration validation.

> **📖 For AI Agents & Claude Code**: See [CLAUDE.md](./CLAUDE.md) for detailed guidance on using this repository, including critical configuration requirements and common pitfalls to avoid.

## Quick Start

### Minimal CI Workflow

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
      - uses: actions/checkout@v4
      - uses: jrschumacher/go-actions/self-validate@v3

  test:
    needs: [validate]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jrschumacher/go-actions/ci@v3
        with:
          job: test

  lint:
    needs: [validate]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jrschumacher/go-actions/ci@v3
        with:
          job: lint

  security:
    needs: [validate]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jrschumacher/go-actions/ci@v3
        with:
          job: security

```

Each CI job automatically posts and merges its results into a single unified PR comment — no separate comment job needed.

### Release Workflow

Create `.github/workflows/release.yaml`:

```yaml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.RELEASE_PLEASE_TOKEN }}
      - uses: jrschumacher/go-actions/release@v3
        with:
          release-token: ${{ secrets.RELEASE_PLEASE_TOKEN }}
```

**Required**: Create a PAT with `contents:write` and `pull_requests:write` permissions. Add as `RELEASE_PLEASE_TOKEN` secret. The checkout step must use `fetch-depth: 0` (full history) and the same PAT as its `token`.

---

## Configuration with `.go-actions.yaml`

You can optionally create a `.go-actions.yaml` file to centralize your CI settings. Without it, everything works using sensible defaults. With it, you get:

- **Local/CI parity** — Run `go-actions check test` locally with the same settings as your CI workflow, no drift between environments
- **Simpler workflows** — Define test args, coverage thresholds, and benchmark settings once in config instead of passing them as inputs in every workflow job
- **Project defaults** — Set your coverage threshold to 90%, customize lint args, or disable benchmarks in one place that's versioned with your code

```yaml
# .go-actions.yaml
version: 1

ci:
  test:
    args: "-v -race ./..."
    coverage:
      threshold: 90
  lint:
    version: auto
  benchmark:
    enabled: false
  security:
    fail-on: high

release:
  goreleaser:
    args: "release --clean"
```

**Precedence:** Action inputs (when explicitly set) override `.go-actions.yaml`, which overrides built-in defaults. If you don't create this file, nothing changes — all existing workflows continue to work exactly as before.

---

## Actions Reference

### CI Action

**Usage**: `jrschumacher/go-actions/ci@v3`

Runs test, lint, benchmark, or security jobs for Go projects. Lint results include detailed issue reports grouped by linter type, posted directly to PR comments for faster iteration.

#### Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `job` | Yes | - | Job type: `test`, `lint`, `benchmark`, or `security` |
| `go-version` | No | from go.mod | Explicit Go version |
| `go-version-file` | No | `go.mod` | Path to version file |
| `working-directory` | No | `.` | Working directory |
| `test-args` | No | from config or built-in | Arguments for `go test` (overrides `.go-actions.yaml`) |
| `golangci-lint-version` | No | `auto` | `auto` (stable matrix), `latest` (bleeding edge), or explicit like `v2.8.0` |
| `lint-args` | No | from config or built-in | Arguments for golangci-lint (overrides `.go-actions.yaml`) |
| `benchmark-args` | No | from config or built-in | Benchmark arguments (overrides `.go-actions.yaml`) |
| `benchmark-count` | No | from config or `5` | Number of benchmark iterations (overrides `.go-actions.yaml`) |
| `govulncheck-version` | No | `latest` | govulncheck version (security job) |
| `security-args` | No | from config or built-in | Arguments for govulncheck (overrides `.go-actions.yaml`) |
| `github-comment` | No | `true` | Post results as PR comment. Each job merges into a unified comment. |

#### Outputs

| Output | Description |
|--------|-------------|
| `coverage` | Test coverage percentage (test job only) |
| `vulnerabilities` | Number of vulnerabilities found (security job only) |

#### Examples

```yaml
# Basic test
- uses: actions/checkout@v4
- uses: jrschumacher/go-actions/ci@v3
  with:
    job: test

# Test with custom args
- uses: actions/checkout@v4
- uses: jrschumacher/go-actions/ci@v3
  with:
    job: test
    test-args: '-v -short'

# Lint (auto - stable matrix based on Go version)
- uses: actions/checkout@v4
- uses: jrschumacher/go-actions/ci@v3
  with:
    job: lint

# Lint with latest (bleeding edge)
- uses: actions/checkout@v4
- uses: jrschumacher/go-actions/ci@v3
  with:
    job: lint
    golangci-lint-version: latest

# Lint with pinned version (for reproducibility)
- uses: actions/checkout@v4
- uses: jrschumacher/go-actions/ci@v3
  with:
    job: lint
    golangci-lint-version: v2.8.0

# Benchmark
- uses: actions/checkout@v4
- uses: jrschumacher/go-actions/ci@v3
  with:
    job: benchmark
    benchmark-count: 10

# Security (CVE scanning with govulncheck)
- uses: actions/checkout@v4
- uses: jrschumacher/go-actions/ci@v3
  with:
    job: security
```

#### Input Precedence

Action inputs (e.g., `test-args`, `lint-args`) are passed directly as arguments to the underlying tools (`go test`, `golangci-lint`). They fully replace the defaults — they do not append to them.

For example, if you set `test-args: '-v -short'`, the default `-race -coverprofile=coverage.out` flags are **not** included unless you add them yourself.

#### golangci-lint Version Compatibility

When `golangci-lint-version` is set to `auto` (the default), the action selects a compatible version based on your Go version:

| Go Version | golangci-lint Version | Notes |
|------------|----------------------|-------|
| 1.25+ | v2.8.0 | Latest stable for modern Go |
| 1.24 | v2.3.1 | Compatible with Go 1.24 |
| 1.23 and earlier | v2.1.0 | Minimum v2 support |

**Important**: Different golangci-lint minor versions may have different config schemas. Use `linters.exclusions.paths` for path exclusions (not the deprecated `run.skip-dirs`). When in doubt, pin a specific version for reproducibility.

---

### Release Action

**Usage**: `jrschumacher/go-actions/release@v3`

Automates releases using Release Please and GoReleaser.

#### Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `release-token` | Yes | - | PAT for creating release PRs |
| `go-version` | No | from go.mod | Explicit Go version |
| `go-version-file` | No | `go.mod` | Path to version file |
| `working-directory` | No | `.` | Working directory |
| `create-version-aliases` | No | `false` | Create v1, v1.2 aliases pointing to v1.2.3 |
| `goreleaser-args` | No | from config or `release --clean` | GoReleaser arguments (overrides `.go-actions.yaml`) |

#### Required Files

Before using, create these files in your repository:

**`release-please-config.json`**:
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

**`.release-please-manifest.json`**:
```json
{
  ".": "0.1.0"
}
```

**`.goreleaser.yaml`**: Run `goreleaser init` to create.

#### Examples

```yaml
# Basic release
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
    token: ${{ secrets.RELEASE_PLEASE_TOKEN }}
- uses: jrschumacher/go-actions/release@v3
  with:
    release-token: ${{ secrets.RELEASE_PLEASE_TOKEN }}

# With version aliases (v1 -> v1.2.3)
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
    token: ${{ secrets.RELEASE_PLEASE_TOKEN }}
- uses: jrschumacher/go-actions/release@v3
  with:
    release-token: ${{ secrets.RELEASE_PLEASE_TOKEN }}
    create-version-aliases: true
```

---

### Self-Validate Action

**Usage**: `jrschumacher/go-actions/self-validate@v3`

Validates project configuration for go-actions workflows. Checks required files exist and configurations are valid.

#### Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `workflow-paths` | No | `.github/workflows/*.yaml,.github/workflows/*.yml` | Workflow files to scan |
| `comment-on-pr` | No | `true` | Post validation results as PR comment |

#### Example

```yaml
- uses: actions/checkout@v4
- uses: jrschumacher/go-actions/self-validate@v3
```

---

## Complete Workflow Example

Full CI/CD setup with all features:

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
      - uses: actions/checkout@v4
      - uses: jrschumacher/go-actions/self-validate@v3

  test:
    needs: [validate]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jrschumacher/go-actions/ci@v3
        with:
          job: test

  lint:
    needs: [validate]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jrschumacher/go-actions/ci@v3
        with:
          job: lint

  security:
    needs: [validate]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jrschumacher/go-actions/ci@v3
        with:
          job: security

  benchmark:
    needs: [validate]
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      - uses: jrschumacher/go-actions/ci@v3
        with:
          job: benchmark
```

Each CI job automatically posts and merges its results into a single unified PR comment.

---

## Required Project Files

| File | Required For | Purpose |
|------|--------------|---------|
| `go.mod` | All actions | Go module definition, version detection |
| `.golangci.yml` | lint (optional) | golangci-lint configuration |
| `release-please-config.json` | release | Release Please configuration |
| `.release-please-manifest.json` | release | Version tracking |
| `.goreleaser.yaml` | release | GoReleaser configuration |

---

## Common Issues & Solutions

### ❌ Lint Failure: "can't load config: unsupported version of the configuration"

**Problem**: golangci-lint v2 requires an explicit `version` field in `.golangci.yml`

**Solution**: Add `version: 2` and **trust the defaults** - golangci-lint v2 has excellent built-in linters:

```yaml
# .golangci.yml - RECOMMENDED for local development
version: 2  # REQUIRED - must be numeric 2, NOT "v2" or "2.0"

run:
  timeout: 5m  # Optional: only if you need more time
```

**For CI/CD environments (GitHub Actions)**, add path exclusions to prevent scanning external or generated code:

```yaml
# .golangci.yml - RECOMMENDED for GitHub Actions
version: 2

run:
  timeout: 5m

linters:
  enable:
    - errcheck      # Catch unchecked errors
    - staticcheck   # Detect bugs and style issues
    - unused        # Find unused code
    - gosimple      # Suggest simpler code
    - govet         # Standard Go static analysis
  exclusions:
    paths:
      - vendor
      - node_modules
      - .git
      - '.*\.pb\.go$'
      - '.*_generated\.go$'
```

**Why path exclusions are essential in CI/CD:**
- Skipping vendor/node_modules/.git avoids linting external or generated content
- Excluding *.pb.go and *_generated.go skips auto-generated code
- Keeps lint reports focused on your actual source code

**If you see `gtar: ... Cannot open: File exists` in GitHub Actions**:
That error comes from **golangci-lint-action cache restore collisions** (older go-actions versions or direct use of that action), not from golangci-lint scanning. Upgrade to the latest go-actions or disable the lint action cache (`skip-cache`/`skip-save-cache`) to resolve it.

**Why minimal configuration is better:**
- ✅ golangci-lint v2 enables sensible default linters automatically
- ✅ You get new linter improvements in future releases without config changes
- ✅ Less to maintain, easier to understand
- ✅ Team members don't need to learn your custom linter selection

**Only customize when you have specific needs:**
```yaml
version: 2

run:
  timeout: 5m
  go: '1.24'  # Only specify if you need a specific Go version

# Optional: only enable additional linters if defaults aren't sufficient
linters:
  enable:
    - gofmt
    - govet
    - errcheck
```

**Real-world example** (balanced approach from [workctl](https://github.com/jrschumacher/workctl)):
```yaml
version: "2"

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

formatters:
  enable:
    - gofmt
    - goimports
  settings:
    goimports:
      local-prefixes:
        - github.com/your-org/your-repo  # Replace with your module path

issues:
  max-issues-per-linter: 0
  max-same-issues: 0
```

*💡 This shows a production-tested configuration that enables essential linters without over-configuration. It's a good starting point if you need more than the defaults.*

**Advanced configuration** (only if you need custom settings):
```yaml
version: 2

run:
  timeout: 5m
  go: '1.24'

linters:
  enable:
    - gofmt
    - govet
    - errcheck

  # v2 schema: Use 'settings' not 'linters-settings'
  settings:
    govet:
      check-shadowing: true

  # v2 schema: Use 'exclusions' not 'issues.exclude-rules'
  exclusions:
    rules:
      - path: _test\.go
        linters:
          - errcheck
```

**Common Mistakes**:
- ❌ `version: v2` - Don't use "v" prefix
- ❌ `version: 2.0` - Use `2`, not `2.0`
- ❌ Missing the field entirely
- ❌ Listing all linters manually - let golangci-lint use its defaults
- ❌ Using v1 schema fields (`linters-settings`, `issues.exclude-rules`) with v2
- ❌ Missing path exclusions in CI/CD - Will lint external/generated files and slow down runs
- ✅ `version: 2` - Correct
- ✅ `version: "2"` - Also correct
- ✅ Minimal config relying on defaults - Best practice
- ✅ Include `linters.exclusions.paths` for vendor, node_modules, .git in CI configs
- ✅ `linters.settings` - Correct v2 schema for linter settings (if needed)
- ✅ `linters.exclusions` - Correct v2 schema for exclusion rules (if needed)

**Why**: This is the #1 cause of lint failures. golangci-lint v2.x made the version field mandatory to help with migration and compatibility.

**Auto-Detection**: The `self-validate` action automatically detects this issue and provides the fix in PR comments.

---

### Security Job: Lint vs CVE Scanning

The `security` job (govulncheck) and `lint` job (golangci-lint) serve **different purposes**:

| Check Type | golangci-lint (lint) | govulncheck (security) |
|------------|---------------------|------------------------|
| **Purpose** | Code quality & patterns | Known CVE detection |
| **Scope** | Your source code | Your dependencies |
| **Database** | Linter rules | Go Vulnerability Database |
| **Examples** | Unchecked errors, unused code | CVE-2023-XXXXX in `golang.org/x/net` |

**Why run both?**
- golangci-lint catches insecure **patterns** you write (e.g., hardcoded credentials via `gosec` linter)
- govulncheck catches known **CVEs** in libraries you import (e.g., security flaws in third-party code)

**govulncheck is call-graph aware**: It only reports vulnerabilities in code paths your application actually uses, reducing false positives compared to generic dependency scanners.

---

## Framework-Specific Notes

### Wails Apps

Wails desktop apps have specific CI/CD challenges — CGO dependencies, frontend embedding, and platform-specific builds. We provide complete recommendation guides with ready-to-copy workflows:

- **[Wails v3 Recommendation](./wails_v3-recommendation.md)** — CI on Linux, release builds on macOS, complete workflow and config examples
- **[Wails v2 Recommendation](./wails_v2-recommendation.md)** — Same approach adapted for Wails v2 (different WebKit packages, `wails build` instead of `wails3 build`)

**Quick summary of the approach:**

1. **CI runs on Linux** (`ubuntu-latest`) — install GTK/WebKit deps, create `frontend/dist` stub for `go:embed`, scope tests to `./internal/...`
2. **Release builds on macOS** (`macos-latest`) — only the app build needs macOS for native framework linking and `.app` bundling
3. **GoReleaser skips `go build`** — Wails apps need `wails build` / `wails3 build` for proper frontend embedding, so GoReleaser handles GitHub release creation only (`builds: [{skip: true}]`)

---

## Version Policy

- **`@v3`**: Latest stable v3.x.x release (recommended)
- **`@v3.0.1`**: Exact version pinning
