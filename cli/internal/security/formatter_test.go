package security

import (
	"strings"
	"testing"
)

func TestParseGovulncheck(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    int
		wantErr bool
	}{
		{
			name:    "empty input",
			input:   "",
			want:    0,
			wantErr: false,
		},
		{
			name: "single vulnerability with finding",
			input: `{"osv":{"id":"GO-2023-1234","aliases":["CVE-2023-1234"],"summary":"Test vulnerability","severity":[{"type":"CVSS_V3","score":"9.8"}]}}
{"finding":{"osv":"GO-2023-1234","fixed_version":"v1.2.3","trace":[{"module":"github.com/example/vuln","version":"v1.0.0","package":"github.com/example/vuln","function":"VulnerableFunc","position":{"filename":"vuln.go","line":42,"column":10}}]}}`,
			want:    1,
			wantErr: false,
		},
		{
			name: "multiple vulnerabilities",
			input: `{"osv":{"id":"GO-2023-1234","aliases":["CVE-2023-1234"],"summary":"First vuln","severity":[{"type":"CVSS_V3","score":"9.8"}]}}
{"osv":{"id":"GO-2023-5678","aliases":["CVE-2023-5678"],"summary":"Second vuln","severity":[{"type":"CVSS_V3","score":"7.5"}]}}
{"finding":{"osv":"GO-2023-1234","fixed_version":"v1.2.3","trace":[{"module":"github.com/example/vuln1","version":"v1.0.0","package":"github.com/example/vuln1"}]}}
{"finding":{"osv":"GO-2023-5678","fixed_version":"v2.0.0","trace":[{"module":"github.com/example/vuln2","version":"v1.5.0","package":"github.com/example/vuln2"}]}}`,
			want:    2,
			wantErr: false,
		},
		{
			name: "osv without finding",
			input: `{"osv":{"id":"GO-2023-1234","aliases":["CVE-2023-1234"],"summary":"Test vulnerability","severity":[{"type":"CVSS_V3","score":"9.8"}]}}`,
			want:    0,
			wantErr: false,
		},
		{
			name: "finding without osv",
			input: `{"finding":{"osv":"GO-2023-1234","fixed_version":"v1.2.3","trace":[{"module":"github.com/example/vuln","version":"v1.0.0","package":"github.com/example/vuln"}]}}`,
			want:    0,
			wantErr: false,
		},
		{
			name: "with config and progress messages",
			input: `{"config":{"protocol_version":"v1.0.0","scanner_name":"govulncheck","scanner_version":"v1.0.0"}}
{"progress":{"message":"Scanning modules"}}
{"osv":{"id":"GO-2023-1234","aliases":["CVE-2023-1234"],"summary":"Test vulnerability","severity":[{"type":"CVSS_V3","score":"9.8"}]}}
{"finding":{"osv":"GO-2023-1234","fixed_version":"v1.2.3","trace":[{"module":"github.com/example/vuln","version":"v1.0.0","package":"github.com/example/vuln"}]}}`,
			want:    1,
			wantErr: false,
		},
		{
			name: "malformed json lines ignored",
			input: `{"osv":{"id":"GO-2023-1234","aliases":["CVE-2023-1234"],"summary":"Test vulnerability","severity":[{"type":"CVSS_V3","score":"9.8"}]}}
malformed json line
{"finding":{"osv":"GO-2023-1234","fixed_version":"v1.2.3","trace":[{"module":"github.com/example/vuln","version":"v1.0.0","package":"github.com/example/vuln"}]}}`,
			want:    1,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseGovulncheck(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseGovulncheck() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && result.TotalCount != tt.want {
				t.Errorf("ParseGovulncheck() got %d vulnerabilities, want %d", result.TotalCount, tt.want)
			}
		})
	}
}

