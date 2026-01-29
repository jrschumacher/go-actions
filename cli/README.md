# go-actions CLI

Local CLI tool for running go-actions CI checks locally, enabling local/CI parity and reducing wasted CI minutes.

## Installation

### From Source
```bash
cd cli
go install .
```

### Using go install (once published)
```bash
go install github.com/jrschumacher/go-actions/cli@latest
```

## Quick Start

1. Initialize configuration in your Go project:
```bash
go-actions init
```

2. Run all enabled checks:
```bash
go-actions check
```

3. Run a specific check:
```bash
go-actions check lint
go-actions check test
go-actions check security
```

## Commands

### `go-actions version`
Print version information.

```bash
$ go-actions version
go-actions v0.1.0
```

### `go-actions init`
Initialize a `.go-actions.yaml` configuration file with recommended settings.

```bash
$ go-actions init
Detected: Go 1.22, golangci-lint config present
Created .go-actions.yaml with recommended settings
```

### `go-actions check`
Run all enabled checks locally.

```bash
$ go-actions check
Running: lint, test, security

✓ lint     (2.3s) - 0 issues
✓ test     (5.1s) - 94% coverage (threshold: 80%)
✓ security (1.2s) - 0 vulnerabilities

All checks passed. Safe to push.
```

Run a specific check:
```bash
$ go-actions check lint
Running: lint

✓ lint (2.3s) - 0 issues

All checks passed. Safe to push.
```

JSON output for CI/automation:
```bash
$ go-actions check --format=json
{
  "checks": [
    {
      "name": "lint",
      "status": "pass",
      "duration": 2300000000,
      "issues": 0
    },
    {
      "name": "test",
      "status": "pass",
      "duration": 5100000000,
      "coverage": 94,
      "threshold": 80
    },
    {
      "name": "security",
      "status": "pass",
      "duration": 1200000000,
      "vulnerabilities": 0
    }
  ],
  "total_duration": 8600000000,
  "status": "pass"
}
```

### `go-actions hooks` (stub)
Placeholder for future git hooks management functionality.

## Configuration

The CLI reads configuration from `.go-actions.yaml` in the current directory or any parent directory.

Example configuration:
```yaml
version: 1

ci:
  test:
    enabled: true
    args: "-v -race ./..."
    coverage:
      enabled: true
      threshold: 80

  lint:
    enabled: true
    version: "v2.0.2"
    args: "run ./..."

  security:
    enabled: true
    version: "latest"
    args: "./..."
    fail-on: "high"

  benchmark:
    enabled: false
    args: "-bench=. -benchmem"
    count: 5

output:
  format: "auto"  # auto, json, text
  verbosity: "normal"
```

See `.go-actions.example.yaml` in the repository root for a complete example.

## Available Checks

- **lint**: Run `golangci-lint` for code quality checks
- **test**: Run `go test` with coverage reporting
- **security**: Run `govulncheck` for vulnerability scanning
- **benchmark**: Run `go test -bench` for performance testing

## Exit Codes

- `0`: All checks passed
- `1`: One or more checks failed
- `2`: Error occurred during execution

## Requirements

The CLI requires the following tools to be installed for the respective checks:

- `go` (required for all checks)
- `golangci-lint` (for lint check)
- `govulncheck` (for security check)

The CLI will warn if required tools are missing.

## Development

### Build
```bash
go build -o go-actions .
```

### Test
```bash
go test ./...
```

### Run locally
```bash
./go-actions check
```

## Future Enhancements

- Git hooks management (`go-actions hooks`)
- AI agent integration for auto-fixing issues
- Watch mode for continuous checking
- Parallel check execution
- Custom check plugins
