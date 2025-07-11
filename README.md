# go-actions for all your GitHub Actions needs

Go Actions is a composite action that simplifies the management of GitHub Actions for Go projects. It builds off of the work done by go-releaser, release-please, and golangci-lint to provide a comprehensive solution for Go developers.

## 🚀 Want to simplify your workflow management? Let's get started!

Setting up CI/CD for Go projects can be complex, but we'll guide you through it step by step. Follow these three simple steps to get a complete CI/CD setup:

### Step 1: Complete CI Workflow 🔍🧪

Create a single unified workflow `.github/workflows/ci.yaml` that handles validation, testing, and PR comments:

```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

# Required for unified PR comments
permissions:
  contents: read
  pull-requests: write

jobs:
  # Step 1: Validate go-actions configuration
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: jrschumacher/go-actions/self-validate@v1

  # Step 2: Run CI jobs (only if validation passes)
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
    if: github.event_name == 'push'  # Only on main branch
    steps:
      - uses: jrschumacher/go-actions/ci@v1
        with:
          job: benchmark

  # Step 3: Post unified results comment
  comment:
    runs-on: ubuntu-latest
    if: always() && github.event_name == 'pull_request'
    steps:
      - uses: jrschumacher/go-actions/comment@v1
```

This single workflow:
- ✅ **Validates** your go-actions configuration first
- ✅ **Runs CI jobs** only if validation passes
- ✅ **Posts unified comment** with all results
- ✅ **No race conditions** - proper job dependencies

### Step 2: Release Workflow 🚀

Add automated releases with `.github/workflows/release.yaml`:

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

## 🔄 Unified Go Actions Report

The CI workflow above automatically creates a beautiful unified comment on pull requests:

```
# Go Actions Report

✅ **Validated**
✅ **Tests** (85% coverage)  
❌ **Lint** (issues found)
✅ **Benchmarks**

<details><summary>Validation Details</summary>
Actions configured: ci, self-validate, release
All configuration files present and valid
</details>

<details open><summary>Lint Issues</summary>
golangci-lint Version - Upgrade needed for compatibility
- ❌ Current: v1.62.2
- ✅ Required: v2.1.0 or higher
- 🔧 Simple fix: Update version in your workflow
</details>
```

This unified comment shows:
- ✅ **Real-time status** for all go-actions components
- 📊 **Clean overview** with expandable details  
- 🧪 **Test coverage** with improvement suggestions
- 🔍 **Lint issues** with actionable fix guidance
- ⚡ **Benchmark results** and configuration
- 🔧 **Configuration validation** with specific solutions

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

