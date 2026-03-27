package runner

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/jrschumacher/go-actions/cli/internal/output"
)

// RunLint runs golangci-lint
func (r *Runner) RunLint() (output.CheckResult, error) {
	result := output.CheckResult{
		Name:   "lint",
		Status: "pass",
	}

	start := time.Now()
	defer func() {
		result.Duration = time.Since(start)
	}()

	// Check if golangci-lint is installed
	if err := checkToolInstalled("golangci-lint"); err != nil {
		return result, err
	}

	// Build lint command
	args := strings.Fields(r.cfg.CI.Lint.Args)
	if len(args) == 0 {
		args = []string{"run", "./..."}
	}

	// Add JSON output for parsing (golangci-lint v2.1+ format)
	args = append(args, "--output.json.path", "stdout")

	cmd := exec.Command("golangci-lint", args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	// Save raw output to file for GitHub Actions formatter
	if writeErr := os.WriteFile("golangci-lint-report.json", stdout.Bytes(), 0644); writeErr != nil {
		fmt.Fprintf(os.Stderr, "Warning: failed to save golangci-lint report: %v\n", writeErr)
	}

	// If command failed and produced no stdout, this is a tool-level error
	// (e.g. config errors, installation issues). Surface stderr directly.
	if err != nil && stdout.Len() == 0 {
		result.Status = "error"
		result.Message = "golangci-lint failed"
		if stderrStr := strings.TrimSpace(stderr.String()); stderrStr != "" {
			result.Output = stderrStr
		} else {
			result.Output = err.Error()
		}
		return result, nil
	}

	// Parse JSON output
	issues, parseErr := parseLintOutput(stdout.Bytes())
	if parseErr != nil {
		result.Issues = 0
		result.Status = "error"
		result.Message = "failed to parse lint output"
		if stderrStr := strings.TrimSpace(stderr.String()); stderrStr != "" {
			result.Output = stderrStr
		} else {
			result.Output = parseErr.Error()
		}
		return result, nil
	}

	result.Issues = len(issues)

	if err != nil {
		result.Status = "fail"
		result.Message = "linter found issues"
	}

	// Include issue details in output for display
	if len(issues) > 0 {
		result.Output = formatLintIssues(issues)
	}

	return result, nil
}

// lintIssue represents a golangci-lint issue
type lintIssue struct {
	FromLinter string `json:"FromLinter"`
	Text       string `json:"Text"`
	Pos        struct {
		Filename string `json:"Filename"`
		Line     int    `json:"Line"`
		Column   int    `json:"Column"`
	} `json:"Pos"`
}

// lintReport represents golangci-lint JSON output
type lintReport struct {
	Issues []lintIssue `json:"Issues"`
}

func formatLintIssues(issues []lintIssue) string {
	var buf bytes.Buffer
	for _, issue := range issues {
		fmt.Fprintf(&buf, "  %s:%d:%d: %s (%s)\n",
			issue.Pos.Filename, issue.Pos.Line, issue.Pos.Column,
			issue.Text, issue.FromLinter)
	}
	return strings.TrimRight(buf.String(), "\n")
}

func parseLintOutput(data []byte) ([]lintIssue, error) {
	if len(data) == 0 {
		return []lintIssue{}, nil
	}

	// golangci-lint v2.1+ outputs JSON on first line, then text summary
	// Extract only the first line (the JSON)
	lines := bytes.SplitN(data, []byte("\n"), 2)
	jsonData := lines[0]

	if len(jsonData) == 0 {
		return []lintIssue{}, nil
	}

	var report lintReport
	if err := json.Unmarshal(jsonData, &report); err != nil {
		return nil, fmt.Errorf("failed to parse lint output: %w", err)
	}

	return report.Issues, nil
}
