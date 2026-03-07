package runner

import (
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jrschumacher/go-actions/cli/internal/output"
)

// RunTest runs go test with coverage
func (r *Runner) RunTest() (output.CheckResult, error) {
	result := output.CheckResult{
		Name:   "test",
		Status: "pass",
	}

	start := time.Now()
	defer func() {
		result.Duration = time.Since(start)
	}()

	// Check if go is installed
	if err := checkToolInstalled("go"); err != nil {
		return result, err
	}

	// Build test command
	args := strings.Fields(r.cfg.CI.Test.Args)
	if len(args) == 0 {
		args = []string{"-v", "-race", "./..."}
	}

	// Add coverage if enabled
	if r.cfg.CI.Test.Coverage.Enabled != nil && *r.cfg.CI.Test.Coverage.Enabled {
		// Check if -coverprofile is already in args
		hasCoverProfile := false
		for _, arg := range args {
			if strings.HasPrefix(arg, "-coverprofile") {
				hasCoverProfile = true
				break
			}
		}
		if !hasCoverProfile {
			args = append(args, "-coverprofile=coverage.out")
		}
	}

	cmd := exec.Command("go", append([]string{"test"}, args...)...)
	output_bytes, err := cmd.CombinedOutput()
	outputStr := string(output_bytes)

	if err != nil {
		result.Status = "fail"
		result.Message = "tests failed"
		result.Output = outputStr
		return result, nil
	}

	// Extract coverage if enabled
	if r.cfg.CI.Test.Coverage.Enabled != nil && *r.cfg.CI.Test.Coverage.Enabled {
		coverage, err := extractCoverage(outputStr)
		if err == nil {
			result.Coverage = coverage
			result.Threshold = r.cfg.CI.Test.Coverage.Threshold

			// Check threshold
			if coverage < r.cfg.CI.Test.Coverage.Threshold {
				result.Status = "fail"
				result.Message = fmt.Sprintf("coverage %.1f%% below threshold %.0f%%",
					coverage, r.cfg.CI.Test.Coverage.Threshold)
			}
		}
	}

	return result, nil
}

// extractCoverage parses coverage percentage from go test output
func extractCoverage(output string) (float64, error) {
	// Match patterns like "coverage: 85.2% of statements"
	re := regexp.MustCompile(`coverage:\s+([\d.]+)%`)
	matches := re.FindStringSubmatch(output)

	if len(matches) < 2 {
		return 0, fmt.Errorf("coverage not found in output")
	}

	coverage, err := strconv.ParseFloat(matches[1], 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse coverage: %w", err)
	}

	return coverage, nil
}
