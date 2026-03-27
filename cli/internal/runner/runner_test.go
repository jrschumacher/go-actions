package runner

import (
	"testing"
	"time"

	"github.com/jrschumacher/go-actions/cli/internal/config"
)

// TestRunner tests focus on the orchestration logic in the runner package.
// Individual check runners (RunTest, RunLint, RunSecurity, RunBenchmark)
// require external tools and are tested through integration tests.
// These tests verify:
// - Configuration management and check selection
// - Result aggregation and status propagation
// - Parsing logic for tool outputs
// - Error handling without actual tool execution

func TestNew(t *testing.T) {
	cfg := config.DefaultConfig()
	runner := New(cfg)

	if runner == nil {
		t.Fatal("New() returned nil")
	}
	if runner.cfg != cfg {
		t.Error("New() did not set config correctly")
	}
}

func TestGetEnabledChecks(t *testing.T) {
	tests := []struct {
		name     string
		cfg      *config.Config
		expected []string
	}{
		{
			name: "all checks enabled",
			cfg: func() *config.Config {
				cfg := config.DefaultConfig()
				cfg.CI.Benchmark.Enabled = true
				return cfg
			}(),
			expected: []string{"test", "lint", "security", "benchmark"},
		},
		{
			name: "only test enabled",
			cfg: func() *config.Config {
				cfg := config.DefaultConfig()
				cfg.CI.Lint.Enabled = false
				cfg.CI.Security.Enabled = false
				cfg.CI.Benchmark.Enabled = false
				return cfg
			}(),
			expected: []string{"test"},
		},
		{
			name: "only lint enabled",
			cfg: func() *config.Config {
				cfg := config.DefaultConfig()
				falseVal := false
				cfg.CI.Test.Enabled = &falseVal
				cfg.CI.Lint.Enabled = true
				cfg.CI.Security.Enabled = false
				cfg.CI.Benchmark.Enabled = false
				return cfg
			}(),
			expected: []string{"lint"},
		},
		{
			name: "no checks enabled",
			cfg: func() *config.Config {
				cfg := config.DefaultConfig()
				falseVal := false
				cfg.CI.Test.Enabled = &falseVal
				cfg.CI.Lint.Enabled = false
				cfg.CI.Security.Enabled = false
				cfg.CI.Benchmark.Enabled = false
				return cfg
			}(),
			expected: []string{},
		},
		{
			name: "test and security enabled",
			cfg: func() *config.Config {
				cfg := config.DefaultConfig()
				cfg.CI.Lint.Enabled = false
				cfg.CI.Security.Enabled = true
				cfg.CI.Benchmark.Enabled = false
				return cfg
			}(),
			expected: []string{"test", "security"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			runner := New(tt.cfg)
			checks := runner.getEnabledChecks()

			if len(checks) != len(tt.expected) {
				t.Errorf("getEnabledChecks() got %d checks, want %d", len(checks), len(tt.expected))
				t.Errorf("got: %v, want: %v", checks, tt.expected)
				return
			}

			for i, check := range checks {
				if check != tt.expected[i] {
					t.Errorf("getEnabledChecks()[%d] = %v, want %v", i, check, tt.expected[i])
				}
			}
		})
	}
}

func TestRunCheckUnknownCheck(t *testing.T) {
	cfg := config.DefaultConfig()
	runner := New(cfg)

	result, err := runner.RunCheck("unknown")
	if err == nil {
		t.Error("RunCheck() with unknown check should return error")
	}
	if result != nil {
		t.Error("RunCheck() with unknown check should return nil result")
	}
}

func TestRunCheckValidNames(t *testing.T) {
	// Skip this test as it attempts to run actual commands
	// The individual check methods (RunTest, RunLint, etc.) are tested
	// through integration tests in their respective files
	t.Skip("Skipping RunCheck tests that require external tools")
}

