# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a GitHub composite actions repository that provides focused solutions for Go projects' CI/CD workflows. It consists of three main actions: CI, Release, and Self-Validate, each with specific responsibilities.

## Architecture

The repository contains three separate composite actions:

### CI Action (`ci/action.yaml`)
Handles development and quality assurance workflows:
- **test**: Runs Go tests with coverage reporting
- **lint**: Runs golangci-lint for code quality checks  
- **benchmark**: Runs Go benchmarks with configurable iterations

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

## TypeScript Backend

The actions use TypeScript for complex logic, providing type safety and testability:

### Core Modules (`scripts/`)
- **`workflow-validator.ts`**: Validates workflow files and project configuration
- **`coverage-extractor.ts`**: Extracts test coverage from Go coverage files
- **`benchmark-runner.ts`**: Runs Go benchmarks with multiple iterations
- **`validate-project.ts`**: Comprehensive Go project structure validation
- **`validate-release.ts`**: Release Please configuration validation

### Compiled JavaScript (`scripts-dist/`)
- All TypeScript modules are compiled to JavaScript for GitHub Actions consumption
- Source maps and type definitions included for debugging

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
- **Jest**: Testing framework with TypeScript support
- **98.7% test coverage** across all modules
- **68 test cases** covering various environmental scenarios
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
- **Lint**: `golangci-lint-version` (defaults to `v2.1.0`), `lint-args`
- **Benchmark**: `benchmark-args` (defaults to `-bench=. -benchmem`), `benchmark-count` (defaults to 5)

### Release Action Inputs:
- `go-version`: Explicit Go version (overrides file-based detection)
- `go-version-file`: Custom version file path (defaults to go.mod)
- `working-directory`: Working directory for operations
- `release-token`: Personal Access Token (required for creating PRs)

### Self-Validate Action Inputs:
- `workflow-paths`: Workflow files to check (defaults to `.github/workflows/*.yaml,.github/workflows/*.yml`)
- `comment-on-pr`: Whether to comment on PR with results (defaults to `true`)

## Code Quality Standards

### TypeScript Best Practices
- **Strict typing**: All functions have proper type annotations
- **Interface definitions**: Clear contracts for data structures
- **Error handling**: Comprehensive error catching and reporting
- **Modular design**: Each module has a single responsibility

### Testing Requirements
- **Unit tests required** for all new TypeScript functions
- **Coverage target**: Maintain >95% test coverage
- **Test scenarios**: Must cover success, failure, and edge cases
- **Mocked dependencies**: External dependencies must be mocked

### Performance Considerations
- **Bash for simple operations**: Use bash for file checks and simple commands
- **TypeScript for complex logic**: Use TypeScript for validation, parsing, and workflows
- **Minimal GitHub Script overhead**: Reduce Node.js startup costs where possible

## Important Notes

### File Structure
- TypeScript source files in `scripts/`
- Compiled JavaScript in `scripts-dist/` (committed for GitHub Actions)
- Test files use `.test.ts` suffix
- Jest configuration in `jest.config.js`

### Action Requirements
- CI action assumes Go projects follow standard conventions (go.mod at root, `./...` for recursive operations)
- Coverage reporting requires tests to generate `coverage.out` file
- Release action requires a Personal Access Token (PAT) - GITHUB_TOKEN cannot create PRs
- Release action expects `.goreleaser.yaml` in the consuming repository
- Self-validate runs without Go setup for lightweight validation

### golangci-lint Version Management
- Default version is `v2.1.0` (can be overridden with `golangci-lint-version`)
- Self-validate checks version compatibility between workflow and config file
- Supports both `.golangci.yml` and `.golangci.yaml` formats
- Validates major version compatibility (v1 vs v2)

### Development Workflow
1. Make changes to TypeScript files in `scripts/`
2. Add/update tests in corresponding `.test.ts` files
3. Run `npm test` to ensure all tests pass
4. Run `npm run build` to compile TypeScript
5. Commit both source and compiled files
6. Test changes in actual GitHub Actions workflows