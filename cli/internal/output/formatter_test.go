package output

import (
	"bytes"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"
)

// errorWriter is a writer that always returns an error
type errorWriter struct{}

func (e *errorWriter) Write(p []byte) (n int, err error) {
	return 0, errors.New("write error")
}

func TestNewFormatter(t *testing.T) {
	tests := []struct {
		name        string
		format      string
		description string
	}{
		{
			name:        "text format",
			format:      "text",
			description: "should create formatter with text format",
		},
		{
			name:        "json format",
			format:      "json",
			description: "should create formatter with json format",
		},
		{
			name:        "empty format",
			format:      "",
			description: "should create formatter with empty format",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			buf := &bytes.Buffer{}
			f := NewFormatter(tt.format, buf)

			if f == nil {
				t.Errorf("%s: expected formatter but got nil", tt.description)
				return
			}

			if f.format != tt.format {
				t.Errorf("%s: expected format %q, got %q", tt.description, tt.format, f.format)
			}

			if f.writer != buf {
				t.Errorf("%s: writer mismatch", tt.description)
			}
		})
	}
}

func TestGetStatusSymbol(t *testing.T) {
	tests := []struct {
		status string
		want   string
	}{
		{status: "pass", want: "✓"},
		{status: "fail", want: "✗"},
		{status: "error", want: "⚠"},
		{status: "skip", want: "○"},
		{status: "unknown", want: "?"},
		{status: "", want: "?"},
	}

	for _, tt := range tests {
		t.Run(tt.status, func(t *testing.T) {
			got := getStatusSymbol(tt.status)
			if got != tt.want {
				t.Errorf("getStatusSymbol(%q) = %q, want %q", tt.status, got, tt.want)
			}
		})
	}
}

func TestJoinChecks(t *testing.T) {
	tests := []struct {
		name        string
		checks      []string
		want        string
		description string
	}{
		{
			name:        "empty list",
			checks:      []string{},
			want:        "",
			description: "should return empty string for empty list",
		},
		{
			name:        "single check",
			checks:      []string{"test"},
			want:        "test",
			description: "should return single check without joining",
		},
		{
			name:        "two checks",
			checks:      []string{"test", "lint"},
			want:        "test and lint",
			description: "should join two checks with 'and'",
		},
		{
			name:        "three checks",
			checks:      []string{"test", "lint", "security"},
			want:        "test, lint and security",
			description: "should join three checks with commas and 'and'",
		},
		{
			name:        "four checks",
			checks:      []string{"test", "lint", "benchmark", "security"},
			want:        "test, lint, benchmark and security",
			description: "should join multiple checks correctly",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := joinChecks(tt.checks)
			if got != tt.want {
				t.Errorf("%s: expected %q, got %q", tt.description, tt.want, got)
			}
		})
	}
}

func TestPrintProgress(t *testing.T) {
	tests := []struct {
		name        string
		format      string
		checks      []string
		wantContain string
		wantEmpty   bool
		description string
	}{
		{
			name:        "text format with checks",
			format:      "text",
			checks:      []string{"test", "lint"},
			wantContain: "Running: test and lint",
			description: "should print progress message in text format",
		},
		{
			name:        "json format with checks",
			format:      "json",
			checks:      []string{"test", "lint"},
			wantEmpty:   true,
			description: "should skip progress message in json format",
		},
		{
			name:        "text format with single check",
			format:      "text",
			checks:      []string{"test"},
			wantContain: "Running: test",
			description: "should print single check in text format",
		},
		{
			name:        "text format with empty checks",
			format:      "text",
			checks:      []string{},
			wantContain: "Running:",
			description: "should print empty progress in text format",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			buf := &bytes.Buffer{}
			f := NewFormatter(tt.format, buf)
			err := f.PrintProgress(tt.checks)

			if err != nil {
				t.Errorf("%s: unexpected error: %v", tt.description, err)
				return
			}

			got := buf.String()

			if tt.wantEmpty {
				if got != "" {
					t.Errorf("%s: expected empty output, got %q", tt.description, got)
				}
				return
			}

			if !strings.Contains(got, tt.wantContain) {
				t.Errorf("%s: expected output to contain %q, got %q", tt.description, tt.wantContain, got)
			}
		})
	}
}

