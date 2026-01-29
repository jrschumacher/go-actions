package cmd

import (
	"fmt"
	"os"

	"github.com/jrschumacher/go-actions/cli/internal/config"
	"github.com/jrschumacher/go-actions/cli/internal/output"
	"github.com/jrschumacher/go-actions/cli/internal/runner"
	"github.com/spf13/cobra"
)

var (
	formatFlag string
)

var checkCmd = &cobra.Command{
	Use:   "check [check-name]",
	Short: "Run CI checks locally",
	Long: `Run one or more CI checks locally.

Available checks:
  lint     - Run golangci-lint
  test     - Run tests with coverage
  security - Run govulncheck
  benchmark - Run benchmarks

If no check name is specified, all enabled checks will run.`,
	Args: cobra.MaximumNArgs(1),
	RunE: runCheck,
}

func init() {
	rootCmd.AddCommand(checkCmd)
	checkCmd.Flags().StringVar(&formatFlag, "format", "auto", "output format (auto, json, text)")
}

func runCheck(cmd *cobra.Command, args []string) error {
	// Load config
	configPath := cfgFile
	if configPath == "" {
		var err error
		configPath, err = config.FindConfigFile()
		if err != nil {
			return fmt.Errorf("failed to find config file: %w", err)
		}
	}

	cfg, err := config.Load(configPath)
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Determine output format
	format := formatFlag
	if format == "auto" {
		if cfg.Output.Format != "" && cfg.Output.Format != "auto" {
			format = cfg.Output.Format
		} else {
			format = "text"
		}
	}

	// Create formatter
	formatter := output.NewFormatter(format, os.Stdout)

	// Create runner
	r := runner.New(cfg)

	// Run checks
	var results *output.Results
	if len(args) == 0 {
		// Run all enabled checks
		checks := getEnabledCheckNames(cfg)
		if len(checks) == 0 {
			fmt.Fprintln(os.Stderr, "No checks enabled in configuration")
			return nil
		}

		formatter.PrintProgress(checks)
		results, err = r.RunAll()
	} else {
		// Run specific check
		checkName := args[0]

		// Validate check name
		validChecks := map[string]bool{
			"lint":      true,
			"test":      true,
			"security":  true,
			"benchmark": true,
		}

		if !validChecks[checkName] {
			return fmt.Errorf("unknown check: %s (valid: lint, test, security, benchmark)", checkName)
		}

		formatter.PrintProgress([]string{checkName})
		results, err = r.RunCheck(checkName)
	}

	if err != nil {
		return fmt.Errorf("failed to run checks: %w", err)
	}

	// Print results
	if err := formatter.PrintResults(results); err != nil {
		return fmt.Errorf("failed to format results: %w", err)
	}

	// Exit with appropriate code
	switch results.Status {
	case "pass":
		return nil
	case "fail":
		os.Exit(1)
	default:
		os.Exit(2)
	}

	return nil
}

func getEnabledCheckNames(cfg *config.Config) []string {
	var checks []string

	if cfg.CI.Test.Enabled != nil && *cfg.CI.Test.Enabled {
		checks = append(checks, "test")
	}
	if cfg.CI.Lint.Enabled {
		checks = append(checks, "lint")
	}
	if cfg.CI.Security.Enabled {
		checks = append(checks, "security")
	}
	if cfg.CI.Benchmark.Enabled {
		checks = append(checks, "benchmark")
	}

	return checks
}
