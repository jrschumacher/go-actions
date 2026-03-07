# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a GitHub composite actions repository that provides focused solutions for Go projects' CI/CD workflows. It consists of three main actions: CI, Release, and Self-Validate, each with specific responsibilities.

## Architecture

The repository contains three separate composite actions:

### CI Action (`ci/action.yaml`)
Handles development and quality assurance workflows:
- **test**: Runs Go tests with coverage reporting
- **lint**: Runs golangci-lint for code quality checks with detailed issue formatting in PR comments
  - Issues are grouped by linter type (errcheck, staticcheck, etc.)
  - Collapsible sections for easy navigation
  - Intelligent truncation for large outputs
  - Direct links to workflow logs
- **benchmark**: Runs Go benchmarks with configurable iterations
- **security**: Runs govulncheck for CVE scanning in dependencies
  - Uses official Go vulnerability database
  - Call-graph aware (only reports vulnerabilities in code paths you actually use)
  - Results formatted in PR comments with severity levels and fix guidance

### Release Action (`release/action.yaml`)
Handles automated releases:
- Uses Release Please to create release PRs
- Uses GoReleaser to build and publish releases
- Requires Personal Access Token (PAT) for PR creation

### Self-Validate Action (`self-validate/action.yaml`)
Validates project configuration when go-actions are used:
- Scans workflow files for go-actions usage
- Validates required files exist for detected actions
- Comments on PRs with validation results and helpful examples
- Checks golangci-lint version compatibility

## Go CLI (`cli/`)

The core CI/CD logic is implemented as a Go CLI for local/CI parity:

### Commands
- **`go-actions check [test|lint|benchmark|security]`**: Run CI checks locally
- **`go-actions validate`**: Validate project configuration (golangci-lint, release files)

### Internal Packages (`cli/internal/`)
- **`benchmark/`**: Runs Go benchmarks with multiple iterations
- **`config/`**: Configuration loading and parsing
- **`coverage/`**: Extracts test coverage from Go coverage files
- **`lint/`**: Runs golangci-lint and formats output
- **`security/`**: Runs govulncheck for CVE scanning
- **`validate/`**: Project structure and configuration validation

## TypeScript (PR Comments Only)

TypeScript is only used for unified PR comment functionality:

### Core Modules (`scripts/`)
- **`unified-pr-comment.ts`**: Formats and posts unified CI results to PRs
- **`action-comment.ts`**: Entry point for comment action

### Compiled JavaScript (`scripts-dist/`)
- **`unified-comment-bundle/`**: Bundled comment functionality for GitHub Actions

## Development Commands

### TypeScript Development
```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to JavaScript
npm run clean        # Remove compiled files
npm test             # Run comprehensive test suite
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
```

### Testing Infrastructure
- **Go tests**: `cd cli && go test ./...` for CLI logic
- **Jest**: Testing framework for TypeScript PR comment functionality
- **Mocked dependencies**: fs, child_process for isolated testing

### GitHub Actions Testing
1. Made changes to TypeScript files
2. Run `npm run build` to compile
3. Push changes to a branch
4. Reference the action in a test workflow:
   - `uses: jrschumacher/go-actions/ci@branch-name`
   - `uses: jrschumacher/go-actions/release@branch-name`
   - `uses: jrschumacher/go-actions/self-validate@branch-name`
5. Verify the action runs correctly in the workflow

## Input Configuration

### CI Action Inputs:
**Global Inputs (all jobs):**
- `go-version`: Explicit Go version (overrides file-based detection)
- `go-version-file`: Custom version file path (defaults to go.mod)
- `working-directory`: Working directory for operations

**Job-Specific Inputs:**
- **Test**: `test-args` (defaults to `-v -race -coverprofile=coverage.out`)
- **Lint**: `golangci-lint-version` (defaults to `auto` for Go-version-aware selection from stable matrix, or `latest` for bleeding edge), `lint-args`
- **Benchmark**: `benchmark-args` (defaults to `-bench=. -benchmem`), `benchmark-count` (defaults to 5)
- **Security**: `govulncheck-version` (defaults to `latest`), `security-args`

### Release Action Inputs:
- `go-version`: Explicit Go version (overrides file-based detection)
- `go-version-file`: Custom version file path (defaults to go.mod)
- `working-directory`: Working directory for operations
- `release-token`: Personal Access Token (required for creating PRs)

