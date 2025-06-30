# Test Fixtures

This directory contains test fixtures for validating the go-actions behavior in different scenarios.

## `go-valid/`

A complete, valid Go project that includes all required files for go-actions:

- ✅ `go.mod` - Go module file
- ✅ `main.go` - Go source files  
- ✅ `main_test.go` - Test files with benchmarks
- ✅ `.golangci.yml` - Linting configuration
- ✅ `.release-please-config.json` - Release Please configuration
- ✅ `.release-please-manifest.json` - Release Please manifest
- ✅ `.goreleaser.yaml` - GoReleaser configuration
- ✅ `.github/workflows/ci.yaml` - Workflow using go-actions

**Expected validation result**: ✅ **PASS** - All validations should succeed

## `go-invalid/`

An incomplete Go project that is missing required files for go-actions:

- ❌ **Missing** `go.mod` - Required for CI actions
- ✅ `main.go` - Go source files present
- ✅ `main_test.go` - Test files present
- ❌ **Missing** `.release-please-config.json` - Required for release action
- ❌ **Missing** `.release-please-manifest.json` - Required for release action
- ❌ **Missing** `.goreleaser.yaml` - Required for release action
- ✅ `.github/workflows/ci.yaml` - Workflow using go-actions

**Expected validation result**: ❌ **FAIL** - Should detect missing files:
- `go.mod (required for CI actions)`
- `.release-please-config.json (required for release action)`
- `.release-please-manifest.json (required for release action)`
- `.goreleaser.yaml or .goreleaser.yml (required for release action)`

## Usage in Tests

These fixtures are used by:

1. **TypeScript unit tests** - To test validation logic without external dependencies
2. **CI workflows** - To verify actions work correctly in real GitHub Actions environment
3. **Integration tests** - To test end-to-end functionality

## Testing Locally

```bash
# Test valid fixture
node -e "
const { validateWorkflows } = require('./scripts-dist/workflow-validator.js');
const result = validateWorkflows('./fixtures/go-valid');
console.log('Valid fixture:', result);
"

# Test invalid fixture  
node -e "
const { validateWorkflows } = require('./scripts-dist/workflow-validator.js');
const result = validateWorkflows('./fixtures/go-invalid');
console.log('Invalid fixture:', result);
"
```