func TestExtractCoverage(t *testing.T) {
	tests := []struct {
		name     string
		output   string
		expected float64
		wantErr  bool
	}{
		{
			name:     "valid coverage output",
			output:   "ok  	github.com/example/pkg	0.123s	coverage: 85.2% of statements",
			expected: 85.2,
			wantErr:  false,
		},
		{
			name:     "coverage 100%",
			output:   "coverage: 100.0% of statements",
			expected: 100.0,
			wantErr:  false,
		},
		{
			name:     "coverage 0%",
			output:   "coverage: 0.0% of statements",
			expected: 0.0,
			wantErr:  false,
		},
		{
			name:     "coverage with decimals",
			output:   "coverage: 92.7% of statements",
			expected: 92.7,
			wantErr:  false,
		},
		{
			name:    "no coverage in output",
			output:  "ok  	github.com/example/pkg	0.123s",
			wantErr: true,
		},
		{
			name:    "malformed coverage",
			output:  "coverage: invalid% of statements",
			wantErr: true,
		},
		{
			name:    "empty output",
			output:  "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			coverage, err := extractCoverage(tt.output)
			if (err != nil) != tt.wantErr {
				t.Errorf("extractCoverage() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && coverage != tt.expected {
				t.Errorf("extractCoverage() = %v, want %v", coverage, tt.expected)
			}
		})
	}
}

func TestParseLintOutput(t *testing.T) {
	tests := []struct {
		name      string
		input     []byte
		wantCount int
		wantErr   bool
	}{
		{
			name:      "empty output",
			input:     []byte{},
			wantCount: 0,
			wantErr:   false,
		},
		{
			name:      "valid JSON output",
			input:     []byte(`{"Issues":[{"FromLinter":"errcheck","Text":"error","Pos":{"Filename":"test.go","Line":1,"Column":1}}]}`),
			wantCount: 1,
			wantErr:   false,
		},
		{
			name:      "multiple issues",
			input:     []byte(`{"Issues":[{"FromLinter":"errcheck","Text":"error1","Pos":{"Filename":"test.go","Line":1,"Column":1}},{"FromLinter":"staticcheck","Text":"error2","Pos":{"Filename":"test.go","Line":2,"Column":1}}]}`),
			wantCount: 2,
			wantErr:   false,
		},
		{
			name:      "no issues",
			input:     []byte(`{"Issues":[]}`),
			wantCount: 0,
			wantErr:   false,
		},
		{
			name:      "JSON with newline and text summary",
			input:     []byte(`{"Issues":[{"FromLinter":"errcheck","Text":"error","Pos":{"Filename":"test.go","Line":1,"Column":1}}]}` + "\nSummary text"),
			wantCount: 1,
			wantErr:   false,
		},
		{
			name:    "invalid JSON",
			input:   []byte(`{invalid json}`),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			issues, err := parseLintOutput(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseLintOutput() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && len(issues) != tt.wantCount {
				t.Errorf("parseLintOutput() got %d issues, want %d", len(issues), tt.wantCount)
			}
		})
	}
}