### Self-Validate Action Inputs:
- `workflow-paths`: Workflow files to check (defaults to `.github/workflows/*.yaml,.github/workflows/*.yml`)
- `comment-on-pr`: Whether to comment on PR with results (defaults to `true`)

## Code Quality Standards

### Go CLI Standards
- **Idiomatic Go**: Follow standard Go conventions and patterns
- **Error handling**: Use Go error handling patterns, wrap errors with context
- **Testing**: Unit tests required for all packages in `cli/internal/`
- **Modular design**: Each package has a single responsibility

### TypeScript Standards (PR Comments Only)
- **Strict typing**: All functions have proper type annotations
- **Interface definitions**: Clear contracts for data structures
- **Error handling**: Comprehensive error catching and reporting

### Performance Considerations
- **Go CLI for CI checks**: Fast execution, single binary, no Node.js overhead
- **TypeScript for PR comments**: GitHub Script integration for API access
- **Minimal dependencies**: Prefer standard library solutions

## Important Notes

### File Structure
- Go CLI source in `cli/`
- Go CLI tests use `_test.go` suffix
- TypeScript source files in `scripts/` (PR comments only)
- Compiled JavaScript in `scripts-dist/` (committed for GitHub Actions)

### Action Requirements
- CI action assumes Go projects follow standard conventions (go.mod at root, `./...` for recursive operations)
- Coverage reporting requires tests to generate `coverage.out` file
- Release action requires a Personal Access Token (PAT) - GITHUB_TOKEN cannot create PRs
- Release action expects `.goreleaser.yaml` in the consuming repository
- Self-validate uses Go CLI for validation

### golangci-lint Version Management
- **Three version modes**:
  - `auto` (default): Uses stable compatibility matrix based on Go version
  - `latest`: Fetches newest release from GitHub (bleeding edge)
  - Explicit version (e.g., `v2.8.0`): Pinned for reproducibility
- **Auto-detection compatibility matrix**:
  - Go 1.25+: uses golangci-lint v2.8.0
  - Go 1.24: uses golangci-lint v2.3.1
  - Go 1.23 and earlier: uses golangci-lint v2.1.0
- Self-validate checks version compatibility between workflow and config file
- Supports both `.golangci.yml` and `.golangci.yaml` formats
- Validates major version compatibility (v1 vs v2)

**Version Update Process**:

The CI action uses manual installation of golangci-lint (not golangci-lint-action) to avoid cache collision issues. Auto-detection ensures compatibility with the project's Go version.

