package github

import (
	"strings"
	"testing"
	"time"

	"github.com/jrschumacher/go-actions/cli/internal/output"
)

func TestFormatComment(t *testing.T) {
	tests := []struct {
		name     string
		results  *output.Results
		contains []string
		notContains []string
	}{
		{
			name:    "nil results",
			results: nil,
			contains: []string{
				CommentMarker,
				"⏳ **Pending**",
				"No CI jobs have run yet",
			},
		},
		{
			name: "empty results",
			results: &output.Results{
				Checks: []output.CheckResult{},
			},
			contains: []string{
				CommentMarker,
				"⏳ **Pending**",
			},
		},
		{
			name: "all checks passing",
			results: &output.Results{
				Checks: []output.CheckResult{
					{Name: "test", Status: "pass", Coverage: 85.5, Duration: time.Second},
					{Name: "lint", Status: "pass", Duration: time.Second},
					{Name: "security", Status: "pass", Duration: time.Second},
					{Name: "benchmark", Status: "pass", Duration: time.Second},
				},
			},
			contains: []string{
				CommentMarker,
				"✅ **Tests** (85.5% coverage)",
				"✅ **Lint**",
				"✅ **Security**",
				"✅ **Benchmarks**",
				"Excellent test coverage!",
				"Code quality checks passed!",
				"No known vulnerabilities found",
				"Benchmarks completed successfully!",
				"*🤖 This comment will update automatically",
			},
			notContains: []string{
				"Issues Found",
				"Vulnerabilities Found",
				"failed",
			},
		},
		{
			name: "test failure",
			results: &output.Results{
				Checks: []output.CheckResult{
					{Name: "test", Status: "fail", Message: "test panic", Duration: time.Second},
				},
			},
			contains: []string{
				"❌ **Tests** (failed)",
				"<details open><summary>Test Issues</summary>",
				"**Tests failed!**",
				"**Error:** test panic",
			},
		},
		{
			name: "lint failure with issues",
			results: &output.Results{
				Checks: []output.CheckResult{
					{Name: "lint", Status: "fail", Issues: 5, Message: "main.go:10:1: error message\nutil.go:20:5: another error", Duration: time.Second},
				},
			},
			contains: []string{
				"🚨 **Lint** **- Issues Found!**",
				"<details open><summary>🚨 Lint Issues Found</summary>",
				"**Code quality checks failed!**",
				"main.go:10:1: error message",
				"util.go:20:5: another error",
			},
		},
		{
			name: "security failure with vulnerabilities",
			results: &output.Results{
				Checks: []output.CheckResult{
					{Name: "security", Status: "fail", Vulnerabilities: 3, Message: "CVE-2024-1234: High severity vulnerability", Duration: time.Second},
				},
			},
			contains: []string{
				"🚨 **Security** **- 3 Vulnerabilities Found!**",
				"<details open><summary>🚨 3 Vulnerabilities Found</summary>",
				"**Security scan detected known CVEs",
				"CVE-2024-1234: High severity vulnerability",
			},
		},
		{
			name: "single vulnerability (plural check)",
			results: &output.Results{
				Checks: []output.CheckResult{
					{Name: "security", Status: "fail", Vulnerabilities: 1, Duration: time.Second},
				},
			},
			contains: []string{
				"**- 1 Vulnerability Found!**",
				"<details open><summary>🚨 1 Vulnerability Found</summary>",
			},
		},
		{
			name: "benchmark failure",
			results: &output.Results{
				Checks: []output.CheckResult{
					{Name: "benchmark", Status: "fail", Message: "benchmark timeout", Duration: time.Second},
				},
			},
			contains: []string{
				"❌ **Benchmarks** (failed)",
				"<details open><summary>Benchmark Issues</summary>",
				"**Benchmarks failed!**",
				"**Error:** benchmark timeout",
			},
		},
		{
			name: "skipped checks not shown",
			results: &output.Results{
				Checks: []output.CheckResult{
					{Name: "test", Status: "pass", Coverage: 70.0, Duration: time.Second},
					{Name: "lint", Status: "skip", Duration: time.Second},
					{Name: "security", Status: "skip", Duration: time.Second},
				},
			},
			contains: []string{
				"✅ **Tests** (70.0% coverage)",
			},
			notContains: []string{
				"**Lint**",
				"**Security**",
			},
		},
		{
			name: "coverage thresholds - excellent",
			results: &output.Results{
				Checks: []output.CheckResult{
					{Name: "test", Status: "pass", Coverage: 90.0, Duration: time.Second},
				},
			},
			contains: []string{
				"**Coverage: 90.0%**",
				"🎉 Excellent test coverage!",
			},
		},
		{
			name: "coverage thresholds - good",
			results: &output.Results{
				Checks: []output.CheckResult{
					{Name: "test", Status: "pass", Coverage: 65.0, Duration: time.Second},
				},
			},
			contains: []string{
				"**Coverage: 65.0%**",
				"⚠️ Good coverage, consider adding more tests.",
			},
		},
		{
			name: "coverage thresholds - low",
			results: &output.Results{
				Checks: []output.CheckResult{
					{Name: "test", Status: "pass", Coverage: 45.0, Duration: time.Second},
				},
			},
			contains: []string{
				"**Coverage: 45.0%**",
				"🚨 Low test coverage detected. Please add more tests.",
			},
		},
		{
			name: "lint output truncation",
			results: &output.Results{
				Checks: []output.CheckResult{
					{Name: "lint", Status: "fail", Message: strings.Repeat("error line\n", 500), Duration: time.Second},
				},
			},
			contains: []string{
				"... (truncated, see workflow logs for full output)",
			},
		},
		{
			name: "footer always present",
			results: &output.Results{
				Checks: []output.CheckResult{
					{Name: "test", Status: "pass", Duration: time.Second},
				},
			},
			contains: []string{
				"*🤖 This comment will update automatically as you push changes.*",
				"*Generated by [go-actions](https://github.com/jrschumacher/go-actions)*",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			comment := FormatComment(tt.results)

			// Check that all expected strings are present
			for _, expected := range tt.contains {
				if !strings.Contains(comment, expected) {
					t.Errorf("FormatComment() missing expected string:\n%q\n\nFull comment:\n%s", expected, comment)
				}
			}

			// Check that unwanted strings are not present
			for _, unexpected := range tt.notContains {
				if strings.Contains(comment, unexpected) {
					t.Errorf("FormatComment() contains unexpected string:\n%q\n\nFull comment:\n%s", unexpected, comment)
				}
			}
		})
	}
}

