package security

import (
	"bufio"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
)

// ParseGovulncheck parses govulncheck JSON output (newline-delimited JSON)
func ParseGovulncheck(jsonOutput string) (*SecurityResult, error) {
	scanner := bufio.NewScanner(strings.NewReader(jsonOutput))

	osvMap := make(map[string]*OSV)
	findingsMap := make(map[string][]*Finding)

	// Parse newline-delimited JSON
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var msg GovulncheckMessage
		if err := json.Unmarshal([]byte(line), &msg); err != nil {
			// Skip malformed JSON lines
			continue
		}

		if msg.OSV != nil {
			osvMap[msg.OSV.ID] = msg.OSV
		}

		if msg.Finding != nil {
			findings := findingsMap[msg.Finding.OSV]
			findings = append(findings, msg.Finding)
			findingsMap[msg.Finding.OSV] = findings
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading input: %w", err)
	}

	// Combine OSV info with findings
	var vulnerabilities []Vulnerability

	for osvID, findings := range findingsMap {
		osv := osvMap[osvID]
		if osv == nil {
			continue
		}

		// Get the first finding for module info
		if len(findings) == 0 || len(findings[0].Trace) == 0 {
			continue
		}

		firstFinding := findings[0]
		moduleInfo := firstFinding.Trace[0]

		// Extract severity and CVSS score
		severity, cvssScore := extractSeverity(osv.Severity)

		// Get reference URL (prefer Go vulnerability database)
		referenceURL := extractReferenceURL(osv, osvID)

		// Build callstack summary from trace
		callstackSummary := buildCallstackSummary(firstFinding.Trace)

		vuln := Vulnerability{
			ID:               osvID,
			Aliases:          osv.Aliases,
			Summary:          osv.Summary,
			Severity:         severity,
			CVSSScore:        cvssScore,
			Module:           moduleInfo.Module,
			FoundVersion:     moduleInfo.Version,
			FixedVersion:     firstFinding.FixedVersion,
			ReferenceURL:     referenceURL,
			CallstackSummary: callstackSummary,
		}

		vulnerabilities = append(vulnerabilities, vuln)
	}

	// Sort by severity (higher CVSS first), then by ID
	sort.Slice(vulnerabilities, func(i, j int) bool {
		if vulnerabilities[i].CVSSScore != vulnerabilities[j].CVSSScore {
			return vulnerabilities[i].CVSSScore > vulnerabilities[j].CVSSScore
		}
		return vulnerabilities[i].ID < vulnerabilities[j].ID
	})

	// Group by severity
	bySeverity := make(map[Severity][]Vulnerability)
	for _, vuln := range vulnerabilities {
		bySeverity[vuln.Severity] = append(bySeverity[vuln.Severity], vuln)
	}

	result := &SecurityResult{
		Vulnerabilities: vulnerabilities,
		BySeverity:      bySeverity,
		TotalCount:      len(vulnerabilities),
		FailsThreshold:  false,
	}

	return result, nil
}

// extractSeverity extracts severity level and CVSS score from severity array
func extractSeverity(severities []SeverityScore) (Severity, float64) {
	var cvssScore float64

	// Look for CVSS_V3 score first
	for _, s := range severities {
		if s.Type == "CVSS_V3" {
			if score, err := strconv.ParseFloat(s.Score, 64); err == nil {
				cvssScore = score
				break
			}
		}
	}

	// Map CVSS score to severity level
	severity := SeverityUnknown
	if cvssScore >= 9.0 {
		severity = SeverityCritical
	} else if cvssScore >= 7.0 {
		severity = SeverityHigh
	} else if cvssScore >= 4.0 {
		severity = SeverityMedium
	} else if cvssScore > 0 {
		severity = SeverityLow
	}

	return severity, cvssScore
}

// extractReferenceURL extracts the best reference URL for a vulnerability
func extractReferenceURL(osv *OSV, osvID string) string {
	// Prefer Go vulnerability database
	for _, ref := range osv.References {
		if strings.Contains(ref.URL, "pkg.go.dev/vuln") {
			return ref.URL
		}
	}

	// Use first available reference
	if len(osv.References) > 0 {
		return osv.References[0].URL
	}

	// Default to pkg.go.dev if ID starts with GO-
	if strings.HasPrefix(osvID, "GO-") {
		return fmt.Sprintf("https://pkg.go.dev/vuln/%s", osvID)
	}

	return ""
}

// buildCallstackSummary builds a human-readable callstack summary
func buildCallstackSummary(trace []TraceEntry) string {
	var callers []string

	for _, t := range trace {
		if t.Function == "" {
			continue
		}

		caller := fmt.Sprintf("%s.%s", t.Package, t.Function)
		if t.Position != nil {
			caller = fmt.Sprintf("%s (%s:%d)", caller, t.Position.Filename, t.Position.Line)
		}
		callers = append(callers, caller)
	}

	if len(callers) == 0 {
		return ""
	}

	// Show up to 3 callers
	if len(callers) <= 3 {
		return strings.Join(callers, " → ")
	}

	summary := strings.Join(callers[:3], " → ")
	summary += fmt.Sprintf(" ... (%d more)", len(callers)-3)
	return summary
}

