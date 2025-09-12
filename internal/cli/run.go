package cli

import (
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/spf13/cobra"
	"github.com/jrschumacher/go-actions/internal/detect"
)

var runCmd = &cobra.Command{
	Use:   "run <job1,job2,...>",
	Short: "Run CI jobs locally",
	Long: `Run the same jobs that would execute in GitHub Actions locally.

This allows you to test your CI pipeline before pushing to GitHub.

Available jobs:
  test       - Run go test
  lint       - Run golangci-lint
  benchmark  - Run go test -bench

Examples:
  go-actions run test               # Run tests only
  go-actions run test,lint          # Run tests and linting
  go-actions run test,lint,benchmark # Run all jobs`,
	Args: cobra.ExactArgs(1),
	RunE: runJobs,
}

func runJobs(cmd *cobra.Command, args []string) error {
	// Parse jobs from comma-separated string
	jobsStr := args[0]
	jobs := strings.Split(jobsStr, ",")

	// Trim whitespace
	for i, job := range jobs {
		jobs[i] = strings.TrimSpace(job)
	}

	// Validate jobs
	validJobs := map[string]bool{
		"test":      true,
		"lint":      true,
		"benchmark": true,
	}

	for _, job := range jobs {
		if !validJobs[job] {
			return fmt.Errorf("invalid job: %s. Valid jobs are: test, lint, benchmark", job)
		}
	}

	// Detect project configuration
	config, err := detect.DetectProject(".")
	if err != nil {
		return fmt.Errorf("failed to detect project: %w", err)
	}

	// Run each job
	for _, job := range jobs {
		fmt.Printf("🚀 Running job: %s\n", job)
		
		if err := executeJob(job, config); err != nil {
			return fmt.Errorf("job '%s' failed: %w", job, err)
		}
		
		fmt.Printf("✅ Job '%s' completed successfully\n\n", job)
	}

	fmt.Println("🎉 All jobs completed successfully!")
	return nil
}

func executeJob(job string, config *detect.ProjectConfig) error {
	switch job {
	case "test":
		return runTests(config)
	case "lint":
		return runLint(config)
	case "benchmark":
		return runBenchmarks(config)
	default:
		return fmt.Errorf("unknown job: %s", job)
	}
}

func runTests(config *detect.ProjectConfig) error {
	if !config.HasTests {
		fmt.Println("ℹ️ No test files found, skipping tests")
		return nil
	}

	fmt.Println("Running: go test -v -race ./...")
	
	cmd := exec.Command("go", "test", "-v", "-race", "./...")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	
	return cmd.Run()
}

func runLint(config *detect.ProjectConfig) error {
	// Check if golangci-lint is available
	if !commandExists("golangci-lint") {
		return fmt.Errorf("golangci-lint not found. Install it with: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest")
	}

	args := []string{"run"}
	
	// Add config file if it exists
	if config.HasLintConfig {
		args = append(args, "-c", config.LintConfigPath)
	}

	fmt.Printf("Running: golangci-lint %s\n", strings.Join(args, " "))
	
	cmd := exec.Command("golangci-lint", args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	
	return cmd.Run()
}

func runBenchmarks(config *detect.ProjectConfig) error {
	if !config.HasBenchmarks {
		fmt.Println("ℹ️ No benchmark functions found, skipping benchmarks")
		return nil
	}

	fmt.Println("Running: go test -bench=. -benchmem ./...")
	
	cmd := exec.Command("go", "test", "-bench=.", "-benchmem", "./...")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	
	return cmd.Run()
}

func commandExists(name string) bool {
	cmd := exec.Command("which", name)
	return cmd.Run() == nil
}