func TestPrintProgress_WriterError(t *testing.T) {
	formatter := NewFormatter("text", &errorWriter{})

	err := formatter.PrintProgress([]string{"test", "lint"})
	if err == nil {
		t.Fatal("expected error when writer fails, got nil")
	}
	if !strings.Contains(err.Error(), "write") {
		t.Errorf("expected error message to mention write failure, got: %v", err)
	}
}

func TestPrintProgress_JSONMode(t *testing.T) {
	formatter := NewFormatter("json", &errorWriter{})

	// JSON mode should skip progress and return nil
	err := formatter.PrintProgress([]string{"test"})
	if err != nil {
		t.Errorf("expected nil error in JSON mode, got: %v", err)
	}
}

func TestPrintResults_JSON(t *testing.T) {
	tests := []struct {
		name        string
		results     *Results
		description string
	}{
		{
			name: "single passing test",
			results: &Results{
				Checks: []CheckResult{
					{
						Name:     "test",
						Status:   "pass",
						Duration: 1 * time.Second,
						Coverage: 85.5,
					},
				},
				Total:  1 * time.Second,
				Status: "pass",
			},
			description: "should format single passing test to JSON",
		},
		{
			name: "multiple checks with different statuses",
			results: &Results{
				Checks: []CheckResult{
					{
						Name:     "test",
						Status:   "pass",
						Duration: 1 * time.Second,
						Coverage: 85.5,
					},
					{
						Name:     "lint",
						Status:   "fail",
						Duration: 500 * time.Millisecond,
						Issues:   5,
					},
					{
						Name:            "security",
						Status:          "pass",
						Duration:        2 * time.Second,
						Vulnerabilities: 0,
					},
				},
				Total:  3500 * time.Millisecond,
				Status: "fail",
			},
			description: "should format multiple checks to JSON",
		},
		{
			name: "empty results",
			results: &Results{
				Checks: []CheckResult{},
				Total:  0,
				Status: "pass",
			},
			description: "should handle empty results",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			buf := &bytes.Buffer{}
			f := NewFormatter("json", buf)

			err := f.PrintResults(tt.results)
			if err != nil {
				t.Errorf("%s: unexpected error: %v", tt.description, err)
				return
			}

			// Verify valid JSON
			var parsed Results
			if err := json.Unmarshal(buf.Bytes(), &parsed); err != nil {
				t.Errorf("%s: invalid JSON: %v\nGot: %s", tt.description, err, buf.String())
				return
			}

			// Verify key fields
			if len(parsed.Checks) != len(tt.results.Checks) {
				t.Errorf("%s: expected %d checks, got %d", tt.description, len(tt.results.Checks), len(parsed.Checks))
			}

			if parsed.Status != tt.results.Status {
				t.Errorf("%s: expected status %q, got %q", tt.description, tt.results.Status, parsed.Status)
			}
		})
	}
}