func TestExtractSeverity(t *testing.T) {
	tests := []struct {
		name          string
		severities    []SeverityScore
		wantSeverity  Severity
		wantCVSSScore float64
	}{
		{
			name:          "critical severity",
			severities:    []SeverityScore{{Type: "CVSS_V3", Score: "9.8"}},
			wantSeverity:  SeverityCritical,
			wantCVSSScore: 9.8,
		},
		{
			name:          "high severity",
			severities:    []SeverityScore{{Type: "CVSS_V3", Score: "7.5"}},
			wantSeverity:  SeverityHigh,
			wantCVSSScore: 7.5,
		},
		{
			name:          "medium severity",
			severities:    []SeverityScore{{Type: "CVSS_V3", Score: "5.0"}},
			wantSeverity:  SeverityMedium,
			wantCVSSScore: 5.0,
		},
		{
			name:          "low severity",
			severities:    []SeverityScore{{Type: "CVSS_V3", Score: "2.5"}},
			wantSeverity:  SeverityLow,
			wantCVSSScore: 2.5,
		},
		{
			name:          "no severity",
			severities:    []SeverityScore{},
			wantSeverity:  SeverityUnknown,
			wantCVSSScore: 0,
		},
		{
			name:          "invalid score",
			severities:    []SeverityScore{{Type: "CVSS_V3", Score: "invalid"}},
			wantSeverity:  SeverityUnknown,
			wantCVSSScore: 0,
		},
		{
			name:          "non-cvss score",
			severities:    []SeverityScore{{Type: "OTHER", Score: "7.5"}},
			wantSeverity:  SeverityUnknown,
			wantCVSSScore: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotSeverity, gotScore := extractSeverity(tt.severities)
			if gotSeverity != tt.wantSeverity {
				t.Errorf("extractSeverity() severity = %v, want %v", gotSeverity, tt.wantSeverity)
			}
			if gotScore != tt.wantCVSSScore {
				t.Errorf("extractSeverity() score = %v, want %v", gotScore, tt.wantCVSSScore)
			}
		})
	}
}