**To update the compatibility matrix**:
1. Check [golangci-lint releases](https://github.com/golangci/golangci-lint/releases) for new v2.x versions
2. Update the compatibility matrix in `ci/action.yaml` (Install golangci-lint step)
3. Test the change:
   - Run `cd cli && go test ./...` to ensure Go tests pass
   - Run `npm test` to ensure TypeScript tests pass
   - Test in a real workflow with actual Go projects
   - Verify the new version doesn't introduce breaking changes
4. Update this documentation with new version mappings
5. Document any breaking changes or new features in commit message

**Maintenance Schedule**: Check for new v2.x releases quarterly to catch:
- Go version compatibility updates (new Go releases need newer golangci-lint)
- Security patches
- Performance improvements
- New linter support

**Why Manual Installation**:
- Enables Go-version-aware auto-detection of compatible golangci-lint
- Eliminates cache collision errors (`gtar: Cannot open: File exists`)
- Provides direct control over installation process
- Better error visibility and troubleshooting
- No dependency on third-party action maintenance
- Faster execution without cache restoration overhead

**CRITICAL: golangci-lint v2 Configuration Requirement**
- **The `version: 2` field is MANDATORY** in `.golangci.yml` for golangci-lint v2.x
- **This is the #1 cause of lint failures** - error: "can't load config: unsupported version of the configuration: ''"
- **Always include** `version: 2` (numeric 2, NOT "v2" or "2.0") at the top of any `.golangci.yml` file
- **Common mistakes**:
  - `version: v2` (wrong - no "v" prefix)
  - `version: 2.0` (wrong - use `2`)
  - Using v1 schema fields: `linters-settings` → use `linters.settings` in v2
  - Using v1 schema fields: `issues.exclude-rules` → use `linters.exclusions.rules` in v2
- **Correct values**: `version: 2` or `version: "2"` (both work)
- **Self-validate will detect** missing or incorrect version field and provide the exact fix in PR comments

**RECOMMENDED: Start with defaults, customize only when needed**
- **Philosophy**: golangci-lint v2 has excellent defaults - use them!
- **Minimal config is best**: Only add configuration when you need to override defaults
- **Don't over-configure**: Avoid specifying every linter - let golangci-lint choose sensible defaults

**Example ultra-minimal config** (RECOMMENDED for local development):
  ```yaml
  version: 2  # That's it! golangci-lint will use sensible defaults

  run:
    timeout: 5m  # Optional: increase if needed
  ```

**Example CI/CD-ready config** (RECOMMENDED for GitHub Actions):
  ```yaml
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

  **Why path exclusions are essential in CI/CD**:
  - **Dependencies**: vendor/ and node_modules/ are external code you shouldn't lint
  - **Generated Files**: Proto files (*.pb.go) and generated code shouldn't be linted
  - **Version Control**: .git/ directory contains no Go code to lint

  **When to use**:
  - Running in GitHub Actions or similar CI/CD
  - Project uses code generation (protobuf, mockery, wire)
  - Vendoring dependencies

**Real-world example** (from [workctl](https://github.com/jrschumacher/workctl)) - balanced approach:
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
          - github.com/your-org/your-repo

  issues:
    max-issues-per-linter: 0
    max-same-issues: 0
  ```

**When to grow from minimal to customized:**
- Start ultra-minimal when setting up a new project
- Add specific linters when you need stricter checks
- Configure settings when defaults don't fit your needs
- The workctl example shows a balanced, production-ready approach

- **If you need to customize** - only add what you actually need:
  ```yaml
  version: 2

  run:
    timeout: 5m
    go: '1.24'  # Only if you need specific Go version

  # Optional: Only enable specific linters if defaults aren't enough
  linters:
    enable:
      - gofmt
      - govet
      - errcheck
      - staticcheck
  ```

- **Advanced: with settings and exclusions** (only if you need them):
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

    # v2 schema: linter-specific settings
    settings:
      govet:
        check-shadowing: true

    # v2 schema: exclusion rules
    exclusions:
      rules:
        - path: _test\.go
          linters:
            - errcheck
  ```

### Project Setup Checklist (for AI agents)

When setting up go-actions for a new Go project, follow this complete checklist. Do not stop after CI — release automation should be part of the initial setup.

**1. CI Setup:**
- Create `.github/workflows/ci.yaml` with test, lint, security, and comment jobs
- Create `.golangci.yml` with `version: 2` (see config examples above)
- Optionally create `.go-actions.yaml` for custom CI configuration

**2. Release Setup (do this alongside CI, not later):**
- Create `.github/workflows/release.yaml` with `actions/checkout@v4` (with `fetch-depth: 0` and `token`) followed by `jrschumacher/go-actions/release@v3`
- Create `.release-please-config.json`:
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
- Create `.release-please-manifest.json`:
  ```json
  {
    ".": "0.1.0"
  }
  ```
- Create `.goreleaser.yaml` (run `goreleaser init` or provide a minimal config)
- Remind the user to create a `RELEASE_PLEASE_TOKEN` secret (PAT with `contents:write` and `pull_requests:write`)

**3. Validation:**
- Include the `self-validate` job in the CI workflow to catch configuration issues early

### Development Workflow
1. Make changes to TypeScript files in `scripts/`
2. Add/update tests in corresponding `.test.ts` files
3. Run `npm test` to ensure all tests pass
4. Run `npm run build` to compile TypeScript
5. Commit both source and compiled files
6. Test changes in actual GitHub Actions workflows

### Release and Tagging Workflow
**IMPORTANT**: Follow this exact sequence when releasing fixes or features:

1. **Commit**: Create commit with descriptive message including Claude attribution
2. **Push**: Push changes to remote repository (`git push origin main`)
3. **Tag new version**: Create specific version tag (e.g., `git tag v3.0.2`)
4. **Retag v3**: Update the `v3` tag to point to latest stable version (`git tag -f v3`)
5. **Push tags**: Push all tags to remote (`git push --tags --force`)

**Rationale**:
- Consuming repositories use `@v3` as a moving tag for latest stable release
- Specific version tags (v3.0.1, v3.0.2, etc.) provide fixed points for rollback
- The `v3` tag should always point to the most recent stable version
- Force push is needed when retagging `v3` to update remote