func TestPrintResults_Text(t *testing.T) {
	tests := []struct {
		name        string
		results     *Results
		wantContain []string
		description string
	}{
		{
			name: "passing test with coverage",
			results: &Results{
				Checks: []CheckResult{
					{
						Name:      "test",
						Status:    "pass",
						Duration:  1250 * time.Millisecond,
						Coverage:  85.5,
						Threshold: 80.0,
					},
				},
				Total:  1250 * time.Millisecond,
				Status: "pass",
			},
			wantContain: []string{
				"✓",
				"test",
				"(1.2s)",
				"85.5% coverage",
				"threshold: 80%",
				"All checks passed. Safe to push.",
			},
			description: "should format test result with coverage and threshold",
		},
		{
			name: "failing lint with issues",
			results: &Results{
				Checks: []CheckResult{
					{
						Name:     "lint",
						Status:   "fail",
						Duration: 750 * time.Millisecond,
						Issues:   5,
						Message:  "Found style issues",
					},
				},
				Total:  750 * time.Millisecond,
				Status: "fail",
			},
			wantContain: []string{
				"✗",
				"lint",
				"(0.8s)",
				"5 issues",
				"Found style issues",
				"Some checks failed. Please fix the issues.",
			},
			description: "should format lint result with issues and message",
		},
		{
			name: "security check with vulnerabilities",
			results: &Results{
				Checks: []CheckResult{
					{
						Name:            "security",
						Status:          "fail",
						Duration:        2 * time.Second,
						Vulnerabilities: 3,
					},
				},
				Total:  2 * time.Second,
				Status: "fail",
			},
			wantContain: []string{
				"✗",
				"security",
				"(2.0s)",
				"3 vulnerabilities",
			},
			description: "should format security result with vulnerabilities",
		},
		{
			name: "error status",
			results: &Results{
				Checks: []CheckResult{
					{
						Name:     "test",
						Status:   "error",
						Duration: 100 * time.Millisecond,
						Message:  "Command failed",
					},
				},
				Total:  100 * time.Millisecond,
				Status: "error",
			},
			wantContain: []string{
				"⚠",
				"test",
				"(0.1s)",
				"Command failed",
				"Some checks encountered errors.",
			},
			description: "should format error result",
		},
		{
			name: "skipped check",
			results: &Results{
				Checks: []CheckResult{
					{
						Name:     "benchmark",
						Status:   "skip",
						Duration: 0,
						Message:  "Skipped in CI",
					},
				},
				Total:  0,
				Status: "pass",
			},
			wantContain: []string{
				"○",
				"benchmark",
				"(0.0s)",
				"Skipped in CI",
			},
			description: "should format skipped check",
		},
		{
			name: "multiple checks mixed results",
			results: &Results{
				Checks: []CheckResult{
					{
						Name:     "test",
						Status:   "pass",
						Duration: 1 * time.Second,
						Coverage: 90.0,
					},
					{
						Name:     "lint",
						Status:   "fail",
						Duration: 500 * time.Millisecond,
						Issues:   2,
					},
					{
						Name:            "security",
						Status:          "pass",
						Duration:        800 * time.Millisecond,
						Vulnerabilities: 0,
					},
				},
				Total:  2300 * time.Millisecond,
				Status: "fail",
			},
			wantContain: []string{
				"✓",
				"✗",
				"test",
				"lint",
				"security",
				"90.0% coverage",
				"2 issues",
				"0 vulnerabilities",
			},
			description: "should format multiple checks correctly",
		},
		{
			name: "test without coverage",
			results: &Results{
				Checks: []CheckResult{
					{
						Name:     "test",
						Status:   "pass",
						Duration: 1 * time.Second,
						Coverage: 0,
					},
				},
				Total:  1 * time.Second,
				Status: "pass",
			},
			wantContain: []string{
				"✓",
				"test",
				"(1.0s)",
			},
			description: "should not show coverage when zero",
		},
		{
			name: "zero issues lint",
			results: &Results{
				Checks: []CheckResult{
					{
						Name:     "lint",
						Status:   "pass",
						Duration: 500 * time.Millisecond,
						Issues:   0,
					},
				},
				Total:  500 * time.Millisecond,
				Status: "pass",
			},
			wantContain: []string{
				"✓",
				"lint",
				"(0.5s)",
				"0 issues",
			},
			description: "should show zero issues for lint",
		},
		{
			name: "test with threshold but no coverage",
			results: &Results{
				Checks: []CheckResult{
					{
						Name:      "test",
						Status:    "pass",
						Duration:  1 * time.Second,
						Coverage:  0,
						Threshold: 80.0,
					},
				},
				Total:  1 * time.Second,
				Status: "pass",
			},
			wantContain: []string{
				"✓",
				"test",
				"(1.0s)",
			},
			description: "should not show threshold when coverage is zero",
		},
		{
			name: "benchmark check",
			results: &Results{
				Checks: []CheckResult{
					{
						Name:     "benchmark",
						Status:   "pass",
						Duration: 5 * time.Second,
					},
				},
				Total:  5 * time.Second,
				Status: "pass",
			},
			wantContain: []string{
				"✓",
				"benchmark",
				"(5.0s)",
			},
			description: "should format benchmark result",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			buf := &bytes.Buffer{}
			f := NewFormatter("text", buf)

			err := f.PrintResults(tt.results)
			if err != nil {
				t.Errorf("%s: unexpected error: %v", tt.description, err)
				return
			}

			got := buf.String()

			for _, want := range tt.wantContain {
				if !strings.Contains(got, want) {
					t.Errorf("%s: output should contain %q\nGot: %s", tt.description, want, got)
				}
			}
		})
	}
}

