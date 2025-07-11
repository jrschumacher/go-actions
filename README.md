# go-actions for all your GitHub Actions needs

Go Actions is a composite action that simplifies the management of GitHub Actions for Go projects. It builds off of the work done by go-releaser, release-please, and golangci-lint to provide a comprehensive solution for Go developers.

## 🚀 Want to simplify your workflow management? Let's get started!

Setting up CI/CD for Go projects can be complex, but we'll guide you through it step by step. Follow these three simple steps to get a complete CI/CD setup:

### Step 1: Self-Validator Workflow 🔍

First, let's make sure your project is ready for automation. Create `.github/workflows/go-action-validator.yaml`:

```yaml
name: Go Actions Validator

on:
  pull_request:
    paths:
      - '.github/workflows/**'
      - 'go.mod'
      - 'go.sum'
      - '.release-please-config.json'
      - '.release-please-manifest.json'
      - '.goreleaser.yaml'
      - '.goreleaser.yml'
      - '.golangci.yml'
      - '.golangci.yaml'

# Required for self-validator to comment on PRs
permissions:
  contents: read
  pull-requests: write

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: jrschumacher/go-actions/self-validate@v1
```

This workflow runs whenever you modify your project configuration and validates that everything is set up correctly for the other workflows. **Important:** The `pull-requests: write` permission is required for the self-validator to post helpful guidance comments on PRs.

### Step 2: CI Workflow 🧪

Once validation passes, add continuous integration with `.github/workflows/ci.yaml`:

```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: jrschumacher/go-actions/ci@v1
        with:
          job: test

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: jrschumacher/go-actions/ci@v1
        with:
          job: lint

  benchmark:
    runs-on: ubuntu-latest
    if: github.event_name == 'push'  # Only on main branch
    steps:
      - uses: jrschumacher/go-actions/ci@v1
        with:
          job: benchmark
```

### Step 3: Release Workflow 🚀

Finally, automate your releases with `.github/workflows/release.yaml`:

```yaml
name: Release

on:
  push:
    branches: [ main ]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: jrschumacher/go-actions/release@v1
        with:
          release-token: ${{ secrets.RELEASE_PLEASE_TOKEN }}
```

**Important:** You'll need to create a Personal Access Token (PAT) with `contents:write` and `pull_requests:write` permissions and add it as `RELEASE_PLEASE_TOKEN` in your repository secrets.

## 📋 Required Configuration Files

The self-validator will guide you, but here are the files you'll need:

### For Release Job:
- `.release-please-config.json`:
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

- `.release-please-manifest.json`:
```json
{
  ".": "0.1.0"
}
```

- `.goreleaser.yaml` (run `goreleaser init` to create)

### For Lint Job (Optional):
- `.golangci.yml` or `.golangci.yaml` (golangci-lint will use defaults if not present)

## 🎯 Available Actions

### CI Actions (`jrschumacher/go-actions/ci@v1`)
- **test**: Run Go tests with coverage reporting
- **lint**: Run golangci-lint for code quality  
- **benchmark**: Run Go benchmarks with multiple iterations

### Release Actions (`jrschumacher/go-actions/release@v1`)
- Automated releases using Release Please + GoReleaser
- No job parameter needed - it's a dedicated release action

### Self-Validate Action (`jrschumacher/go-actions/self-validate@v1`)
- Validates your project configuration for all go-actions workflows
- Checks for required files and configurations
- No job parameter needed - it's a dedicated validation action

### Comment Action (`jrschumacher/go-actions/comment@v1`)
- Posts unified CI results to pull requests
- Consolidates test coverage, lint results, and benchmark results
- Updates existing comments instead of creating new ones

## 🔄 Unified PR Comments

To get beautiful unified PR comments that consolidate all CI results, add this job to your CI workflow:

```yaml
# Required for comment action to post PR comments
permissions:
  contents: read
  pull-requests: write

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: jrschumacher/go-actions/ci@v1
        with:
          job: test

  lint:
    runs-on: ubuntu-latest  
    steps:
      - uses: jrschumacher/go-actions/ci@v1
        with:
          job: lint

  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: jrschumacher/go-actions/ci@v1
        with:
          job: benchmark

  # Post unified comment after all jobs complete
  comment:
    runs-on: ubuntu-latest
    needs: [test, lint, benchmark]
    if: always() && github.event_name == 'pull_request'
    steps:
      - uses: jrschumacher/go-actions/comment@v1
```

This creates a single comment that shows:
- ✅ Overall status (success/failure)  
- 📊 Summary table of all job results
- 🧪 Detailed test coverage with guidelines
- 🔍 Lint results and any errors
- ⚡ Benchmark results and configuration
- 🔧 Self-validation results (if used)

## 📦 Versioning and Releases

go-actions follows semantic versioning and uses automated releases:

### Recommended Usage
- **Stable**: Use `@v1` for the latest stable version
- **Specific**: Use `@v1.2.3` for exact version pinning  
- **Latest**: Use `@main` for bleeding edge (not recommended for production)

### Major Version Tags
- `@v1` - Always points to latest v1.x.x release
- `@v2` - Future major version (when available)

### Release Process
1. **Automated**: Releases are created automatically when changes are merged to `main`
2. **Testing**: All releases are thoroughly tested with real Go projects
3. **Tagging**: Major tags (`v1`, `v2`) are automatically updated
4. **Documentation**: README is updated with new version references

## 🔧 Development and Contributing

### For go-actions Developers

**Testing your changes:**
```bash
# Run tests
npm test

# Build TypeScript
npm run build

# Test with real workflows
.github/workflows/ci.yaml
```

**Release process:**
1. Make changes and create PR
2. Merge to `main` triggers automated testing
3. Release Please creates release PR with changelog
4. Merge release PR creates new tag and updates major version tags

### Architecture
- **TypeScript**: All complex logic in `scripts/` directory
- **Compiled**: JavaScript output in `scripts-dist/` (auto-updated)
- **Composite Actions**: YAML files reference compiled JavaScript
- **Testing**: Comprehensive test suite with 98%+ coverage

