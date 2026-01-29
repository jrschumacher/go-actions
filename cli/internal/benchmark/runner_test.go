package benchmark

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestValidateBenchmarkArgs(t *testing.T) {
	tests := []struct {
		name      string
		args      string
		wantError bool
	}{
		{
			name:      "valid simple args",
			args:      "-bench=. -benchmem",
			wantError: false,
		},
		{
			name:      "valid args with quoted string",
			args:      "-bench=. -benchtime=10s",
			wantError: false,
		},
		{
			name:      "dangerous semicolon",
			args:      "-bench=.; rm -rf /",
			wantError: true,
		},
		{
			name:      "dangerous pipe",
			args:      "-bench=. | cat",
			wantError: true,
		},
		{
			name:      "dangerous backtick",
			args:      "-bench=. `whoami`",
			wantError: true,
		},
		{
			name:      "dangerous dollar",
			args:      "-bench=. $(whoami)",
			wantError: true,
		},
		{
			name:      "path traversal",
			args:      "-bench=../../../etc/passwd",
			wantError: true,
		},
		{
			name:      "newline injection",
			args:      "-bench=.\nrm -rf /",
			wantError: true,
		},
		{
			name:      "empty args",
			args:      "",
			wantError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateBenchmarkArgs(tt.args)
			if (err != nil) != tt.wantError {
				t.Errorf("validateBenchmarkArgs() error = %v, wantError %v", err, tt.wantError)
			}
		})
	}
}

func TestParseBenchmarkArgs(t *testing.T) {
	tests := []struct {
		name     string
		args     string
		expected []string
	}{
		{
			name:     "simple args",
			args:     "-bench=. -benchmem",
			expected: []string{"-bench=.", "-benchmem"},
		},
		{
			name:     "args with spaces",
			args:     "-bench=. -benchtime=10s -count=5",
			expected: []string{"-bench=.", "-benchtime=10s", "-count=5"},
		},
		{
			name:     "args with double quotes",
			args:     `-bench="TestName" -benchmem`,
			expected: []string{"-bench=TestName", "-benchmem"},
		},
		{
			name:     "args with single quotes",
			args:     "-bench='TestName' -benchmem",
			expected: []string{"-bench=TestName", "-benchmem"},
		},
		{
			name:     "multiple spaces",
			args:     "-bench=.    -benchmem",
			expected: []string{"-bench=.", "-benchmem"},
		},
		{
			name:     "empty string",
			args:     "",
			expected: []string{},
		},
		{
			name:     "single arg",
			args:     "-benchmem",
			expected: []string{"-benchmem"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseBenchmarkArgs(tt.args)
			if len(result) != len(tt.expected) {
				t.Errorf("parseBenchmarkArgs() got %d args, want %d", len(result), len(tt.expected))
				return
			}
			for i := range result {
				if result[i] != tt.expected[i] {
					t.Errorf("parseBenchmarkArgs()[%d] = %v, want %v", i, result[i], tt.expected[i])
				}
			}
		})
	}
}

func TestCalculateStats(t *testing.T) {
	tests := []struct {
		name     string
		results  []Result
		checkMin float64
		checkMax float64
		checkMean float64
	}{
		{
			name: "single result",
			results: []Result{
				{Name: "BenchmarkTest", NsPerOp: 100.0},
			},
			checkMin:  100.0,
			checkMax:  100.0,
			checkMean: 100.0,
		},
		{
			name: "multiple results",
			results: []Result{
				{Name: "BenchmarkTest", NsPerOp: 100.0},
				{Name: "BenchmarkTest", NsPerOp: 200.0},
				{Name: "BenchmarkTest", NsPerOp: 150.0},
			},
			checkMin:  100.0,
			checkMax:  200.0,
			checkMean: 150.0,
		},
		{
			name: "varying results",
			results: []Result{
				{Name: "BenchmarkTest", NsPerOp: 50.0},
				{Name: "BenchmarkTest", NsPerOp: 100.0},
				{Name: "BenchmarkTest", NsPerOp: 75.0},
				{Name: "BenchmarkTest", NsPerOp: 125.0},
			},
			checkMin:  50.0,
			checkMax:  125.0,
			checkMean: 87.5,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stats := calculateStats("BenchmarkTest", tt.results)

			if stats.Min != tt.checkMin {
				t.Errorf("calculateStats() Min = %v, want %v", stats.Min, tt.checkMin)
			}
			if stats.Max != tt.checkMax {
				t.Errorf("calculateStats() Max = %v, want %v", stats.Max, tt.checkMax)
			}
			if stats.Mean != tt.checkMean {
				t.Errorf("calculateStats() Mean = %v, want %v", stats.Mean, tt.checkMean)
			}

			// Check that standard deviation is calculated for multiple results
			if len(tt.results) > 1 && stats.StdDev == 0 {
				t.Error("calculateStats() StdDev should not be 0 for multiple different results")
			}
		})
	}
}

