package security_test

import (
	"fmt"

	"github.com/jrschumacher/go-actions/cli/internal/security"
)

func ExampleParseGovulncheck() {
	// Example govulncheck JSON output (newline-delimited JSON)
	jsonOutput := `{"osv":{"id":"GO-2023-1234","aliases":["CVE-2023-1234"],"summary":"SQL injection vulnerability","severity":[{"type":"CVSS_V3","score":"9.8"}]}}
{"finding":{"osv":"GO-2023-1234","fixed_version":"v1.2.3","trace":[{"module":"github.com/example/database","version":"v1.0.0","package":"github.com/example/database","function":"Query","position":{"filename":"db.go","line":42,"column":10}}]}}`

	result, err := security.ParseGovulncheck(jsonOutput)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		return
	}

	fmt.Printf("Found %d vulnerabilities\n", result.TotalCount)
	fmt.Printf("Critical: %d\n", len(result.BySeverity[security.SeverityCritical]))
	// Output:
	// Found 1 vulnerabilities
	// Critical: 1
}

func ExampleFormatSecurityOutput() {
	// Create a sample security result
	result := &security.SecurityResult{
		Vulnerabilities: []security.Vulnerability{
			{
				ID:           "GO-2023-1234",
				Aliases:      []string{"CVE-2023-1234"},
				Summary:      "SQL injection vulnerability",
				Severity:     security.SeverityCritical,
				CVSSScore:    9.8,
				Module:       "github.com/example/database",
				FoundVersion: "v1.0.0",
				FixedVersion: "v1.2.3",
				ReferenceURL: "https://pkg.go.dev/vuln/GO-2023-1234",
			},
		},
		BySeverity: map[security.Severity][]security.Vulnerability{
			security.SeverityCritical: {{ID: "GO-2023-1234"}},
		},
		TotalCount: 1,
	}

	options := security.FormatOptions{
		MaxVulnerabilities: 20,
		WorkflowLogsURL:    "https://github.com/user/repo/actions/runs/123",
	}

	markdown := security.FormatSecurityOutput(result, options)
	fmt.Println(len(markdown) > 0) // Output should contain markdown
	// Output:
	// true
}

func ExampleCheckFailureThreshold() {
	result := &security.SecurityResult{
		Vulnerabilities: []security.Vulnerability{
			{Severity: security.SeverityHigh},
			{Severity: security.SeverityMedium},
		},
	}

	// Check if we should fail on HIGH severity
	failsHigh := security.CheckFailureThreshold(result, security.SeverityHigh)
	fmt.Printf("Fails HIGH threshold: %v\n", failsHigh)

	// Check if we should fail on CRITICAL severity
	failsCritical := security.CheckFailureThreshold(result, security.SeverityCritical)
	fmt.Printf("Fails CRITICAL threshold: %v\n", failsCritical)

	// Output:
	// Fails HIGH threshold: true
	// Fails CRITICAL threshold: false
}
