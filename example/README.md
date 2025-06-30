# Go Actions Example

This is a complete example Go project that demonstrates the capabilities of the [go-actions](https://github.com/jrschumacher/go-actions) composite GitHub Actions.

## What This Demonstrates

### ✅ CI Action Features
- **Testing**: Comprehensive unit tests with test coverage
- **Linting**: golangci-lint configuration with multiple linters enabled
- **Benchmarking**: Performance benchmarks for key functions

### ✅ Release Action Features
- **Release Please**: Automated version management and changelog generation
- **GoReleaser**: Multi-platform binary building and GitHub release publishing

### ✅ Self-Validate Action Features
- **Project Validation**: Ensures all required configuration files are present
- **Configuration Checks**: Validates golangci-lint version compatibility

## Project Structure

```
example/
├── main.go                        # Main application with example functions
├── main_test.go                   # Comprehensive test suite with benchmarks
├── go.mod                         # Go module definition
├── .golangci.yml                  # golangci-lint configuration
├── .release-please-config.json    # Release Please configuration
├── .release-please-manifest.json  # Release Please version manifest
├── .goreleaser.yaml               # GoReleaser build configuration
└── README.md                      # This file
```

## Example Functions

The project includes various types of functions to showcase different testing and linting scenarios:

- **Basic arithmetic**: Add, Subtract, Multiply, Divide
- **String operations**: JoinStrings, ReverseString
- **Math functions**: Sqrt, Power
- **Algorithms**: Fibonacci, IsPrime
- **Input validation**: IsValidEmail, ParseAndSum

## Running Locally

```bash
# Run tests
go test -v -race -coverprofile=coverage.out ./...

# Run benchmarks
go test -bench=. -benchmem ./...

# Run linter
golangci-lint run

# Build the application
go build -o calculator ./...

# Run the application
./calculator
```

## GitHub Actions Usage

This example project can be used to test the go-actions:

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jrschumacher/go-actions/ci@v1
        with:
          job: test
          working-directory: example

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jrschumacher/go-actions/ci@v1
        with:
          job: lint
          working-directory: example

  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jrschumacher/go-actions/ci@v1
        with:
          job: benchmark
          working-directory: example

  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jrschumacher/go-actions/self-validate@v1
        with:
          workflow-paths: .github/workflows/*.yaml
```

## Configuration Files Explained

### `.golangci.yml`
Configures the golangci-lint tool with:
- Multiple linters enabled for comprehensive code quality checks
- Custom settings for complexity, line length, and formatting
- Exclusions for test files where appropriate

### `.release-please-config.json`
Configures Release Please for:
- Go release type
- Package name for changelog generation
- Automated version bumping based on conventional commits

### `.release-please-manifest.json`
Tracks the current version of the project for Release Please

### `.goreleaser.yaml`
Configures GoReleaser for:
- Multi-platform builds (Linux, Windows, macOS)
- Multiple architectures (386, amd64, ARM, ARM64)
- Archive generation with checksums
- GitHub release publishing

## Test Coverage

The project maintains high test coverage with:
- Unit tests for all public functions
- Table-driven tests for comprehensive scenario coverage
- Benchmark tests for performance monitoring
- Error case testing for robust error handling

## Performance Benchmarks

Included benchmarks test:
- Arithmetic operations
- String manipulation
- Mathematical calculations
- Input parsing and validation

This provides a baseline for performance regression testing in CI pipelines.