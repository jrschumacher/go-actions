package runner

import (
	"fmt"
	"os/exec"
	"time"

	"github.com/jrschumacher/go-actions/cli/internal/config"
	"github.com/jrschumacher/go-actions/cli/internal/output"
)

// Runner executes checks based on configuration
type Runner struct {
	cfg *config.Config
}

// New creates a new runner
func New(cfg *config.Config) *Runner {
	return &Runner{cfg: cfg}
}

// RunAll runs all enabled checks
func (r *Runner) RunAll() (*output.Results, error) {
	results := &output.Results{
		Checks: []output.CheckResult{},
		Status: "pass",
	}

	start := time.Now()

	// Determine which checks to run
	checks := r.getEnabledChecks()

	for _, checkName := range checks {
		var result output.CheckResult
		var err error

		switch checkName {
		case "test":
			result, err = r.RunTest()
		case "lint":
			result, err = r.RunLint()
		case "security":
			result, err = r.RunSecurity()
		case "benchmark":
			result, err = r.RunBenchmark()
		default:
			continue
		}

		if err != nil {
			result.Status = "error"
			result.Message = err.Error()
		}

		results.Checks = append(results.Checks, result)

		// Update overall status
		if result.Status == "fail" || result.Status == "error" {
			results.Status = "fail"
		}
	}

	results.Total = time.Since(start)

	return results, nil
}

// RunCheck runs a specific check by name
func (r *Runner) RunCheck(name string) (*output.Results, error) {
	results := &output.Results{
		Checks: []output.CheckResult{},
		Status: "pass",
	}

	start := time.Now()

	var result output.CheckResult
	var err error

	switch name {
	case "test":
		result, err = r.RunTest()
	case "lint":
		result, err = r.RunLint()
	case "security":
		result, err = r.RunSecurity()
	case "benchmark":
		result, err = r.RunBenchmark()
	default:
		return nil, fmt.Errorf("unknown check: %s", name)
	}

	if err != nil {
		result.Status = "error"
		result.Message = err.Error()
	}

	results.Checks = append(results.Checks, result)

	if result.Status == "fail" || result.Status == "error" {
		results.Status = "fail"
	}

	results.Total = time.Since(start)

	return results, nil
}

func (r *Runner) getEnabledChecks() []string {
	var checks []string

	if r.cfg.CI.Test.Enabled != nil && *r.cfg.CI.Test.Enabled {
		checks = append(checks, "test")
	}
	if r.cfg.CI.Lint.Enabled {
		checks = append(checks, "lint")
	}
	if r.cfg.CI.Security.Enabled {
		checks = append(checks, "security")
	}
	if r.cfg.CI.Benchmark.Enabled {
		checks = append(checks, "benchmark")
	}

	return checks
}

// checkToolInstalled checks if a command is available in PATH
func checkToolInstalled(tool string) error {
	_, err := exec.LookPath(tool)
	if err != nil {
		return fmt.Errorf("%s is not installed or not in PATH", tool)
	}
	return nil
}
