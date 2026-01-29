package benchmark_test

import (
	"fmt"
	"testing"

	"github.com/jrschumacher/go-actions/cli/internal/benchmark"
)

// Example demonstrates basic usage of the benchmark runner
func ExampleRunBenchmarks() {
	// Run benchmarks with default settings
	output, err := benchmark.RunBenchmarks(".", "-bench=. -benchmem", 3)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}

	// Print results
	fmt.Printf("Success: %v\n", output.Success)
	fmt.Printf("Run Count: %d\n", output.RunCount)
	fmt.Printf("Duration: %v\n", output.Duration)
	fmt.Printf("Benchmarks: %d\n", len(output.Results))
}

// Example demonstrates parsing benchmark output
func ExampleParseBenchmarkOutput() {
	output := `goos: darwin
goarch: amd64
BenchmarkExample-8         100000     12345 ns/op     1024 B/op     10 allocs/op
BenchmarkAnother-8          50000     23456 ns/op
PASS`

	results, err := benchmark.ParseBenchmarkOutput(output)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}

	for _, result := range results {
		fmt.Printf("Name: %s\n", result.Name)
		fmt.Printf("  Iterations: %d\n", result.Iterations)
		fmt.Printf("  ns/op: %.2f\n", result.NsPerOp)
		if result.BytesPerOp > 0 {
			fmt.Printf("  B/op: %d\n", result.BytesPerOp)
		}
		if result.AllocsPerOp > 0 {
			fmt.Printf("  allocs/op: %d\n", result.AllocsPerOp)
		}
	}
}

// BenchmarkStringConcatenation is an example benchmark
func BenchmarkStringConcatenation(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_ = "hello" + " " + "world"
	}
}

// BenchmarkAllocation is another example benchmark
func BenchmarkAllocation(b *testing.B) {
	for i := 0; i < b.N; i++ {
		s := make([]int, 100)
		_ = s
	}
}