// FormatSecurityOutput formats the security result as markdown for PR comments
func FormatSecurityOutput(result *SecurityResult, options FormatOptions) string {
	if result.TotalCount == 0 {
		return ""
	}

	var lines []string

	// Summary
	pluralSuffix := "ies"
	if result.TotalCount == 1 {
		pluralSuffix = "y"
	}
	lines = append(lines, fmt.Sprintf("Found **%d** known vulnerabilit%s in dependencies.", result.TotalCount, pluralSuffix))
	lines = append(lines, "")

	// Severity table if we have critical or high severity
	critical := result.BySeverity[SeverityCritical]
	high := result.BySeverity[SeverityHigh]
	medium := result.BySeverity[SeverityMedium]
	low := result.BySeverity[SeverityLow]
	unknown := result.BySeverity[SeverityUnknown]

	if len(critical) > 0 || len(high) > 0 {
		lines = append(lines, "| Severity | Count |")
		lines = append(lines, "|----------|-------|")
		if len(critical) > 0 {
			lines = append(lines, fmt.Sprintf("| 🔴 Critical | %d |", len(critical)))
		}
		if len(high) > 0 {
			lines = append(lines, fmt.Sprintf("| 🟠 High | %d |", len(high)))
		}
		if len(medium) > 0 || len(low) > 0 || len(unknown) > 0 {
			otherCount := len(medium) + len(low) + len(unknown)
			lines = append(lines, fmt.Sprintf("| 🟡 Other | %d |", otherCount))
		}
		lines = append(lines, "")
	}

	// Show vulnerabilities (up to limit)
	maxVulns := options.MaxVulnerabilities
	if maxVulns <= 0 {
		maxVulns = 20
	}

	displayVulns := result.Vulnerabilities
	if len(displayVulns) > maxVulns {
		displayVulns = displayVulns[:maxVulns]
	}

	for i, vuln := range displayVulns {
		lines = append(lines, formatVulnerability(vuln, i))
		lines = append(lines, "")
		lines = append(lines, "---")
		lines = append(lines, "")
	}

	// Truncation notice
	if result.TotalCount > maxVulns {
		lines = append(lines, fmt.Sprintf("*... and %d more vulnerabilities. See workflow logs for complete list.*", result.TotalCount-maxVulns))
		lines = append(lines, "")
	}

	// Remediation hint
	lines = append(lines, "**💡 To fix:** Run `go get -u` to update dependencies, or pin to a specific fixed version.")

	// Workflow logs link
	if options.WorkflowLogsURL != "" {
		lines = append(lines, "")
		lines = append(lines, fmt.Sprintf("📋 [View full scan output](%s)", options.WorkflowLogsURL))
	}

	return strings.Join(lines, "\n")
}

// formatVulnerability formats a single vulnerability as markdown
func formatVulnerability(vuln Vulnerability, index int) string {
	var lines []string

	// Header with ID and severity
	header := fmt.Sprintf("#### %d. %s", index+1, vuln.ID)
	if vuln.CVSSScore > 0 {
		header += fmt.Sprintf(" (%s: %.1f)", vuln.Severity, vuln.CVSSScore)
	} else if vuln.Severity != SeverityUnknown {
		header += fmt.Sprintf(" (%s)", vuln.Severity)
	}
	lines = append(lines, header)
	lines = append(lines, "")

	// Summary
	lines = append(lines, fmt.Sprintf("**%s**", vuln.Summary))
	lines = append(lines, "")

	// Module info
	lines = append(lines, fmt.Sprintf("- **Module:** `%s@%s`", vuln.Module, vuln.FoundVersion))
	if vuln.FixedVersion != "" {
		lines = append(lines, fmt.Sprintf("- **Fixed in:** `%s`", vuln.FixedVersion))
	}

	// Aliases (CVEs)
	if len(vuln.Aliases) > 0 {
		lines = append(lines, fmt.Sprintf("- **CVE:** %s", strings.Join(vuln.Aliases, ", ")))
	}

	// Reference link
	if vuln.ReferenceURL != "" {
		lines = append(lines, fmt.Sprintf("- **Details:** [%s](%s)", vuln.ID, vuln.ReferenceURL))
	}

	// Callstack if available
	if vuln.CallstackSummary != "" {
		lines = append(lines, "")
		lines = append(lines, "<details><summary>Call stack</summary>")
		lines = append(lines, "")
		lines = append(lines, "```")
		lines = append(lines, vuln.CallstackSummary)
		lines = append(lines, "```")
		lines = append(lines, "</details>")
	}

	return strings.Join(lines, "\n")
}

// CheckFailureThreshold determines if the result fails the severity threshold
func CheckFailureThreshold(result *SecurityResult, failOn Severity) bool {
	if failOn == "" {
		// No threshold set, never fail
		return false
	}

	// Define severity hierarchy
	severityLevels := map[Severity]int{
		SeverityCritical: 4,
		SeverityHigh:     3,
		SeverityMedium:   2,
		SeverityLow:      1,
		SeverityUnknown:  0,
	}

	thresholdLevel := severityLevels[failOn]

	// Check if any vulnerability meets or exceeds the threshold
	for _, vuln := range result.Vulnerabilities {
		if severityLevels[vuln.Severity] >= thresholdLevel {
			return true
		}
	}

	return false
}
