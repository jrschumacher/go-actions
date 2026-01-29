# Benchmark Package

Go implementation of the benchmark runner, ported from TypeScript.

## Overview

The benchmark package provides a safe, robust way to run Go benchmarks with multiple iterations, parse benchmark output, calculate statistics, and format results.

## Features

- **Safe Argument Parsing**: Validates and parses benchmark arguments to prevent shell injection
- **Multiple Iterations**: Run benchmarks multiple times and collect statistics
- **Comprehensive Parsing**: Parses Go benchmark output format including ns/op, B/op, and allocs/op metrics
- **Statistical Analysis**: Calculates min, max, mean, and standard deviation across runs
- **JSON & Text Output**: Support for both machine-readable JSON and human-readable text output

## Usage

### Basic Example

```go
package main

import (
    "fmt"
    "github.com/jrschumacher/go-actions/cli/internal/benchmark"
)

func main() {
    // Run benchmarks with 5 iterations
    output, err := benchmark.RunBenchmarks(".", "-bench=. -benchmem", 5)
    if err != nil {
        panic(err)
    }

    // Print results
    fmt.Printf("Success: %v\n", output.Success)
    fmt.Printf("Duration: %v\n", output.Duration)

    for _, stats := range output.Results {
        fmt.Printf("\nBenchmark: %s\n", stats.Name)
        fmt.Printf("  Min: %.2f ns/op\n", stats.Min)
        fmt.Printf("  Max: %.2f ns/op\n", stats.Max)
        fmt.Printf("  Mean: %.2f ns/op\n", stats.Mean)
        fmt.Printf("  StdDev: %.2f\n", stats.StdDev)
    }
}
```

### Advanced Usage

```go
// Create a runner with custom options
runner, err := benchmark.NewRunner(benchmark.Options{
    WorkingDirectory: "./mypackage",
    BenchmarkArgs:    "-bench=BenchmarkSpecific -benchtime=10s",
    BenchmarkCount:   10,
})
if err != nil {
    panic(err)
}

// Run benchmarks
output, err := runner.Run()
if err != nil {
    panic(err)
}

// Access detailed results
for _, stats := range output.Results {
    for i, run := range stats.Runs {
        fmt.Printf("Run %d: %.2f ns/op\n", i+1, run.NsPerOp)
    }
}
```

### Parsing Existing Benchmark Output

```go
// Parse benchmark output from a string
benchOutput := `BenchmarkExample-8         100000     12345 ns/op     1024 B/op     10 allocs/op
BenchmarkAnother-8          50000     23456 ns/op
PASS`

results, err := benchmark.ParseBenchmarkOutput(benchOutput)
if err != nil {
    panic(err)
}

for _, result := range results {
    fmt.Printf("%s: %.2f ns/op\n", result.Name, result.NsPerOp)
}
```

## Types

### Result
Represents a single benchmark run result.

```go
type Result struct {
    Name        string  // Benchmark name (e.g., "BenchmarkExample-8")
    Iterations  int     // Number of iterations (b.N)
    NsPerOp     float64 // Nanoseconds per operation
    BytesPerOp  int64   // Bytes allocated per operation (optional)
    AllocsPerOp int64   // Allocations per operation (optional)
}
```

### Stats
Represents aggregated statistics across multiple benchmark runs.

```go
type Stats struct {
    Name     string   // Benchmark name
    Runs     []Result // All runs for this benchmark
    Min      float64  // Minimum ns/op across runs
    Max      float64  // Maximum ns/op across runs
    Mean     float64  // Average ns/op across runs
    StdDev   float64  // Standard deviation across runs
    RunCount int      // Number of runs
}
```

### Output
Represents the complete benchmark output with all results and metadata.

```go
type Output struct {
    Results  []Stats       // Statistics for each benchmark
    Duration time.Duration // Total execution time
    RunCount int           // Number of iterations per benchmark
    Success  bool          // Overall success status
    Error    string        // Error message if failed
}
```

## Security

The benchmark package includes protection against:

- **Shell injection**: Validates arguments for dangerous metacharacters (`;`, `|`, `` ` ``, `$`, etc.)
- **Path traversal**: Blocks `..` patterns in arguments
- **Command injection**: Prevents newline characters that could inject additional commands

All arguments are validated before execution, and the runner uses Go's `exec.Command` with array arguments (not shell execution) for maximum safety.

## Testing

The package includes comprehensive tests covering:

- Argument validation (including security tests)
- Argument parsing (quoted strings, spaces, edge cases)
- Benchmark output parsing (various formats, edge cases, real-world examples)
- Statistical calculations (min, max, mean, standard deviation)
- Integration tests (actual benchmark execution)
- Error handling (no benchmarks, invalid output, etc.)

Run tests:

```bash
go test ./internal/benchmark/... -v
```

Run tests with coverage:

```bash
go test ./internal/benchmark/... -v -cover
```

Current test coverage: **94.2%**

## Comparison with TypeScript Implementation

This Go implementation provides the same functionality as the original TypeScript version with these improvements:

1. **Type Safety**: Go's static typing catches errors at compile time
2. **Performance**: Native Go execution is faster than Node.js
3. **Better Integration**: Seamlessly integrates with Go tooling and CLI
4. **Enhanced Testing**: More comprehensive test suite with 94% coverage
5. **Idiomatic Go**: Follows Go best practices and conventions

## Integration

The benchmark package integrates with the runner package:

```go
// In runner package
func (r *Runner) RunBenchmark() (output.CheckResult, error) {
    // Get configuration
    benchArgs := r.cfg.CI.Benchmark.Args
    benchCount := r.cfg.CI.Benchmark.Count

    // Run benchmarks
    benchOutput, err := benchmark.RunBenchmarks(".", benchArgs, benchCount)

    // Handle results...
}
```

## File Structure

```
benchmark/
├── README.md           # This file
├── types.go           # Type definitions (Result, Stats, Output)
├── parser.go          # Benchmark output parsing
├── parser_test.go     # Parser tests
├── runner.go          # Main benchmark runner logic
├── runner_test.go     # Runner tests
└── example_test.go    # Usage examples
```

## License

Part of the go-actions project.