func TestExtractReferenceURL(t *testing.T) {
	tests := []struct {
		name  string
		osv   *OSV
		osvID string
		want  string
	}{
		{
			name: "go vulnerability database reference",
			osv: &OSV{
				References: []VulnReference{
					{Type: "WEB", URL: "https://example.com"},
					{Type: "WEB", URL: "https://pkg.go.dev/vuln/GO-2023-1234"},
				},
			},
			osvID: "GO-2023-1234",
			want:  "https://pkg.go.dev/vuln/GO-2023-1234",
		},
		{
			name: "first reference when no go vuln db",
			osv: &OSV{
				References: []VulnReference{
					{Type: "WEB", URL: "https://example.com/vuln"},
				},
			},
			osvID: "GO-2023-1234",
			want:  "https://example.com/vuln",
		},
		{
			name:  "default to pkg.go.dev for GO- prefix",
			osv:   &OSV{},
			osvID: "GO-2023-1234",
			want:  "https://pkg.go.dev/vuln/GO-2023-1234",
		},
		{
			name:  "empty for non-GO prefix with no references",
			osv:   &OSV{},
			osvID: "CVE-2023-1234",
			want:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractReferenceURL(tt.osv, tt.osvID)
			if got != tt.want {
				t.Errorf("extractReferenceURL() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestBuildCallstackSummary(t *testing.T) {
	tests := []struct {
		name  string
		trace []TraceEntry
		want  string
	}{
		{
			name:  "empty trace",
			trace: []TraceEntry{},
			want:  "",
		},
		{
			name: "single entry",
			trace: []TraceEntry{
				{Package: "main", Function: "main", Position: &Position{Filename: "main.go", Line: 10}},
			},
			want: "main.main (main.go:10)",
		},
		{
			name: "three entries",
			trace: []TraceEntry{
				{Package: "main", Function: "main", Position: &Position{Filename: "main.go", Line: 10}},
				{Package: "pkg", Function: "Process"},
				{Package: "lib", Function: "Handle", Position: &Position{Filename: "lib.go", Line: 42}},
			},
			want: "main.main (main.go:10) → pkg.Process → lib.Handle (lib.go:42)",
		},
		{
			name: "more than three entries",
			trace: []TraceEntry{
				{Package: "main", Function: "main"},
				{Package: "pkg1", Function: "Func1"},
				{Package: "pkg2", Function: "Func2"},
				{Package: "pkg3", Function: "Func3"},
				{Package: "pkg4", Function: "Func4"},
			},
			want: "main.main → pkg1.Func1 → pkg2.Func2 ... (2 more)",
		},
		{
			name: "entries without function",
			trace: []TraceEntry{
				{Package: "main", Function: "main"},
				{Package: "pkg", Function: ""},
				{Package: "lib", Function: "Handle"},
			},
			want: "main.main → lib.Handle",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := buildCallstackSummary(tt.trace)
			if got != tt.want {
				t.Errorf("buildCallstackSummary() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestFormatSecurityOutput(t *testing.T) {
	tests := []struct {
		name    string
		result  *SecurityResult
		options FormatOptions
		want    []string // substrings that should be present
	}{
		{
			name: "single critical vulnerability",
			result: &SecurityResult{
				Vulnerabilities: []Vulnerability{
					{
						ID:           "GO-2023-1234",
						Aliases:      []string{"CVE-2023-1234"},
						Summary:      "Critical security issue",
						Severity:     SeverityCritical,
						CVSSScore:    9.8,
						Module:       "github.com/example/vuln",
						FoundVersion: "v1.0.0",
						FixedVersion: "v1.2.3",
						ReferenceURL: "https://pkg.go.dev/vuln/GO-2023-1234",
					},
				},
				BySeverity: map[Severity][]Vulnerability{
					SeverityCritical: {{ID: "GO-2023-1234"}},
				},
				TotalCount: 1,
			},
			options: FormatOptions{MaxVulnerabilities: 20},
			want: []string{
				"Found **1** known vulnerability in dependencies",
				"🔴 Critical",
				"GO-2023-1234",
				"CRITICAL: 9.8",
				"Critical security issue",
				"github.com/example/vuln@v1.0.0",
				"v1.2.3",
				"CVE-2023-1234",
			},
		},
		{
			name: "multiple vulnerabilities with truncation",
			result: &SecurityResult{
				Vulnerabilities: make([]Vulnerability, 25),
				BySeverity: map[Severity][]Vulnerability{
					SeverityHigh: make([]Vulnerability, 25),
				},
				TotalCount: 25,
			},
			options: FormatOptions{MaxVulnerabilities: 20},
			want: []string{
				"Found **25** known vulnerabilities in dependencies",
				"... and 5 more vulnerabilities",
			},
		},
		{
			name:    "empty result",
			result:  &SecurityResult{TotalCount: 0},
			options: FormatOptions{},
			want:    []string{},
		},
		{
			name: "with workflow logs url",
			result: &SecurityResult{
				Vulnerabilities: []Vulnerability{{ID: "GO-2023-1234"}},
				TotalCount:      1,
			},
			options: FormatOptions{
				WorkflowLogsURL: "https://github.com/user/repo/actions/runs/123",
			},
			want: []string{
				"View full scan output",
				"https://github.com/user/repo/actions/runs/123",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := FormatSecurityOutput(tt.result, tt.options)

			if len(tt.want) == 0 && got != "" {
				t.Errorf("FormatSecurityOutput() expected empty output, got %v", got)
				return
			}

			for _, wantSubstr := range tt.want {
				if !strings.Contains(got, wantSubstr) {
					t.Errorf("FormatSecurityOutput() missing substring %q in output:\n%s", wantSubstr, got)
				}
			}
		})
	}
}

func TestCheckFailureThreshold(t *testing.T) {
	tests := []struct {
		name   string
		result *SecurityResult
		failOn Severity
		want   bool
	}{
		{
			name: "critical vulnerability with critical threshold",
			result: &SecurityResult{
				Vulnerabilities: []Vulnerability{
					{Severity: SeverityCritical},
				},
			},
			failOn: SeverityCritical,
			want:   true,
		},
		{
			name: "high vulnerability with critical threshold",
			result: &SecurityResult{
				Vulnerabilities: []Vulnerability{
					{Severity: SeverityHigh},
				},
			},
			failOn: SeverityCritical,
			want:   false,
		},
		{
			name: "high vulnerability with high threshold",
			result: &SecurityResult{
				Vulnerabilities: []Vulnerability{
					{Severity: SeverityHigh},
				},
			},
			failOn: SeverityHigh,
			want:   true,
		},
		{
			name: "medium vulnerability with high threshold",
			result: &SecurityResult{
				Vulnerabilities: []Vulnerability{
					{Severity: SeverityMedium},
				},
			},
			failOn: SeverityHigh,
			want:   false,
		},
		{
			name: "low vulnerability with low threshold",
			result: &SecurityResult{
				Vulnerabilities: []Vulnerability{
					{Severity: SeverityLow},
				},
			},
			failOn: SeverityLow,
			want:   true,
		},
		{
			name: "no threshold set",
			result: &SecurityResult{
				Vulnerabilities: []Vulnerability{
					{Severity: SeverityCritical},
				},
			},
			failOn: "",
			want:   false,
		},
		{
			name: "unknown severity with medium threshold",
			result: &SecurityResult{
				Vulnerabilities: []Vulnerability{
					{Severity: SeverityUnknown},
				},
			},
			failOn: SeverityMedium,
			want:   false,
		},
		{
			name: "multiple vulnerabilities, one exceeds threshold",
			result: &SecurityResult{
				Vulnerabilities: []Vulnerability{
					{Severity: SeverityLow},
					{Severity: SeverityMedium},
					{Severity: SeverityHigh},
				},
			},
			failOn: SeverityHigh,
			want:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CheckFailureThreshold(tt.result, tt.failOn)
			if got != tt.want {
				t.Errorf("CheckFailureThreshold() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestVulnerabilityGrouping(t *testing.T) {
	input := `{"osv":{"id":"GO-2023-1234","aliases":["CVE-2023-1234"],"summary":"Critical vuln","severity":[{"type":"CVSS_V3","score":"9.8"}]}}
{"osv":{"id":"GO-2023-5678","aliases":["CVE-2023-5678"],"summary":"High vuln","severity":[{"type":"CVSS_V3","score":"7.5"}]}}
{"osv":{"id":"GO-2023-9999","aliases":["CVE-2023-9999"],"summary":"Medium vuln","severity":[{"type":"CVSS_V3","score":"5.0"}]}}
{"finding":{"osv":"GO-2023-1234","trace":[{"module":"mod1","version":"v1.0.0","package":"pkg1"}]}}
{"finding":{"osv":"GO-2023-5678","trace":[{"module":"mod2","version":"v1.0.0","package":"pkg2"}]}}
{"finding":{"osv":"GO-2023-9999","trace":[{"module":"mod3","version":"v1.0.0","package":"pkg3"}]}}`

	result, err := ParseGovulncheck(input)
	if err != nil {
		t.Fatalf("ParseGovulncheck() error = %v", err)
	}

	if result.TotalCount != 3 {
		t.Errorf("Expected 3 vulnerabilities, got %d", result.TotalCount)
	}

	if len(result.BySeverity[SeverityCritical]) != 1 {
		t.Errorf("Expected 1 critical vulnerability, got %d", len(result.BySeverity[SeverityCritical]))
	}

	if len(result.BySeverity[SeverityHigh]) != 1 {
		t.Errorf("Expected 1 high vulnerability, got %d", len(result.BySeverity[SeverityHigh]))
	}

	if len(result.BySeverity[SeverityMedium]) != 1 {
		t.Errorf("Expected 1 medium vulnerability, got %d", len(result.BySeverity[SeverityMedium]))
	}
}

func TestVulnerabilitySorting(t *testing.T) {
	input := `{"osv":{"id":"GO-2023-5678","aliases":["CVE-2023-5678"],"summary":"High vuln","severity":[{"type":"CVSS_V3","score":"7.5"}]}}
{"osv":{"id":"GO-2023-1234","aliases":["CVE-2023-1234"],"summary":"Critical vuln","severity":[{"type":"CVSS_V3","score":"9.8"}]}}
{"osv":{"id":"GO-2023-9999","aliases":["CVE-2023-9999"],"summary":"Medium vuln","severity":[{"type":"CVSS_V3","score":"5.0"}]}}
{"finding":{"osv":"GO-2023-5678","trace":[{"module":"mod2","version":"v1.0.0","package":"pkg2"}]}}
{"finding":{"osv":"GO-2023-1234","trace":[{"module":"mod1","version":"v1.0.0","package":"pkg1"}]}}
{"finding":{"osv":"GO-2023-9999","trace":[{"module":"mod3","version":"v1.0.0","package":"pkg3"}]}}`

	result, err := ParseGovulncheck(input)
	if err != nil {
		t.Fatalf("ParseGovulncheck() error = %v", err)
	}

	// Should be sorted by CVSS score (highest first)
	if result.Vulnerabilities[0].CVSSScore != 9.8 {
		t.Errorf("Expected first vulnerability to have CVSS 9.8, got %.1f", result.Vulnerabilities[0].CVSSScore)
	}

	if result.Vulnerabilities[1].CVSSScore != 7.5 {
		t.Errorf("Expected second vulnerability to have CVSS 7.5, got %.1f", result.Vulnerabilities[1].CVSSScore)
	}

	if result.Vulnerabilities[2].CVSSScore != 5.0 {
		t.Errorf("Expected third vulnerability to have CVSS 5.0, got %.1f", result.Vulnerabilities[2].CVSSScore)
	}
}