func TestFormatLintIssues(t *testing.T) {
	tests := []struct {
		name   string
		issues []lintIssue
		want   string
	}{
		{
			name:   "empty issues",
			issues: []lintIssue{},
			want:   "",
		},
		{
			name: "single issue",
			issues: []lintIssue{
				{
					FromLinter: "errcheck",
					Text:       "Error return value not checked",
					Pos: struct {
						Filename string `json:"Filename"`
						Line     int    `json:"Line"`
						Column   int    `json:"Column"`
					}{Filename: "main.go", Line: 10, Column: 5},
				},
			},
			want: "  main.go:10:5: Error return value not checked (errcheck)",
		},
		{
			name: "multiple issues",
			issues: []lintIssue{
				{
					FromLinter: "errcheck",
					Text:       "unchecked error",
					Pos: struct {
						Filename string `json:"Filename"`
						Line     int    `json:"Line"`
						Column   int    `json:"Column"`
					}{Filename: "a.go", Line: 1, Column: 1},
				},
				{
					FromLinter: "staticcheck",
					Text:       "unnecessary nil check",
					Pos: struct {
						Filename string `json:"Filename"`
						Line     int    `json:"Line"`
						Column   int    `json:"Column"`
					}{Filename: "b.go", Line: 2, Column: 3},
				},
			},
			want: "  a.go:1:1: unchecked error (errcheck)\n  b.go:2:3: unnecessary nil check (staticcheck)",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := formatLintIssues(tt.issues)
			if got != tt.want {
				t.Errorf("formatLintIssues() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestParseSecurityOutput(t *testing.T) {
	tests := []struct {
		name      string
		input     []byte
		wantCount int
		wantErr   bool
	}{
		{
			name:      "empty output",
			input:     []byte{},
			wantCount: 0,
			wantErr:   false,
		},
		{
			name:      "valid vulnerability",
			input:     []byte(`{"finding":{"osv":{"id":"GO-2023-1234","summary":"test vuln","severity":"HIGH"}}}`),
			wantCount: 1,
			wantErr:   false,
		},
		{
			name: "multiple vulnerabilities",
			input: []byte(`{"finding":{"osv":{"id":"GO-2023-1234","summary":"vuln1","severity":"HIGH"}}}
{"finding":{"osv":{"id":"GO-2023-5678","summary":"vuln2","severity":"MEDIUM"}}}`),
			wantCount: 2,
			wantErr:   false,
		},
		{
			name:      "no vulnerabilities",
			input:     []byte(`{"config":{}}`),
			wantCount: 0,
			wantErr:   false,
		},
		{
			name: "mixed entries with vulnerabilities",
			input: []byte(`{"config":{}}
{"finding":{"osv":{"id":"GO-2023-1234","summary":"vuln1"}}}
{"progress":{}}`),
			wantCount: 1,
			wantErr:   false,
		},
		{
			name:      "empty lines",
			input:     []byte("\n\n"),
			wantCount: 0,
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			vulns, err := parseSecurityOutput(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseSecurityOutput() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if len(vulns) != tt.wantCount {
				t.Errorf("parseSecurityOutput() got %d vulnerabilities, want %d", len(vulns), tt.wantCount)
			}
		})
	}
}

func TestRunAllNoChecksEnabled(t *testing.T) {
	cfg := config.DefaultConfig()
	falseVal := false
	cfg.CI.Test.Enabled = &falseVal
	cfg.CI.Lint.Enabled = false
	cfg.CI.Security.Enabled = false
	cfg.CI.Benchmark.Enabled = false

	runner := New(cfg)
	results, err := runner.RunAll()

	if err != nil {
		t.Errorf("RunAll() with no checks should not return error, got %v", err)
	}
	if results == nil {
		t.Fatal("RunAll() returned nil results")
	}
	if len(results.Checks) != 0 {
		t.Errorf("RunAll() with no checks should have 0 results, got %d", len(results.Checks))
	}
	if results.Status != "pass" {
		t.Errorf("RunAll() with no checks should have status 'pass', got %s", results.Status)
	}
	if results.Total == 0 {
		t.Error("RunAll() should set Total duration even with no checks")
	}
}

func TestRunAllStatusPropagation(t *testing.T) {
	// Skip this test as it attempts to run actual commands
	// Status propagation is tested through RunAllNoChecksEnabled
	// and would require mocking external tool execution
	t.Skip("Skipping RunAll status propagation tests that require external tools")
}

func TestRunAllDurationTracking(t *testing.T) {
	cfg := config.DefaultConfig()
	falseVal := false
	cfg.CI.Test.Enabled = &falseVal
	cfg.CI.Lint.Enabled = false
	cfg.CI.Security.Enabled = false
	cfg.CI.Benchmark.Enabled = false

	runner := New(cfg)
	start := time.Now()
	results, err := runner.RunAll()
	elapsed := time.Since(start)

	if err != nil {
		t.Errorf("RunAll() returned unexpected error: %v", err)
	}
	if results == nil {
		t.Fatal("RunAll() returned nil results")
	}

	// Total duration should be reasonable (less than or equal to actual elapsed time)
	if results.Total > elapsed {
		t.Errorf("RunAll() Total duration %v exceeds actual elapsed time %v", results.Total, elapsed)
	}

	// With no checks, Total can be 0 or very small - just verify it's set (not negative)
	if results.Total < 0 {
		t.Error("RunAll() should not have negative Total duration")
	}
}

func TestRunCheckDurationTracking(t *testing.T) {
	cfg := config.DefaultConfig()
	runner := New(cfg)

	// Test with an invalid check name to avoid actual execution
	start := time.Now()
	_, err := runner.RunCheck("unknown")
	elapsed := time.Since(start)

	if err == nil {
		t.Error("RunCheck() with unknown check should return error")
	}

	// Should return quickly for unknown check
	if elapsed > 100*time.Millisecond {
		t.Errorf("RunCheck() with unknown check took too long: %v", elapsed)
	}
}

func TestCheckToolInstalled(t *testing.T) {
	tests := []struct {
		name    string
		tool    string
		wantErr bool
	}{
		{
			name:    "existing tool - go",
			tool:    "go",
			wantErr: false, // go should be installed in test environment
		},
		{
			name:    "non-existent tool",
			tool:    "nonexistenttoolxyz123",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := checkToolInstalled(tt.tool)
			if (err != nil) != tt.wantErr {
				t.Errorf("checkToolInstalled(%s) error = %v, wantErr %v", tt.tool, err, tt.wantErr)
			}
		})
	}
}

func TestRunAllEnabledChecksCount(t *testing.T) {
	// Verify that getEnabledChecks is called correctly by RunAll
	tests := []struct {
		name          string
		setupCfg      func() *config.Config
		expectedCount int
	}{
		{
			name: "no checks enabled",
			setupCfg: func() *config.Config {
				cfg := config.DefaultConfig()
				falseVal := false
				cfg.CI.Test.Enabled = &falseVal
				cfg.CI.Lint.Enabled = false
				cfg.CI.Security.Enabled = false
				cfg.CI.Benchmark.Enabled = false
				return cfg
			},
			expectedCount: 0,
		},
		{
			name: "all checks enabled",
			setupCfg: func() *config.Config {
				cfg := config.DefaultConfig()
				cfg.CI.Benchmark.Enabled = true
				return cfg
			},
			expectedCount: 4,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := tt.setupCfg()
			runner := New(cfg)
			checks := runner.getEnabledChecks()

			if len(checks) != tt.expectedCount {
				t.Errorf("getEnabledChecks() = %d, want %d", len(checks), tt.expectedCount)
			}
		})
	}
}

func TestParseLintOutputWithOnlyNewline(t *testing.T) {
	// Edge case: output with only a newline
	input := []byte("\n")
	issues, err := parseLintOutput(input)

	if err != nil {
		t.Errorf("parseLintOutput() with newline should not error, got %v", err)
	}
	if len(issues) != 0 {
		t.Errorf("parseLintOutput() with newline should have 0 issues, got %d", len(issues))
	}
}

func TestParseSecurityOutputMalformedJSON(t *testing.T) {
	// Test that malformed JSON lines are gracefully skipped
	input := []byte(`{malformed json}
{"finding":{"osv":{"id":"GO-2023-1234","summary":"valid vuln"}}}
{more malformed}`)

	vulns, err := parseSecurityOutput(input)

	if err != nil {
		t.Errorf("parseSecurityOutput() should not error on malformed lines, got %v", err)
	}
	// Should only find the one valid vulnerability
	if len(vulns) != 1 {
		t.Errorf("parseSecurityOutput() should find 1 vulnerability, got %d", len(vulns))
	}
	if len(vulns) > 0 && vulns[0].OSV.ID != "GO-2023-1234" {
		t.Errorf("parseSecurityOutput() got ID %s, want GO-2023-1234", vulns[0].OSV.ID)
	}
}