func TestPrintResults_DefaultFormat(t *testing.T) {
	buf := &bytes.Buffer{}
	f := NewFormatter("", buf)

	results := &Results{
		Checks: []CheckResult{
			{
				Name:     "test",
				Status:   "pass",
				Duration: 1 * time.Second,
			},
		},
		Total:  1 * time.Second,
		Status: "pass",
	}

	err := f.PrintResults(results)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
		return
	}

	got := buf.String()

	// Default format should be text
	if !strings.Contains(got, "✓") {
		t.Errorf("expected text format output, got: %s", got)
	}
}

func TestPrintResults_UnknownFormat(t *testing.T) {
	buf := &bytes.Buffer{}
	f := NewFormatter("unknown", buf)

	results := &Results{
		Checks: []CheckResult{
			{
				Name:     "test",
				Status:   "pass",
				Duration: 1 * time.Second,
			},
		},
		Total:  1 * time.Second,
		Status: "pass",
	}

	err := f.PrintResults(results)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
		return
	}

	got := buf.String()

	// Unknown format should default to text
	if !strings.Contains(got, "✓") {
		t.Errorf("expected text format output for unknown format, got: %s", got)
	}
}

func TestPrintResults_UnknownStatus(t *testing.T) {
	buf := &bytes.Buffer{}
	f := NewFormatter("text", buf)

	results := &Results{
		Checks: []CheckResult{
			{
				Name:     "test",
				Status:   "pass",
				Duration: 1 * time.Second,
			},
		},
		Total:  1 * time.Second,
		Status: "pending", // Unknown status - not pass, fail, error, or skip
	}

	err := f.PrintResults(results)
	if err != nil {
		t.Errorf("unexpected error: %v", err)
		return
	}

	got := buf.String()

	// Should not contain any status message for unknown status
	if strings.Contains(got, "All checks passed") {
		t.Error("should not contain pass message for unknown status")
	}
	if strings.Contains(got, "Some checks failed") {
		t.Error("should not contain fail message for unknown status")
	}
	if strings.Contains(got, "Some checks encountered errors") {
		t.Error("should not contain error message for unknown status")
	}
}

func TestPrintResults_WriterError(t *testing.T) {
	formatter := NewFormatter("text", &errorWriter{})
	results := &Results{
		Checks: []CheckResult{
			{
				Name:     "test",
				Status:   "pass",
				Duration: time.Second,
			},
		},
		Total:  time.Second,
		Status: "pass",
	}

	err := formatter.PrintResults(results)
	if err == nil {
		t.Fatal("expected error when writer fails, got nil")
	}
	if !strings.Contains(err.Error(), "write") {
		t.Errorf("expected error message to mention write failure, got: %v", err)
	}
}

func TestCheckResult_JSON(t *testing.T) {
	check := CheckResult{
		Name:            "security",
		Status:          "fail",
		Duration:        2 * time.Second,
		Issues:          5,
		Coverage:        85.5,
		Threshold:       80.0,
		Vulnerabilities: 3,
		Message:         "Critical issues found",
	}

	data, err := json.Marshal(check)
	if err != nil {
		t.Fatalf("failed to marshal CheckResult: %v", err)
	}

	var parsed CheckResult
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("failed to unmarshal CheckResult: %v", err)
	}

	if parsed.Name != check.Name {
		t.Errorf("expected Name %q, got %q", check.Name, parsed.Name)
	}

	if parsed.Status != check.Status {
		t.Errorf("expected Status %q, got %q", check.Status, parsed.Status)
	}

	if parsed.Issues != check.Issues {
		t.Errorf("expected Issues %d, got %d", check.Issues, parsed.Issues)
	}

	if parsed.Coverage != check.Coverage {
		t.Errorf("expected Coverage %f, got %f", check.Coverage, parsed.Coverage)
	}

	if parsed.Vulnerabilities != check.Vulnerabilities {
		t.Errorf("expected Vulnerabilities %d, got %d", check.Vulnerabilities, parsed.Vulnerabilities)
	}

	if parsed.Message != check.Message {
		t.Errorf("expected Message %q, got %q", check.Message, parsed.Message)
	}
}

