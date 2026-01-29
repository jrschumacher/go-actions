package benchmark

import (
	"bytes"
	"fmt"
	"math"
	"os/exec"
	"regexp"
	"strings"
	"time"
)

// Dangerous shell metacharacters that should not appear in benchmark arguments
var dangerousPatterns = []*regexp.Regexp{
	regexp.MustCompile(`[;&|` + "`" + `$(){}[\]<>!]`), // Shell metacharacters
	regexp.MustCompile(`\.\.`),                        // Path traversal
	regexp.MustCompile(`[\n\r]`),                      // Newlines (command injection)
}

// Options contains configuration for running benchmarks
type Options struct {
	WorkingDirectory string
	BenchmarkArgs    string
	BenchmarkCount   int
}

// Runner executes benchmarks and collects results
type Runner struct {
	workingDir string
	args       []string
	count      int
}

// NewRunner creates a new benchmark runner with validated options
func NewRunner(opts Options) (*Runner, error) {
	if err := validateBenchmarkArgs(opts.BenchmarkArgs); err != nil {
		return nil, err
	}

	args := parseBenchmarkArgs(opts.BenchmarkArgs)

	return &Runner{
		workingDir: opts.WorkingDirectory,
		args:       args,
		count:      opts.BenchmarkCount,
	}, nil
}

// Run executes benchmarks and returns aggregated results
func (r *Runner) Run() (*Output, error) {
	start := time.Now()
	output := &Output{
		RunCount: r.count,
		Success:  true,
	}

	// Collect all benchmark results across runs
	allResults := make(map[string][]Result)

	for i := 1; i <= r.count; i++ {
		results, err := r.runSingleBenchmark()
		if err != nil {
			output.Success = false
			output.Error = fmt.Sprintf("benchmark run %d/%d failed: %v", i, r.count, err)
			return output, err
		}

		// Group results by benchmark name
		for _, result := range results {
			allResults[result.Name] = append(allResults[result.Name], result)
		}
	}

	// Calculate statistics for each benchmark
	for name, results := range allResults {
		stats := calculateStats(name, results)
		output.Results = append(output.Results, stats)
	}

	output.Duration = time.Since(start)
	return output, nil
}

// runSingleBenchmark executes a single benchmark run
func (r *Runner) runSingleBenchmark() ([]Result, error) {
	// Build command: go test -bench <args> ./...
	cmdArgs := append([]string{"test"}, r.args...)
	cmdArgs = append(cmdArgs, "./...")

	cmd := exec.Command("go", cmdArgs...)
	if r.workingDir != "" {
		cmd.Dir = r.workingDir
	}

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		return nil, fmt.Errorf("go test failed: %w\nstderr: %s", err, stderr.String())
	}

	// Parse benchmark output
	results, err := ParseBenchmarkOutput(stdout.String())
	if err != nil {
		return nil, fmt.Errorf("failed to parse benchmark output: %w", err)
	}

	return results, nil
}

// validateBenchmarkArgs checks if benchmark arguments contain dangerous patterns
func validateBenchmarkArgs(args string) error {
	for _, pattern := range dangerousPatterns {
		if pattern.MatchString(args) {
			return fmt.Errorf("invalid benchmark arguments: contains potentially dangerous characters: %s", args)
		}
	}
	return nil
}

// parseBenchmarkArgs safely parses benchmark arguments string into an array
// Handles quoted strings and respects whitespace boundaries
func parseBenchmarkArgs(argsString string) []string {
	var args []string
	var current strings.Builder
	inQuote := false
	var quoteChar rune

	for _, char := range argsString {
		if (char == '"' || char == '\'') && !inQuote {
			inQuote = true
			quoteChar = char
		} else if char == quoteChar && inQuote {
			inQuote = false
			quoteChar = 0
		} else if char == ' ' && !inQuote {
			if current.Len() > 0 {
				args = append(args, current.String())
				current.Reset()
			}
		} else {
			current.WriteRune(char)
		}
	}

	if current.Len() > 0 {
		args = append(args, current.String())
	}

	return args
}

// calculateStats computes statistics across multiple benchmark runs
func calculateStats(name string, results []Result) Stats {
	stats := Stats{
		Name: name,
		Runs: results,
		RunCount: len(results),
	}

	if len(results) == 0 {
		return stats
	}

	// Calculate min, max, and mean
	sum := 0.0
	stats.Min = results[0].NsPerOp
	stats.Max = results[0].NsPerOp

	for _, result := range results {
		nsPerOp := result.NsPerOp
		sum += nsPerOp

		if nsPerOp < stats.Min {
			stats.Min = nsPerOp
		}
		if nsPerOp > stats.Max {
			stats.Max = nsPerOp
		}
	}

	stats.Mean = sum / float64(len(results))

	// Calculate standard deviation
	if len(results) > 1 {
		varianceSum := 0.0
		for _, result := range results {
			diff := result.NsPerOp - stats.Mean
			varianceSum += diff * diff
		}
		variance := varianceSum / float64(len(results))
		stats.StdDev = math.Sqrt(variance)
	}

	return stats
}

// RunBenchmarks is a convenience function to run benchmarks with default options
func RunBenchmarks(dir string, args string, count int) (*Output, error) {
	runner, err := NewRunner(Options{
		WorkingDirectory: dir,
		BenchmarkArgs:    args,
		BenchmarkCount:   count,
	})
	if err != nil {
		return nil, err
	}

	return runner.Run()
}
