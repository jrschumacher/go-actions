package cmd

import (
	"fmt"
	"os"

	"github.com/jrschumacher/go-actions/cli/internal/config"
	"github.com/jrschumacher/go-actions/cli/internal/github"
	"github.com/jrschumacher/go-actions/cli/internal/output"
	"github.com/jrschumacher/go-actions/cli/internal/runner"
	"github.com/spf13/cobra"
)

var (
	formatFlag        string
	githubCommentFlag bool
	noGithubComment   bool
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
	checkCmd.Flags().BoolVar(&githubCommentFlag, "github-comment", false, "post results as PR comment (auto-enabled in GitHub Actions PR)")
	checkCmd.Flags().BoolVar(&noGithubComment, "no-github-comment", false, "disable PR comment even in GitHub Actions")
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

	// Apply environment variable overrides (action inputs > config file > defaults)
	config.ApplyEnvOverrides(cfg)

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

		if err := formatter.PrintProgress(checks); err != nil {
			return fmt.Errorf("failed to print progress: %w", err)
		}
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

		if err := formatter.PrintProgress([]string{checkName}); err != nil {
			return fmt.Errorf("failed to print progress: %w", err)
		}
		results, err = r.RunCheck(checkName)
	}

	if err != nil {
		return fmt.Errorf("failed to run checks: %w", err)
	}

	// Print results
	if err := formatter.PrintResults(results); err != nil {
		return fmt.Errorf("failed to format results: %w", err)
	}

	// Post GitHub PR comment if enabled
	if err := maybePostGitHubComment(results); err != nil {
		// Log warning but don't fail the check
		fmt.Fprintf(os.Stderr, "Warning: failed to post GitHub comment: %v\n", err)
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

// maybePostGitHubComment posts results as a PR comment if conditions are met
func maybePostGitHubComment(results *output.Results) error {
	// Check if explicitly disabled
	if noGithubComment {
		return nil
	}

	// Detect GitHub Actions environment
	ghCtx := github.DetectGitHub()

	// Determine if we should post a comment
	shouldComment := githubCommentFlag // Explicit flag
	if !shouldComment && ghCtx != nil {
		// Auto-enable in GitHub Actions PR context with token
		shouldComment = ghCtx.EventName == "pull_request" &&
			ghCtx.Token != "" &&
			ghCtx.PRNumber > 0
	}

	if !shouldComment {
		return nil
	}

	// Validate we have what we need
	if ghCtx == nil {
		return fmt.Errorf("--github-comment requires GitHub Actions environment")
	}
	if ghCtx.Token == "" {
		return fmt.Errorf("GITHUB_TOKEN not set")
	}
	if ghCtx.PRNumber == 0 {
		return fmt.Errorf("not a pull request event")
	}

	// Format and post comment
	client := github.NewClient(ghCtx)
	commentBody := github.FormatComment(results)

	fmt.Fprintln(os.Stderr, "Posting results to PR comment...")
	return client.UpsertComment(ghCtx.Owner, ghCtx.Repo, ghCtx.PRNumber, commentBody, github.CommentMarker)
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
