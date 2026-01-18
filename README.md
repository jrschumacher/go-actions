# go-actions

Composite GitHub Actions for Go projects. Provides CI (test, lint, benchmark), release automation, and configuration validation.

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
      - uses: jrschumacher/go-actions/self-validate@v1

  test:
    needs: [validate]
    runs-on: ubuntu-latest
    steps:
      - uses: jrschumacher/go-actions/ci@v1
        with:
          job: test

  lint:
    needs: [validate]
    runs-on: ubuntu-latest
    steps:
      - uses: jrschumacher/go-actions/ci@v1
        with:
          job: lint

  comment:
    needs: [test, lint]
    runs-on: ubuntu-latest
    if: always() && github.event_name == 'pull_request'
    steps:
      - uses: jrschumacher/go-actions/comment@v1
```

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
      - uses: jrschumacher/go-actions/release@v1
        with:
          release-token: ${{ secrets.RELEASE_PLEASE_TOKEN }}
```

**Required**: Create a PAT with `contents:write` and `pull_requests:write` permissions. Add as `RELEASE_PLEASE_TOKEN` secret.

---

## Actions Reference

### CI Action

**Usage**: `jrschumacher/go-actions/ci@v1`

Runs test, lint, or benchmark jobs for Go projects.

#### Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `job` | Yes | - | Job type: `test`, `lint`, or `benchmark` |
| `go-version` | No | from go.mod | Explicit Go version |
| `go-version-file` | No | `go.mod` | Path to version file |
| `working-directory` | No | `.` | Working directory |
| `test-args` | No | `-v -race -coverprofile=coverage.out` | Arguments for `go test` |
| `golangci-lint-version` | No | `v2.1.0` | golangci-lint version |
| `lint-args` | No | - | Arguments for golangci-lint |
| `benchmark-args` | No | `-bench=. -benchmem` | Benchmark arguments |
| `benchmark-count` | No | `5` | Number of benchmark iterations |

#### Outputs

| Output | Description |
|--------|-------------|
| `coverage` | Test coverage percentage (test job only) |

#### Examples

```yaml
# Basic test
- uses: jrschumacher/go-actions/ci@v1
  with:
    job: test

# Test with custom args
- uses: jrschumacher/go-actions/ci@v1
  with:
    job: test
    test-args: '-v -short'

# Lint with specific version
- uses: jrschumacher/go-actions/ci@v1
  with:
    job: lint
    golangci-lint-version: v2.1.0

# Benchmark
- uses: jrschumacher/go-actions/ci@v1
  with:
    job: benchmark
    benchmark-count: 10
```

---

### Release Action

**Usage**: `jrschumacher/go-actions/release@v1`

Automates releases using Release Please and GoReleaser.

#### Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `release-token` | Yes | - | PAT for creating release PRs |
| `go-version` | No | from go.mod | Explicit Go version |
| `go-version-file` | No | `go.mod` | Path to version file |
| `working-directory` | No | `.` | Working directory |
| `create-version-aliases` | No | `false` | Create v1, v1.2 aliases pointing to v1.2.3 |

#### Required Files

Before using, create these files in your repository:

**`.release-please-config.json`**:
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
- uses: jrschumacher/go-actions/release@v1
  with:
    release-token: ${{ secrets.RELEASE_PLEASE_TOKEN }}

# With version aliases (v1 -> v1.2.3)
- uses: jrschumacher/go-actions/release@v1
  with:
    release-token: ${{ secrets.RELEASE_PLEASE_TOKEN }}
    create-version-aliases: true
```

---

### Self-Validate Action

**Usage**: `jrschumacher/go-actions/self-validate@v1`

Validates project configuration for go-actions workflows. Checks required files exist and configurations are valid.

#### Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `workflow-paths` | No | `.github/workflows/*.yaml,.github/workflows/*.yml` | Workflow files to scan |
| `comment-on-pr` | No | `true` | Post validation results as PR comment |

#### Example

```yaml
- uses: jrschumacher/go-actions/self-validate@v1
```

---

### Comment Action

**Usage**: `jrschumacher/go-actions/comment@v1`

Posts unified CI results to pull requests. Consolidates test, lint, and benchmark results into a single comment.

#### Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `github-token` | No | `${{ github.token }}` | Token for posting comments |

#### Example

```yaml
- uses: jrschumacher/go-actions/comment@v1
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
      - uses: jrschumacher/go-actions/self-validate@v1

  test:
    needs: [validate]
    runs-on: ubuntu-latest
    steps:
      - uses: jrschumacher/go-actions/ci@v1
        with:
          job: test

  lint:
    needs: [validate]
    runs-on: ubuntu-latest
    steps:
      - uses: jrschumacher/go-actions/ci@v1
        with:
          job: lint

  benchmark:
    needs: [validate]
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    steps:
      - uses: jrschumacher/go-actions/ci@v1
        with:
          job: benchmark

  comment:
    needs: [test, lint]
    runs-on: ubuntu-latest
    if: always() && github.event_name == 'pull_request'
    steps:
      - uses: jrschumacher/go-actions/comment@v1
```

---

## Required Project Files

| File | Required For | Purpose |
|------|--------------|---------|
| `go.mod` | All actions | Go module definition, version detection |
| `.golangci.yml` | lint (optional) | golangci-lint configuration |
| `.release-please-config.json` | release | Release Please configuration |
| `.release-please-manifest.json` | release | Version tracking |
| `.goreleaser.yaml` | release | GoReleaser configuration |

---

## Common Issues & Solutions

### ❌ Lint Failure: "can't load config: unsupported version of the configuration"

**Problem**: golangci-lint v2 requires an explicit `version` field in `.golangci.yml`

**Solution**: Add `version: 2` to the top of your configuration file:

```yaml
# .golangci.yml
version: 2  # REQUIRED for golangci-lint v2

run:
  timeout: 5m
  go: '1.24'

linters:
  enable:
    - gofmt
    - govet
    - errcheck
    - staticcheck
    - ineffassign
    - misspell

issues:
  exclude-use-default: false
```

**Why**: This is the #1 cause of lint failures. golangci-lint v2.x made the version field mandatory to help with migration and compatibility.

**Auto-Detection**: The `self-validate` action automatically detects this issue and provides the fix in PR comments.

---

## Version Policy

- **`@v1`**: Latest stable v1.x.x release (recommended)
- **`@v1.2.3`**: Exact version pinning
- **`@main`**: Development branch (not recommended for production)
