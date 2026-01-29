package output

import (
	"encoding/json"
	"fmt"
	"io"
	"time"
)

// CheckResult represents the result of a single check
type CheckResult struct {
	Name          string        `json:"name"`
	Status        string        `json:"status"` // pass, fail, error, skip
	Duration      time.Duration `json:"duration"`
	Issues        int           `json:"issues,omitempty"`
	Coverage      float64       `json:"coverage,omitempty"`
	Threshold     float64       `json:"threshold,omitempty"`
	Vulnerabilities int         `json:"vulnerabilities,omitempty"`
	Message       string        `json:"message,omitempty"`
}

// Results represents all check results
type Results struct {
	Checks []CheckResult `json:"checks"`
	Total  time.Duration `json:"total_duration"`
	Status string        `json:"status"` // pass, fail, error
}

// Formatter handles output formatting
type Formatter struct {
	format string
	writer io.Writer
}

// NewFormatter creates a new formatter
func NewFormatter(format string, w io.Writer) *Formatter {
	return &Formatter{
		format: format,
		writer: w,
	}
}

// PrintResults outputs the results in the configured format
func (f *Formatter) PrintResults(results *Results) error {
	switch f.format {
	case "json":
		return f.printJSON(results)
	default:
		return f.printText(results)
	}
}

func (f *Formatter) printJSON(results *Results) error {
	encoder := json.NewEncoder(f.writer)
	encoder.SetIndent("", "  ")
	return encoder.Encode(results)
}

func (f *Formatter) printText(results *Results) error {
	for _, check := range results.Checks {
		symbol := getStatusSymbol(check.Status)
		duration := fmt.Sprintf("(%.1fs)", check.Duration.Seconds())

		line := fmt.Sprintf("%s %-8s %s", symbol, check.Name, duration)

		// Add check-specific details
		switch check.Name {
		case "test":
			if check.Coverage > 0 {
				line += fmt.Sprintf(" - %.1f%% coverage", check.Coverage)
				if check.Threshold > 0 {
					line += fmt.Sprintf(" (threshold: %.0f%%)", check.Threshold)
				}
			}
		case "lint":
			if check.Issues >= 0 {
				line += fmt.Sprintf(" - %d issues", check.Issues)
			}
		case "security":
			if check.Vulnerabilities >= 0 {
				line += fmt.Sprintf(" - %d vulnerabilities", check.Vulnerabilities)
			}
		}

		if check.Message != "" {
			line += " - " + check.Message
		}

		_, _ = fmt.Fprintln(f.writer, line)
	}

	_, _ = fmt.Fprintln(f.writer)

	switch results.Status {
	case "pass":
		_, _ = fmt.Fprintln(f.writer, "All checks passed. Safe to push.")
	case "fail":
		_, _ = fmt.Fprintln(f.writer, "Some checks failed. Please fix the issues.")
	case "error":
		_, _ = fmt.Fprintln(f.writer, "Some checks encountered errors.")
	}

	return nil
}

func getStatusSymbol(status string) string {
	switch status {
	case "pass":
		return "✓"
	case "fail":
		return "✗"
	case "error":
		return "⚠"
	case "skip":
		return "○"
	default:
		return "?"
	}
}

// PrintProgress outputs a progress message
func (f *Formatter) PrintProgress(checks []string) {
	if f.format == "json" {
		return // Skip progress messages in JSON mode
	}

	_, _ = fmt.Fprintf(f.writer, "Running: %s\n\n", joinChecks(checks))
}

func joinChecks(checks []string) string {
	if len(checks) == 0 {
		return ""
	}
	if len(checks) == 1 {
		return checks[0]
	}

	result := checks[0]
	for i := 1; i < len(checks)-1; i++ {
		result += ", " + checks[i]
	}
	result += " and " + checks[len(checks)-1]

	return result
}
