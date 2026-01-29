package runner

import (
	"fmt"
	"time"

	"github.com/jrschumacher/go-actions/cli/internal/benchmark"
	"github.com/jrschumacher/go-actions/cli/internal/output"
)

// RunBenchmark runs Go benchmarks with multiple iterations
func (r *Runner) RunBenchmark() (output.CheckResult, error) {
	result := output.CheckResult{
		Name:   "benchmark",
		Status: "pass",
	}

	start := time.Now()
	defer func() {
		result.Duration = time.Since(start)
	}()

	// Check if go is installed
	if err := checkToolInstalled("go"); err != nil {
		return result, err
	}

	// Get benchmark configuration
	benchArgs := r.cfg.CI.Benchmark.Args
	if benchArgs == "" {
		benchArgs = "-bench=. -benchmem"
	}

	benchCount := r.cfg.CI.Benchmark.Count
	if benchCount == 0 {
		benchCount = 5
	}

	// Run benchmarks
	benchOutput, err := benchmark.RunBenchmarks(".", benchArgs, benchCount)
	if err != nil || !benchOutput.Success {
		result.Status = "fail"
		if err != nil {
			result.Message = fmt.Sprintf("benchmark failed: %v", err)
		} else {
			result.Message = fmt.Sprintf("benchmark failed: %s", benchOutput.Error)
		}
		return result, nil
	}

	// Format results for output
	if len(benchOutput.Results) > 0 {
		result.Message = fmt.Sprintf("ran %d benchmark(s) with %d iteration(s) each",
			len(benchOutput.Results), benchCount)
	}

	return result, nil
}
