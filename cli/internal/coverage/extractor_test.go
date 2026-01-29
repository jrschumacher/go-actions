package coverage

import (
	"os"
	"path/filepath"
	"testing"
)

func TestValidateCoverageFileName(t *testing.T) {
	tests := []struct {
		name     string
		fileName string
		wantErr  bool
	}{
		{
			name:     "valid simple name",
			fileName: "coverage.out",
			wantErr:  false,
		},
		{
			name:     "valid with underscores",
			fileName: "test_coverage.out",
			wantErr:  false,
		},
		{
			name:     "valid with hyphens",
			fileName: "test-coverage.out",
			wantErr:  false,
		},
		{
			name:     "valid with dots",
			fileName: "coverage.2024.out",
			wantErr:  false,
		},
		{
			name:     "invalid with path traversal",
			fileName: "../coverage.out",
			wantErr:  true,
		},
		{
			name:     "invalid with forward slash",
			fileName: "path/to/coverage.out",
			wantErr:  true,
		},
		{
			name:     "invalid with backslash",
			fileName: "path\\to\\coverage.out",
			wantErr:  true,
		},
		{
			name:     "invalid with special chars",
			fileName: "coverage@#$.out",
			wantErr:  true,
		},
		{
			name:     "invalid with space",
			fileName: "coverage test.out",
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateCoverageFileName(tt.fileName)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateCoverageFileName() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestParseCoveragePercentage(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    float64
		wantErr bool
	}{
		{
			name:    "percentage with % sign",
			input:   "85.3%",
			want:    85.3,
			wantErr: false,
		},
		{
			name:    "percentage without % sign",
			input:   "85.3",
			want:    85.3,
			wantErr: false,
		},
		{
			name:    "zero percentage",
			input:   "0%",
			want:    0,
			wantErr: false,
		},
		{
			name:    "100 percentage",
			input:   "100%",
			want:    100,
			wantErr: false,
		},
		{
			name:    "percentage with spaces",
			input:   "  85.3%  ",
			want:    85.3,
			wantErr: false,
		},
		{
			name:    "integer percentage",
			input:   "85%",
			want:    85,
			wantErr: false,
		},
		{
			name:    "invalid - not a number",
			input:   "invalid",
			want:    0,
			wantErr: true,
		},
		{
			name:    "invalid - negative",
			input:   "-10%",
			want:    0,
			wantErr: true,
		},
		{
			name:    "invalid - over 100",
			input:   "101%",
			want:    0,
			wantErr: true,
		},
		{
			name:    "empty string",
			input:   "",
			want:    0,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseCoveragePercentage(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseCoveragePercentage() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("parseCoveragePercentage() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestExtractCoverageFromOutput(t *testing.T) {
	tests := []struct {
		name    string
		output  string
		want    float64
		wantErr bool
	}{
		{
			name: "standard go tool cover output",
			output: `github.com/example/project/file1.go:10:	Function1	100.0%
github.com/example/project/file2.go:20:	Function2	80.5%
total:						(statements)	85.3%`,
			want:    85.3,
			wantErr: false,
		},
		{
			name: "output with different spacing",
			output: `github.com/example/project/file1.go:10:	Function1	100.0%
total:	(statements)	92.7%`,
			want:    92.7,
			wantErr: false,
		},
		{
			name:    "output without total line",
			output:  "github.com/example/project/file1.go:10:	Function1	100.0%",
			want:    0,
			wantErr: true,
		},
		{
			name:    "empty output",
			output:  "",
			want:    0,
			wantErr: true,
		},
		{
			name:    "zero coverage",
			output:  "total:	(statements)	0.0%",
			want:    0.0,
			wantErr: false,
		},
		{
			name:    "full coverage",
			output:  "total:	(statements)	100.0%",
			want:    100.0,
			wantErr: false,
		},
		{
			name: "real-world example with multiple files",
			output: `github.com/jrschumacher/go-actions/cli/cmd/check.go:15:	init			100.0%
github.com/jrschumacher/go-actions/cli/cmd/check.go:29:	runCheck		88.9%
github.com/jrschumacher/go-actions/cli/internal/config/config.go:18:	Load		83.3%
github.com/jrschumacher/go-actions/cli/internal/runner/runner.go:18:	New		100.0%
total:									(statements)	89.2%`,
			want:    89.2,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := extractCoverageFromOutput(tt.output)
			if (err != nil) != tt.wantErr {
				t.Errorf("extractCoverageFromOutput() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("extractCoverageFromOutput() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestExtractCoverage(t *testing.T) {
	// Create a temporary directory for test files
	tmpDir := t.TempDir()

	tests := []struct {
		name          string
		coverageFile  string
		threshold     float64
		wantErr       bool
		checkResult   func(*testing.T, *CoverageResult)
	}{
		{
			name:         "missing coverage file",
			coverageFile: filepath.Join(tmpDir, "nonexistent.out"),
			threshold:    80.0,
			wantErr:      true,
			checkResult: func(t *testing.T, result *CoverageResult) {
				if result.Percentage != 0 {
					t.Errorf("Expected percentage 0 for missing file, got %v", result.Percentage)
				}
				if result.Error != "coverage file not found" {
					t.Errorf("Expected 'coverage file not found' error, got %v", result.Error)
				}
			},
		},
		{
			name:         "invalid filename with path traversal",
			coverageFile: "../coverage.out",
			threshold:    80.0,
			wantErr:      true,
			checkResult: func(t *testing.T, result *CoverageResult) {
				if result.Percentage != 0 {
					t.Errorf("Expected percentage 0 for invalid filename, got %v", result.Percentage)
				}
				if result.Error == "" {
					t.Error("Expected error for invalid filename")
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ExtractCoverage(tt.coverageFile, tt.threshold)
			if (err != nil) != tt.wantErr {
				t.Errorf("ExtractCoverage() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if result == nil {
				t.Fatal("ExtractCoverage() returned nil result")
			}

			if tt.checkResult != nil {
				tt.checkResult(t, result)
			}
		})
	}
}

func TestExtractCoverage_ThresholdChecking(t *testing.T) {
	// This test verifies the threshold checking logic
	// It requires a real Go module with coverage data

	tests := []struct {
		name              string
		threshold         float64
		expectMeetsThreshold bool
	}{
		{
			name:              "no threshold",
			threshold:         0.0,
			expectMeetsThreshold: true,
		},
		{
			name:              "low threshold",
			threshold:         10.0,
			expectMeetsThreshold: true,
		},
	}

	// Use the current module's coverage if available
	// This test will be skipped if coverage data is not available
	coverageFile := "../../coverage.out"
	if _, err := os.Stat(coverageFile); os.IsNotExist(err) {
		t.Skip("Coverage file not found, run 'go test -coverprofile=coverage.out' first")
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ExtractCoverage(coverageFile, tt.threshold)

			// If go tool cover is not available, skip this test
			if err != nil && result != nil && result.Error != "" {
				t.Skipf("go tool cover not available or failed: %v", err)
			}

			if err != nil {
				t.Fatalf("ExtractCoverage() unexpected error: %v", err)
			}

			if result == nil {
				t.Fatal("ExtractCoverage() returned nil result")
			}

			// Verify threshold is set correctly
			if result.Threshold != tt.threshold {
				t.Errorf("Expected threshold %v, got %v", tt.threshold, result.Threshold)
			}

			// Verify percentage is within valid range
			if result.Percentage < 0 || result.Percentage > 100 {
				t.Errorf("Invalid percentage: %v (must be 0-100)", result.Percentage)
			}

			// Verify meets threshold logic
			if tt.threshold == 0 && !result.MeetsThreshold {
				t.Error("Should always meet threshold when threshold is 0")
			}

			// Verify threshold comparison is correct
			expectedMeetsThreshold := result.Percentage >= tt.threshold
			if result.MeetsThreshold != expectedMeetsThreshold {
				t.Errorf("MeetsThreshold = %v, but percentage %v vs threshold %v suggests %v",
					result.MeetsThreshold, result.Percentage, tt.threshold, expectedMeetsThreshold)
			}
		})
	}
}

func TestExtractCoverage_EdgeCases(t *testing.T) {
	tmpDir := t.TempDir()

	// Test with empty coverage file
	t.Run("empty coverage file", func(t *testing.T) {
		emptyCoverageFile := filepath.Join(tmpDir, "empty.out")
		if err := os.WriteFile(emptyCoverageFile, []byte(""), 0644); err != nil {
			t.Fatalf("Failed to create empty coverage file: %v", err)
		}

		result, err := ExtractCoverage(emptyCoverageFile, 0)

		// An empty file is actually valid for go tool cover - it reports 0% coverage
		if err != nil {
			t.Errorf("Unexpected error for empty coverage file: %v", err)
		}
		if result == nil {
			t.Fatal("Expected result")
		}
		if result.Error != "" {
			t.Errorf("Expected no error message, got: %v", result.Error)
		}
		if result.Percentage != 0 {
			t.Errorf("Expected Percentage to be 0, got %v", result.Percentage)
		}
		// With zero threshold and 0% coverage, should meet threshold
		if !result.MeetsThreshold {
			t.Error("Expected MeetsThreshold to be true when coverage is 0% and threshold is 0")
		}
	})

	// Test with malformed coverage file
	t.Run("malformed coverage file", func(t *testing.T) {
		malformedFile := filepath.Join(tmpDir, "malformed.out")
		if err := os.WriteFile(malformedFile, []byte("not a coverage file"), 0644); err != nil {
			t.Fatalf("Failed to create malformed file: %v", err)
		}

		result, err := ExtractCoverage(malformedFile, 0)
		if err == nil {
			t.Error("Expected error for malformed coverage file")
		}
		if result == nil {
			t.Fatal("Expected result even on error")
		}
		if result.Error == "" {
			t.Error("Expected error message in result")
		}
	})
}
