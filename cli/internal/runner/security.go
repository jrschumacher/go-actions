package runner

import (
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/jrschumacher/go-actions/cli/internal/output"
)

// RunSecurity runs govulncheck
func (r *Runner) RunSecurity() (output.CheckResult, error) {
	result := output.CheckResult{
		Name:   "security",
		Status: "pass",
	}

	start := time.Now()
	defer func() {
		result.Duration = time.Since(start)
	}()

	// Check if govulncheck is installed
	if err := checkToolInstalled("govulncheck"); err != nil {
		return result, err
	}

	// Build security command for JSON output
	argsJSON := strings.Fields(r.cfg.CI.Security.Args)
	if len(argsJSON) == 0 {
		argsJSON = []string{"./..."}
	}
	argsJSON = append(argsJSON, "-json")

	cmdJSON := exec.Command("govulncheck", argsJSON...)
	var stdoutJSON, stderrJSON bytes.Buffer
	cmdJSON.Stdout = &stdoutJSON
	cmdJSON.Stderr = &stderrJSON

	err := cmdJSON.Run()

	// Save JSON output to file for GitHub Actions formatter (ignore write errors)
	_ = os.WriteFile("govulncheck-report.json", stdoutJSON.Bytes(), 0644)

	// Also run with text output for GitHub Actions formatter
	argsText := strings.Fields(r.cfg.CI.Security.Args)
	if len(argsText) == 0 {
		argsText = []string{"./..."}
	}

	cmdText := exec.Command("govulncheck", argsText...)
	var stdoutText bytes.Buffer
	cmdText.Stdout = &stdoutText
	cmdText.Stderr = &stdoutText

	_ = cmdText.Run() // Ignore error, we have JSON output
	_ = os.WriteFile("govulncheck-output.txt", stdoutText.Bytes(), 0644)

	// Parse JSON output
	vulns, parseErr := parseSecurityOutput(stdoutJSON.Bytes())
	if parseErr != nil {
		result.Vulnerabilities = 0
		if err != nil {
			result.Status = "error"
			result.Message = "security check failed"
		}
		return result, parseErr
	}

	result.Vulnerabilities = len(vulns)

	if len(vulns) > 0 {
		result.Status = "fail"
		result.Message = "vulnerabilities detected"
	}

	return result, nil
}

// vulnerability represents a govulncheck vulnerability
type vulnerability struct {
	OSV struct {
		ID       string `json:"id"`
		Summary  string `json:"summary"`
		Severity string `json:"severity,omitempty"`
	} `json:"osv"`
}

func parseSecurityOutput(data []byte) ([]vulnerability, error) {
	if len(data) == 0 {
		return []vulnerability{}, nil
	}

	// govulncheck outputs newline-delimited JSON
	lines := bytes.Split(data, []byte("\n"))
	var vulns []vulnerability

	for _, line := range lines {
		if len(line) == 0 {
			continue
		}

		var entry struct {
			Finding *vulnerability `json:"finding,omitempty"`
		}

		if err := json.Unmarshal(line, &entry); err != nil {
			continue // Skip malformed lines
		}

		if entry.Finding != nil {
			vulns = append(vulns, *entry.Finding)
		}
	}

	return vulns, nil
}
