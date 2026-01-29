package benchmark

import (
	"bufio"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// Benchmark output format examples:
// BenchmarkExample-8         100000     12345 ns/op     1024 B/op     10 allocs/op
// BenchmarkAnotherTest-4     50000      23456 ns/op

var (
	// Matches: BenchmarkName-8    100000    12345 ns/op    1024 B/op    10 allocs/op
	benchRegex = regexp.MustCompile(`^(Benchmark\S+)\s+(\d+)\s+([\d.]+)\s+ns/op(?:\s+([\d.]+)\s+B/op)?(?:\s+([\d.]+)\s+allocs/op)?`)
)

// ParseBenchmarkOutput parses the output from go test -bench and returns parsed results
func ParseBenchmarkOutput(output string) ([]Result, error) {
	var results []Result
	scanner := bufio.NewScanner(strings.NewReader(output))

	for scanner.Scan() {
		line := scanner.Text()

		// Skip lines that don't match benchmark output format
		if !strings.HasPrefix(line, "Benchmark") {
			continue
		}

		result, err := parseBenchmarkLine(line)
		if err != nil {
			// Log error but continue parsing other lines
			continue
		}

		results = append(results, result)
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading benchmark output: %w", err)
	}

	if len(results) == 0 {
		return nil, fmt.Errorf("no benchmark results found in output")
	}

	return results, nil
}

// parseBenchmarkLine parses a single benchmark output line
func parseBenchmarkLine(line string) (Result, error) {
	matches := benchRegex.FindStringSubmatch(line)
	if len(matches) < 4 {
		return Result{}, fmt.Errorf("invalid benchmark line format: %s", line)
	}

	result := Result{
		Name: matches[1],
	}

	// Parse iterations
	iterations, err := strconv.Atoi(matches[2])
	if err != nil {
		return Result{}, fmt.Errorf("invalid iterations: %w", err)
	}
	result.Iterations = iterations

	// Parse ns/op
	nsPerOp, err := strconv.ParseFloat(matches[3], 64)
	if err != nil {
		return Result{}, fmt.Errorf("invalid ns/op: %w", err)
	}
	result.NsPerOp = nsPerOp

	// Parse optional B/op (bytes per operation)
	if len(matches) > 4 && matches[4] != "" {
		bytesPerOp, err := strconv.ParseFloat(matches[4], 64)
		if err == nil {
			result.BytesPerOp = int64(bytesPerOp)
		}
	}

	// Parse optional allocs/op (allocations per operation)
	if len(matches) > 5 && matches[5] != "" {
		allocsPerOp, err := strconv.ParseFloat(matches[5], 64)
		if err == nil {
			result.AllocsPerOp = int64(allocsPerOp)
		}
	}

	return result, nil
}
