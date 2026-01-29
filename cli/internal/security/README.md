# Security Package

Go implementation of the security formatter for parsing and formatting `govulncheck` output.

## Overview

This package provides functionality to:
- Parse `govulncheck` JSON output (newline-delimited JSON format)
- Group vulnerabilities by severity (Critical, High, Medium, Low)
- Format security scan results as markdown for PR comments
- Support severity threshold filtering (fail-on behavior)

## Usage

### Parsing govulncheck Output

```go
import "github.com/jrschumacher/go-actions/cli/internal/security"

// Parse govulncheck JSON output
result, err := security.ParseGovulncheck(jsonOutput)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Found %d vulnerabilities\n", result.TotalCount)
```

### Formatting for PR Comments

```go
options := security.FormatOptions{
    MaxVulnerabilities: 20,
    WorkflowLogsURL:    "https://github.com/user/repo/actions/runs/123",
}

markdown := security.FormatSecurityOutput(result, options)
// markdown now contains formatted output suitable for GitHub PR comments
```

### Checking Severity Thresholds

```go
// Check if any vulnerability meets or exceeds HIGH severity
if security.CheckFailureThreshold(result, security.SeverityHigh) {
    fmt.Println("Found high or critical severity vulnerabilities")
    os.Exit(1)
}
```

## Data Structures

### Severity Levels

```go
const (
    SeverityCritical Severity = "CRITICAL" // CVSS >= 9.0
    SeverityHigh     Severity = "HIGH"     // CVSS >= 7.0
    SeverityMedium   Severity = "MEDIUM"   // CVSS >= 4.0
    SeverityLow      Severity = "LOW"      // CVSS > 0
    SeverityUnknown  Severity = "UNKNOWN"  // No CVSS score
)
```

### Vulnerability Structure

```go
type Vulnerability struct {
    ID               string   // OSV ID (e.g., GO-2023-1234)
    Aliases          []string // CVE IDs
    Summary          string   // Vulnerability description
    Severity         Severity // Severity level
    CVSSScore        float64  // CVSS v3 score
    Module           string   // Affected Go module
    FoundVersion     string   // Vulnerable version found
    FixedVersion     string   // Version with fix
    ReferenceURL     string   // Documentation URL
    CallstackSummary string   // Call trace summary
}
```

### Security Result

```go
type SecurityResult struct {
    Vulnerabilities []Vulnerability
    BySeverity      map[Severity][]Vulnerability
    TotalCount      int
    FailsThreshold  bool
}
```

## Govulncheck JSON Format

The package expects newline-delimited JSON from `govulncheck -json`:

```json
{"osv":{"id":"GO-2023-1234","aliases":["CVE-2023-1234"],"summary":"...","severity":[{"type":"CVSS_V3","score":"9.8"}]}}
{"finding":{"osv":"GO-2023-1234","fixed_version":"v1.2.3","trace":[...]}}
```

Key message types:
- `config`: Scanner configuration (ignored)
- `progress`: Scan progress messages (ignored)
- `osv`: Vulnerability information from Open Source Vulnerabilities database
- `finding`: Finding with module info and call trace

## Features

### CVSS Scoring
- Automatically extracts CVSS v3 scores from vulnerability data
- Maps scores to severity levels (Critical, High, Medium, Low)
- Sorts vulnerabilities by CVSS score (highest first)

### Call Stack Tracing
- Parses call traces to show affected code paths
- Includes file locations and line numbers when available
- Summarizes call stacks (shows first 3 calls, indicates if more)

### Markdown Formatting
- Generates GitHub-flavored markdown for PR comments
- Groups vulnerabilities by severity with counts
- Includes collapsible call stack details
- Provides links to Go vulnerability database
- Truncates large outputs with configurable limits

### Severity Thresholds
- Support for fail-on severity levels (e.g., fail on HIGH or above)
- Hierarchical severity checking (HIGH threshold catches CRITICAL too)
- Flexible threshold configuration

## Testing

The package includes comprehensive tests with >90% coverage:

```bash
go test ./internal/security/...
go test -cover ./internal/security/...
```

Test coverage includes:
- Parsing various govulncheck output formats
- Severity extraction and CVSS scoring
- Reference URL extraction
- Call stack building
- Markdown formatting
- Threshold checking
- Vulnerability grouping and sorting

## Examples

See `example_test.go` for runnable examples:

```bash
go test -v -run Example ./internal/security/...
```
