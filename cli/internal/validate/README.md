# Workflow Validator Package

This package provides Go implementation of the workflow validator, ported from TypeScript.

## Overview

The validator scans GitHub Actions workflow files for `go-actions` usage and validates that required configuration files exist and are properly configured.

## Files

- `types.go` - Type definitions and constants
- `validator.go` - Main validation logic
- `validator_test.go` - Comprehensive test suite (83.3% coverage)

## Usage

### Basic Usage

```go
import "github.com/jrschumacher/go-actions/cli/internal/validate"

// Validate a project with default workflow paths
result, err := validate.ValidateProject(".", nil)
if err != nil {
    // Handle error
}

if !result.Valid {
    for _, issue := range result.Errors {
        fmt.Printf("Error: %s - %s\n", issue.Code, issue.Message)
    }
}
```

### Custom Workflow Paths

```go
workflowPaths := []string{
    ".github/workflows/*.yaml",
    ".github/workflows/*.yml",
}

result, err := validate.ValidateProject("/path/to/project", workflowPaths)
```

### Check Specific Version Compatibility

```go
issue := validate.CheckGolangciVersion("v2.0.2", "1")
if issue != nil {
    fmt.Printf("Version mismatch: %s\n", issue.Message)
}
```

## Key Features

### Detects Actions

- `ci` - CI workflow action
- `release` - Release workflow action
- `self-validate` - Self-validation action

### Validates Requirements

#### CI Action
- `go.mod` must exist
- golangci-lint version compatibility (v2+ required for golangci-lint-action@v8)
- Config file version matching (`.golangci.yml` or `.golangci.yaml`)

#### Release Action
- Release Please config files (`release-please-config.json`, `.release-please-manifest.json`)
- GoReleaser config (`.goreleaser.yaml` or `.goreleaser.yml`)
- GoReleaser config content validation

### Validation Issues

#### Error Types
- `missing_file` - Required file is missing
- `version_mismatch` - Version mismatch between workflow and config
- `incompatible_versions` - Incompatible version combinations
- `goreleaser_config` - GoReleaser configuration issues
- `release_please_config` - Release Please configuration issues

#### Severity Levels
- `error` - Must be fixed
- `warning` - Should be reviewed

## API

### Types

```go
type ValidationResult struct {
    Valid    bool               // Overall validation status
    Errors   []ValidationIssue  // Critical issues
    Warnings []ValidationIssue  // Non-critical issues
    Actions  []DetectedAction   // Detected go-actions
}

type ValidationIssue struct {
    File     string // Affected file
    Line     int    // Line number (if applicable)
    Message  string // Human-readable message
    Code     string // Issue type code
    Severity string // "error" or "warning"
    Expected string // Expected value (for mismatches)
    Actual   string // Actual value (for mismatches)
}

type DetectedAction struct {
    Name     string // ci, release, self-validate
    Version  string // v1, main, commit hash
    Workflow string // Workflow file name
}
```

### Functions

```go
// ValidateProject validates a Go project for go-actions compatibility
func ValidateProject(dir string, workflowPaths []string) (*ValidationResult, error)

// CheckGolangciVersion checks compatibility between workflow and config versions
func CheckGolangciVersion(workflowVersion, configVersion string) *ValidationIssue

// NewValidator creates a new Validator instance
func NewValidator(workingDir string) *Validator
```

## Testing

Run tests with coverage:

```bash
go test ./internal/validate/... -cover
```

Run specific tests:

```bash
go test ./internal/validate/... -run TestValidateProject
```

## Implementation Notes

### Differences from TypeScript Version

1. **Error Handling**: Go uses explicit error returns instead of try-catch
2. **File I/O**: Uses `os.ReadFile` and `os.Stat` instead of Node.js `fs` module
3. **Pattern Matching**: Uses `filepath.Glob` instead of `fs.readdirSync` with filters
4. **Regular Expressions**: Uses Go's `regexp` package with similar patterns
5. **Type Safety**: Go's static typing provides compile-time safety

### Design Decisions

1. **Simplicity First**: Clear, readable code over clever optimizations
2. **Composition**: Validator struct with method receivers for state management
3. **Explicit Error Handling**: No hidden exceptions, all errors returned explicitly
4. **Table-Driven Tests**: Comprehensive test coverage using Go's table-driven pattern
5. **Minimal Dependencies**: Uses only standard library (no external dependencies)

### Performance

- Fast execution (< 250ms for typical projects)
- Low memory footprint
- Efficient regex caching
- Minimal file I/O (only reads files that exist)

## Future Enhancements

Potential improvements:

1. Parallel workflow file processing
2. Caching of validation results
3. JSON output format for CI integration
4. Integration with CLI commands
5. Custom validation rules via config

## Examples

### Example 1: Valid CI Workflow

```yaml
# .github/workflows/ci.yaml
name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: jrschumacher/go-actions/ci@v1
        with:
          job: test
```

With `go.mod` present → Valid

### Example 2: Version Mismatch

Workflow:
```yaml
- uses: jrschumacher/go-actions/ci@v1
  with:
    golangci-lint-version: v2.0.2
```

Config (`.golangci.yml`):
```yaml
version: 1
```

→ Error: Version mismatch (workflow expects v2, config has version 1)

### Example 3: Incompatible Version

```yaml
- uses: jrschumacher/go-actions/ci@v1
  with:
    golangci-lint-version: v1.54.2
```

→ Error: golangci-lint v1 incompatible with golangci-lint-action@v8