func TestNewRunner(t *testing.T) {
	tests := []struct {
		name      string
		opts      Options
		wantError bool
	}{
		{
			name: "valid options",
			opts: Options{
				WorkingDirectory: ".",
				BenchmarkArgs:    "-bench=. -benchmem",
				BenchmarkCount:   5,
			},
			wantError: false,
		},
		{
			name: "dangerous args",
			opts: Options{
				WorkingDirectory: ".",
				BenchmarkArgs:    "-bench=.; rm -rf /",
				BenchmarkCount:   5,
			},
			wantError: true,
		},
		{
			name: "empty args",
			opts: Options{
				WorkingDirectory: ".",
				BenchmarkArgs:    "",
				BenchmarkCount:   1,
			},
			wantError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			runner, err := NewRunner(tt.opts)
			if (err != nil) != tt.wantError {
				t.Errorf("NewRunner() error = %v, wantError %v", err, tt.wantError)
			}
			if !tt.wantError && runner == nil {
				t.Error("NewRunner() returned nil runner without error")
			}
		})
	}
}

// TestRunBenchmarksIntegration is an integration test that runs actual benchmarks
// This test is only run if a test Go file exists in the working directory
func TestRunBenchmarksIntegration(t *testing.T) {
	// Create a temporary directory with a simple benchmark test
	tmpDir := t.TempDir()

	// Create go.mod
	goMod := `module testbench

go 1.21
`
	if err := os.WriteFile(filepath.Join(tmpDir, "go.mod"), []byte(goMod), 0644); err != nil {
		t.Fatalf("Failed to create go.mod: %v", err)
	}

	// Create a simple benchmark test
	benchTest := `package testbench

import "testing"

func BenchmarkExample(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_ = i * 2
	}
}

func BenchmarkAnother(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_ = i + 1
	}
}
`
	if err := os.WriteFile(filepath.Join(tmpDir, "bench_test.go"), []byte(benchTest), 0644); err != nil {
		t.Fatalf("Failed to create bench_test.go: %v", err)
	}

	// Run benchmarks
	output, err := RunBenchmarks(tmpDir, "-bench=. -benchmem", 2)
	if err != nil {
		t.Fatalf("RunBenchmarks() error = %v", err)
	}

	// Verify output
	if !output.Success {
		t.Errorf("RunBenchmarks() Success = false, want true")
	}
	if output.RunCount != 2 {
		t.Errorf("RunBenchmarks() RunCount = %d, want 2", output.RunCount)
	}
	if len(output.Results) != 2 {
		t.Errorf("RunBenchmarks() got %d benchmark results, want 2", len(output.Results))
	}

	// Verify each benchmark has the correct number of runs
	for _, stats := range output.Results {
		if len(stats.Runs) != 2 {
			t.Errorf("Benchmark %s has %d runs, want 2", stats.Name, len(stats.Runs))
		}
		if stats.RunCount != 2 {
			t.Errorf("Benchmark %s RunCount = %d, want 2", stats.Name, stats.RunCount)
		}
		// Verify stats are calculated
		if stats.Min == 0 || stats.Max == 0 || stats.Mean == 0 {
			t.Errorf("Benchmark %s has invalid stats: Min=%v, Max=%v, Mean=%v",
				stats.Name, stats.Min, stats.Max, stats.Mean)
		}
	}
}

func TestRunBenchmarksWithNoBenchmarks(t *testing.T) {
	// Create a temporary directory with no benchmarks
	tmpDir := t.TempDir()

	// Create go.mod
	goMod := `module testbench

go 1.21
`
	if err := os.WriteFile(filepath.Join(tmpDir, "go.mod"), []byte(goMod), 0644); err != nil {
		t.Fatalf("Failed to create go.mod: %v", err)
	}

	// Create a file with no benchmarks
	testFile := `package testbench

import "testing"

func TestNothing(t *testing.T) {
	// Not a benchmark
}
`
	if err := os.WriteFile(filepath.Join(tmpDir, "test.go"), []byte(testFile), 0644); err != nil {
		t.Fatalf("Failed to create test.go: %v", err)
	}

	// Run benchmarks - should fail because no benchmarks found
	output, err := RunBenchmarks(tmpDir, "-bench=.", 1)
	if err == nil {
		t.Error("RunBenchmarks() expected error for no benchmarks, got nil")
	}
	if output == nil {
		t.Error("RunBenchmarks() returned nil output")
		return
	}
	if output.Success {
		t.Error("RunBenchmarks() Success = true, want false")
	}
	if !strings.Contains(output.Error, "no benchmark results found") {
		t.Errorf("RunBenchmarks() error = %v, want error containing 'no benchmark results found'", output.Error)
	}
}
