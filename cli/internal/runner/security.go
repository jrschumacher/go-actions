package runner

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
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
	argsJSON = append([]string{"-json"}, argsJSON...)

	cmdJSON := exec.Command("govulncheck", argsJSON...)
	var stdoutJSON, stderrJSON bytes.Buffer
	cmdJSON.Stdout = &stdoutJSON
	cmdJSON.Stderr = &stderrJSON

	err := cmdJSON.Run()

	// Save JSON output to file for GitHub Actions formatter
	if writeErr := os.WriteFile("govulncheck-report.json", stdoutJSON.Bytes(), 0644); writeErr != nil {
		fmt.Fprintf(os.Stderr, "Warning: failed to save govulncheck JSON report: %v\n", writeErr)
	}

	// Also run with text output for GitHub Actions formatter
	argsText := strings.Fields(r.cfg.CI.Security.Args)
	if len(argsText) == 0 {
		argsText = []string{"./..."}
	}

	cmdText := exec.Command("govulncheck", argsText...)
	var stdoutText bytes.Buffer
	cmdText.Stdout = &stdoutText
	cmdText.Stderr = &stdoutText

	textErr := cmdText.Run()
	if writeErr := os.WriteFile("govulncheck-output.txt", stdoutText.Bytes(), 0644); writeErr != nil {
		fmt.Fprintf(os.Stderr, "Warning: failed to save govulncheck text report: %v\n", writeErr)
	}

	// Scanner failures must never be interpreted as a clean scan. Preserve both
	// diagnostics because the text invocation can explain an otherwise empty report.
	result.Output = strings.TrimSpace(stderrJSON.String() + "\n" + stdoutText.String())
	if err != nil {
		result.Status = "error"
		result.Message = "security JSON scan failed"
		return result, fmt.Errorf("govulncheck JSON scan failed: %w", err)
	}
	vulns, parseErr := parseSecurityOutput(stdoutJSON.Bytes())
	if parseErr != nil {
		result.Status = "error"
		result.Message = "invalid security JSON report"
		return result, parseErr
	}
	// Text mode uses exit code 3 to signal findings, rather than a scanner error.
	textFindings := false
	if exitErr, ok := textErr.(*exec.ExitError); ok {
		textFindings = exitErr.ExitCode() == 3 && len(vulns) > 0
	}
	if textErr != nil && !textFindings {
		result.Status = "error"
		result.Message = "security text scan failed"
		return result, fmt.Errorf("govulncheck text scan failed: %w", textErr)
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
	// govulncheck emits a stream of JSON objects, which may span multiple lines.
	decoder := json.NewDecoder(bytes.NewReader(data))
	var vulns []vulnerability
	messages := 0
	for {
		var entry map[string]json.RawMessage
		err := decoder.Decode(&entry)
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("parse govulncheck JSON: %w", err)
		}
		recognized := false
		for _, key := range []string{"config", "progress", "osv", "finding", "SBOM"} {
			if value, ok := entry[key]; ok && len(value) > 0 && string(value) != "null" {
				recognized = true
			}
		}
		if !recognized {
			return nil, fmt.Errorf("unrecognized govulncheck JSON message")
		}
		messages++
		if finding, ok := entry["finding"]; ok {
			var fields struct {
				OSV json.RawMessage `json:"osv"`
			}
			if err := json.Unmarshal(finding, &fields); err != nil {
				return nil, fmt.Errorf("parse govulncheck finding: %w", err)
			}
			var vuln vulnerability
			if err := json.Unmarshal(fields.OSV, &vuln.OSV.ID); err != nil {
				// Retain compatibility with reports containing embedded OSV objects.
				if err := json.Unmarshal(finding, &vuln); err != nil {
					return nil, fmt.Errorf("parse govulncheck finding: %w", err)
				}
			}
			if vuln.OSV.ID == "" {
				return nil, fmt.Errorf("govulncheck finding is missing an OSV ID")
			}
			vulns = append(vulns, vuln)
		}
	}
	if messages == 0 {
		return nil, fmt.Errorf("govulncheck returned an empty JSON report")
	}
	return vulns, nil
}
