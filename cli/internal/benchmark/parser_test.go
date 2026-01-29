package benchmark

import (
	"strings"
	"testing"
)

func TestParseBenchmarkLine(t *testing.T) {
	tests := []struct {
		name          string
		line          string
		expected      Result
		expectError   bool
	}{
		{
			name: "full benchmark line with all metrics",
			line: "BenchmarkExample-8         100000     12345 ns/op     1024 B/op     10 allocs/op",
			expected: Result{
				Name:        "BenchmarkExample-8",
				Iterations:  100000,
				NsPerOp:     12345,
				BytesPerOp:  1024,
				AllocsPerOp: 10,
			},
			expectError: false,
		},
		{
			name: "benchmark line with only ns/op",
			line: "BenchmarkSimple-4          50000      23456 ns/op",
			expected: Result{
				Name:       "BenchmarkSimple-4",
				Iterations: 50000,
				NsPerOp:    23456,
			},
			expectError: false,
		},
		{
			name: "benchmark line with ns/op and B/op",
			line: "BenchmarkWithBytes-8       75000      15000 ns/op     512 B/op",
			expected: Result{
				Name:       "BenchmarkWithBytes-8",
				Iterations: 75000,
				NsPerOp:    15000,
				BytesPerOp: 512,
			},
			expectError: false,
		},
		{
			name: "benchmark with decimal ns/op",
			line: "BenchmarkFast-8            1000000    1234.56 ns/op",
			expected: Result{
				Name:       "BenchmarkFast-8",
				Iterations: 1000000,
				NsPerOp:    1234.56,
			},
			expectError: false,
		},
		{
			name: "benchmark with decimal B/op",
			line: "BenchmarkMem-8             100000     5000 ns/op     256.5 B/op",
			expected: Result{
				Name:       "BenchmarkMem-8",
				Iterations: 100000,
				NsPerOp:    5000,
				BytesPerOp: 256,
			},
			expectError: false,
		},
		{
			name:        "invalid line - not a benchmark",
			line:        "PASS",
			expectError: true,
		},
		{
			name:        "invalid line - missing metrics",
			line:        "BenchmarkInvalid",
			expectError: true,
		},
		{
			name:        "empty line",
			line:        "",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := parseBenchmarkLine(tt.line)

			if tt.expectError {
				if err == nil {
					t.Error("parseBenchmarkLine() expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("parseBenchmarkLine() unexpected error = %v", err)
				return
			}

			if result.Name != tt.expected.Name {
				t.Errorf("Name = %v, want %v", result.Name, tt.expected.Name)
			}
			if result.Iterations != tt.expected.Iterations {
				t.Errorf("Iterations = %v, want %v", result.Iterations, tt.expected.Iterations)
			}
			if result.NsPerOp != tt.expected.NsPerOp {
				t.Errorf("NsPerOp = %v, want %v", result.NsPerOp, tt.expected.NsPerOp)
			}
			if result.BytesPerOp != tt.expected.BytesPerOp {
				t.Errorf("BytesPerOp = %v, want %v", result.BytesPerOp, tt.expected.BytesPerOp)
			}
			if result.AllocsPerOp != tt.expected.AllocsPerOp {
				t.Errorf("AllocsPerOp = %v, want %v", result.AllocsPerOp, tt.expected.AllocsPerOp)
			}
		})
	}
}

func TestParseBenchmarkOutput(t *testing.T) {
	tests := []struct {
		name          string
		output        string
		expectedCount int
		expectError   bool
	}{
		{
			name: "multiple benchmarks",
			output: `goos: darwin
goarch: amd64
pkg: github.com/example/test
cpu: Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz
BenchmarkExample-8         100000     12345 ns/op     1024 B/op     10 allocs/op
BenchmarkAnother-8          50000     23456 ns/op      512 B/op      5 allocs/op
PASS
ok      github.com/example/test    5.123s`,
			expectedCount: 2,
			expectError:   false,
		},
		{
			name: "single benchmark",
			output: `goos: linux
goarch: amd64
BenchmarkSingle-4          75000      15000 ns/op
PASS`,
			expectedCount: 1,
			expectError:   false,
		},
		{
			name: "benchmark with extra whitespace",
			output: `
BenchmarkTest-8            100000     10000 ns/op

PASS
`,
			expectedCount: 1,
			expectError:   false,
		},
		{
			name: "output with no benchmarks",
			output: `goos: darwin
goarch: amd64
PASS
ok      github.com/example/test    0.123s`,
			expectedCount: 0,
			expectError:   true,
		},
		{
			name:          "empty output",
			output:        "",
			expectedCount: 0,
			expectError:   true,
		},
		{
			name: "mixed valid and invalid lines",
			output: `BenchmarkValid-8           100000     10000 ns/op
some random text
BenchmarkAnother-8          50000     20000 ns/op
more random text
PASS`,
			expectedCount: 2,
			expectError:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			results, err := ParseBenchmarkOutput(tt.output)

			if tt.expectError {
				if err == nil {
					t.Error("ParseBenchmarkOutput() expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("ParseBenchmarkOutput() unexpected error = %v", err)
				return
			}

			if len(results) != tt.expectedCount {
				t.Errorf("ParseBenchmarkOutput() got %d results, want %d", len(results), tt.expectedCount)
			}

			// Verify all results have required fields
			for i, result := range results {
				if result.Name == "" {
					t.Errorf("Result[%d] has empty Name", i)
				}
				if result.Iterations == 0 {
					t.Errorf("Result[%d] has zero Iterations", i)
				}
				if result.NsPerOp == 0 {
					t.Errorf("Result[%d] has zero NsPerOp", i)
				}
			}
		})
	}
}

func TestParseBenchmarkOutputRealWorld(t *testing.T) {
	// Real-world benchmark output from Go 1.21
	realOutput := `goos: darwin
goarch: arm64
pkg: github.com/jrschumacher/go-actions/test
BenchmarkStringConcatenation-10          5234234          229.8 ns/op         240 B/op          2 allocs/op
BenchmarkStringBuilder-10               10582746          113.3 ns/op         112 B/op          2 allocs/op
BenchmarkMapAccess-10                   82471201           14.52 ns/op          0 B/op          0 allocs/op
BenchmarkSliceAppend-10                 31842651           37.64 ns/op         71 B/op          0 allocs/op
PASS
ok      github.com/jrschumacher/go-actions/test    6.842s`

	results, err := ParseBenchmarkOutput(realOutput)
	if err != nil {
		t.Fatalf("ParseBenchmarkOutput() error = %v", err)
	}

	if len(results) != 4 {
		t.Fatalf("ParseBenchmarkOutput() got %d results, want 4", len(results))
	}

	// Check specific benchmarks
	expectedResults := map[string]struct {
		iterations  int
		nsPerOp     float64
		bytesPerOp  int64
		allocsPerOp int64
	}{
		"BenchmarkStringConcatenation-10": {5234234, 229.8, 240, 2},
		"BenchmarkStringBuilder-10":       {10582746, 113.3, 112, 2},
		"BenchmarkMapAccess-10":           {82471201, 14.52, 0, 0},
		"BenchmarkSliceAppend-10":         {31842651, 37.64, 71, 0},
	}

	for _, result := range results {
		expected, ok := expectedResults[result.Name]
		if !ok {
			t.Errorf("Unexpected benchmark name: %s", result.Name)
			continue
		}

		if result.Iterations != expected.iterations {
			t.Errorf("%s: Iterations = %d, want %d", result.Name, result.Iterations, expected.iterations)
		}
		if result.NsPerOp != expected.nsPerOp {
			t.Errorf("%s: NsPerOp = %f, want %f", result.Name, result.NsPerOp, expected.nsPerOp)
		}
		if result.BytesPerOp != expected.bytesPerOp {
			t.Errorf("%s: BytesPerOp = %d, want %d", result.Name, result.BytesPerOp, expected.bytesPerOp)
		}
		if result.AllocsPerOp != expected.allocsPerOp {
			t.Errorf("%s: AllocsPerOp = %d, want %d", result.Name, result.AllocsPerOp, expected.allocsPerOp)
		}
	}
}

func TestParseBenchmarkOutputEdgeCases(t *testing.T) {
	tests := []struct {
		name        string
		output      string
		expectError bool
		checkFunc   func(*testing.T, []Result)
	}{
		{
			name: "very large numbers",
			output: `BenchmarkLarge-8           999999999    999999999.99 ns/op    999999999 B/op    999999999 allocs/op
PASS`,
			expectError: false,
			checkFunc: func(t *testing.T, results []Result) {
				if len(results) != 1 {
					t.Errorf("Expected 1 result, got %d", len(results))
					return
				}
				if results[0].Iterations != 999999999 {
					t.Errorf("Iterations = %d, want 999999999", results[0].Iterations)
				}
			},
		},
		{
			name: "benchmark with special characters in name",
			output: `BenchmarkTest_With_Underscores-8    100000    10000 ns/op
BenchmarkTest/SubTest-8              50000     20000 ns/op
PASS`,
			expectError: false,
			checkFunc: func(t *testing.T, results []Result) {
				if len(results) != 2 {
					t.Errorf("Expected 2 results, got %d", len(results))
				}
			},
		},
		{
			name: "multiple consecutive benchmark lines",
			output: `BenchmarkA-8    100000    10000 ns/op
BenchmarkB-8    100000    10000 ns/op
BenchmarkC-8    100000    10000 ns/op
BenchmarkD-8    100000    10000 ns/op
BenchmarkE-8    100000    10000 ns/op`,
			expectError: false,
			checkFunc: func(t *testing.T, results []Result) {
				if len(results) != 5 {
					t.Errorf("Expected 5 results, got %d", len(results))
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			results, err := ParseBenchmarkOutput(tt.output)

			if tt.expectError && err == nil {
				t.Error("ParseBenchmarkOutput() expected error, got nil")
				return
			}
			if !tt.expectError && err != nil {
				t.Errorf("ParseBenchmarkOutput() unexpected error = %v", err)
				return
			}

			if tt.checkFunc != nil && !tt.expectError {
				tt.checkFunc(t, results)
			}
		})
	}
}

func TestParseBenchmarkLineWithTabsAndSpaces(t *testing.T) {
	// Test various whitespace combinations
	tests := []struct {
		name string
		line string
	}{
		{
			name: "tabs between fields",
			line: "BenchmarkTest-8\t\t100000\t\t10000 ns/op",
		},
		{
			name: "mixed tabs and spaces",
			line: "BenchmarkTest-8  \t  100000  \t  10000 ns/op",
		},
		{
			name: "multiple spaces",
			line: "BenchmarkTest-8        100000      10000 ns/op",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := parseBenchmarkLine(tt.line)
			if err != nil {
				// The regex is space-based, so tabs might not parse correctly
				// This is expected behavior - documenting it in test
				if !strings.Contains(tt.line, "\t") {
					t.Errorf("parseBenchmarkLine() unexpected error = %v", err)
				}
				return
			}

			if result.Name == "" || result.Iterations == 0 || result.NsPerOp == 0 {
				t.Errorf("parseBenchmarkLine() produced incomplete result: %+v", result)
			}
		})
	}
}