func TestFormatStatusLine(t *testing.T) {
	tests := []struct {
		name     string
		check    output.CheckResult
		expected string
	}{
		{
			name:     "test passing with coverage",
			check:    output.CheckResult{Name: "test", Status: "pass", Coverage: 85.5},
			expected: "✅ **Tests** (85.5% coverage)",
		},
		{
			name:     "test passing without coverage",
			check:    output.CheckResult{Name: "test", Status: "pass"},
			expected: "✅ **Tests**",
		},
		{
			name:     "test failing",
			check:    output.CheckResult{Name: "test", Status: "fail"},
			expected: "❌ **Tests** (failed)",
		},
		{
			name:     "lint passing",
			check:    output.CheckResult{Name: "lint", Status: "pass"},
			expected: "✅ **Lint**",
		},
		{
			name:     "lint failing",
			check:    output.CheckResult{Name: "lint", Status: "fail", Issues: 5},
			expected: "🚨 **Lint** **- Issues Found!**",
		},
		{
			name:     "security passing",
			check:    output.CheckResult{Name: "security", Status: "pass"},
			expected: "✅ **Security**",
		},
		{
			name:     "security failing with multiple vulnerabilities",
			check:    output.CheckResult{Name: "security", Status: "fail", Vulnerabilities: 3},
			expected: "🚨 **Security** **- 3 Vulnerabilities Found!**",
		},
		{
			name:     "security failing with single vulnerability",
			check:    output.CheckResult{Name: "security", Status: "fail", Vulnerabilities: 1},
			expected: "🚨 **Security** **- 1 Vulnerability Found!**",
		},
		{
			name:     "benchmark passing",
			check:    output.CheckResult{Name: "benchmark", Status: "pass"},
			expected: "✅ **Benchmarks**",
		},
		{
			name:     "benchmark failing",
			check:    output.CheckResult{Name: "benchmark", Status: "fail"},
			expected: "❌ **Benchmarks** (failed)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := formatStatusLine(tt.check)
			if result != tt.expected {
				t.Errorf("formatStatusLine() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestGetCoverageEmoji(t *testing.T) {
	tests := []struct {
		name     string
		coverage float64
		expected string
	}{
		{"excellent coverage", 90.0, "🎉"},
		{"at excellent threshold", 80.0, "🎉"},
		{"good coverage", 70.0, "⚠️"},
		{"at good threshold", 60.0, "⚠️"},
		{"low coverage", 45.0, "🚨"},
		{"zero coverage", 0.0, "🚨"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getCoverageEmoji(tt.coverage)
			if result != tt.expected {
				t.Errorf("getCoverageEmoji(%v) = %q, want %q", tt.coverage, result, tt.expected)
			}
		})
	}
}

func TestGetCoverageMessage(t *testing.T) {
	tests := []struct {
		name     string
		coverage float64
		expected string
	}{
		{"excellent coverage", 90.0, "Excellent test coverage!"},
		{"at excellent threshold", 80.0, "Excellent test coverage!"},
		{"good coverage", 70.0, "Good coverage, consider adding more tests."},
		{"at good threshold", 60.0, "Good coverage, consider adding more tests."},
		{"low coverage", 45.0, "Low test coverage detected. Please add more tests."},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getCoverageMessage(tt.coverage)
			if result != tt.expected {
				t.Errorf("getCoverageMessage(%v) = %q, want %q", tt.coverage, result, tt.expected)
			}
		})
	}
}

func TestFormatEmptyComment(t *testing.T) {
	comment := formatEmptyComment()

	expectedStrings := []string{
		CommentMarker,
		"⏳ **Pending**",
		"No CI jobs have run yet",
		"*🤖 This comment will update automatically",
		"*Generated by [go-actions]",
	}

	for _, expected := range expectedStrings {
		if !strings.Contains(comment, expected) {
			t.Errorf("formatEmptyComment() missing expected string: %q", expected)
		}
	}
}

func TestFormatProcessingComment(t *testing.T) {
	comment := FormatProcessingComment()

	expectedStrings := []string{
		CommentMarker,
		"🔄 **Running...**",
		"Validation is in progress",
		"*🤖 This comment will update automatically",
		"*Generated by [go-actions]",
	}

	for _, expected := range expectedStrings {
		if !strings.Contains(comment, expected) {
			t.Errorf("FormatProcessingComment() missing expected string: %q", expected)
		}
	}
}

func TestCommentStructure(t *testing.T) {
	results := &output.Results{
		Checks: []output.CheckResult{
			{Name: "test", Status: "pass", Coverage: 85.0, Duration: time.Second},
			{Name: "lint", Status: "fail", Issues: 3, Message: "lint errors", Duration: time.Second},
		},
	}

	comment := FormatComment(results)

	// Verify structural elements are in correct order
	markerIdx := strings.Index(comment, CommentMarker)
	testStatusIdx := strings.Index(comment, "✅ **Tests**")
	lintStatusIdx := strings.Index(comment, "🚨 **Lint**")
	testDetailsIdx := strings.Index(comment, "<details><summary>Test Details</summary>")
	lintDetailsIdx := strings.Index(comment, "<details open><summary>🚨 Lint Issues Found</summary>")
	footerIdx := strings.Index(comment, "*🤖 This comment will update automatically")

	if markerIdx == -1 || testStatusIdx == -1 || lintStatusIdx == -1 ||
		testDetailsIdx == -1 || lintDetailsIdx == -1 || footerIdx == -1 {
		t.Fatal("Comment missing required structural elements")
	}

	// Verify order: marker -> status lines -> details sections -> footer
	if !(markerIdx < testStatusIdx && testStatusIdx < lintStatusIdx &&
		lintStatusIdx < testDetailsIdx && testDetailsIdx < lintDetailsIdx &&
		lintDetailsIdx < footerIdx) {
		t.Error("Comment elements not in expected order")
	}
}

func TestLintTruncation(t *testing.T) {
	// Create a message longer than MaxLintOutputLength
	longMessage := strings.Repeat("a", MaxLintOutputLength+100)

	check := output.CheckResult{
		Name:    "lint",
		Status:  "fail",
		Message: longMessage,
	}

	details := formatLintDetails(check)

	// Verify truncation occurred
	if !strings.Contains(details, "... (truncated, see workflow logs for full output)") {
		t.Error("Expected truncation message not found")
	}

	// Verify output is not longer than expected (with some buffer for formatting)
	if len(details) > MaxLintOutputLength+500 {
		t.Errorf("Lint output not properly truncated: got %d bytes", len(details))
	}
}

func TestMarkdownFormatting(t *testing.T) {
	results := &output.Results{
		Checks: []output.CheckResult{
			{Name: "test", Status: "pass", Coverage: 85.0, Duration: time.Second},
		},
	}

	comment := FormatComment(results)

	// Verify proper markdown elements
	markdownElements := []string{
		"**Tests**",                  // Bold
		"<details>",                  // Collapsible section
		"</details>",                 // Closing tag
		"*🤖",                         // Italic
		"[go-actions](https://",      // Link
	}

	for _, element := range markdownElements {
		if !strings.Contains(comment, element) {
			t.Errorf("Comment missing markdown element: %q", element)
		}
	}
}