func TestResults_JSON(t *testing.T) {
	results := Results{
		Checks: []CheckResult{
			{
				Name:     "test",
				Status:   "pass",
				Duration: 1 * time.Second,
				Coverage: 85.5,
			},
			{
				Name:     "lint",
				Status:   "fail",
				Duration: 500 * time.Millisecond,
				Issues:   5,
			},
		},
		Total:  1500 * time.Millisecond,
		Status: "fail",
	}

	data, err := json.Marshal(results)
	if err != nil {
		t.Fatalf("failed to marshal Results: %v", err)
	}

	var parsed Results
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("failed to unmarshal Results: %v", err)
	}

	if len(parsed.Checks) != len(results.Checks) {
		t.Errorf("expected %d checks, got %d", len(results.Checks), len(parsed.Checks))
	}

	if parsed.Status != results.Status {
		t.Errorf("expected Status %q, got %q", results.Status, parsed.Status)
	}
}

func TestIntegration_TextFormat(t *testing.T) {
	buf := &bytes.Buffer{}
	f := NewFormatter("text", buf)

	// Print progress
	err := f.PrintProgress([]string{"test", "lint", "security"})
	if err != nil {
		t.Fatalf("PrintProgress failed: %v", err)
	}

	// Print results
	results := &Results{
		Checks: []CheckResult{
			{
				Name:      "test",
				Status:    "pass",
				Duration:  1250 * time.Millisecond,
				Coverage:  85.5,
				Threshold: 80.0,
			},
			{
				Name:     "lint",
				Status:   "fail",
				Duration: 750 * time.Millisecond,
				Issues:   5,
				Message:  "Found style issues",
			},
			{
				Name:            "security",
				Status:          "pass",
				Duration:        2 * time.Second,
				Vulnerabilities: 0,
			},
		},
		Total:  4 * time.Second,
		Status: "fail",
	}

	err = f.PrintResults(results)
	if err != nil {
		t.Fatalf("PrintResults failed: %v", err)
	}

	got := buf.String()

	expected := []string{
		"Running: test, lint and security",
		"✓",
		"✗",
		"test",
		"lint",
		"security",
		"85.5% coverage",
		"5 issues",
		"0 vulnerabilities",
		"Some checks failed. Please fix the issues.",
	}

	for _, exp := range expected {
		if !strings.Contains(got, exp) {
			t.Errorf("output should contain %q\nGot: %s", exp, got)
		}
	}
}

func TestIntegration_JSONFormat(t *testing.T) {
	buf := &bytes.Buffer{}
	f := NewFormatter("json", buf)

	// Print progress (should be skipped)
	err := f.PrintProgress([]string{"test", "lint"})
	if err != nil {
		t.Fatalf("PrintProgress failed: %v", err)
	}

	// Verify no progress output
	if buf.Len() > 0 {
		t.Errorf("expected no progress output in JSON mode, got: %s", buf.String())
	}

	// Print results
	results := &Results{
		Checks: []CheckResult{
			{
				Name:     "test",
				Status:   "pass",
				Duration: 1 * time.Second,
				Coverage: 90.0,
			},
			{
				Name:     "lint",
				Status:   "pass",
				Duration: 500 * time.Millisecond,
				Issues:   0,
			},
		},
		Total:  1500 * time.Millisecond,
		Status: "pass",
	}

	err = f.PrintResults(results)
	if err != nil {
		t.Fatalf("PrintResults failed: %v", err)
	}

	// Verify valid JSON
	var parsed Results
	if err := json.Unmarshal(buf.Bytes(), &parsed); err != nil {
		t.Fatalf("invalid JSON: %v\nGot: %s", err, buf.String())
	}

	if len(parsed.Checks) != 2 {
		t.Errorf("expected 2 checks, got %d", len(parsed.Checks))
	}

	if parsed.Status != "pass" {
		t.Errorf("expected status 'pass', got %q", parsed.Status)
	}
}
