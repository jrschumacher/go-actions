package cmd

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/jrschumacher/go-actions/cli/internal/github"
	"github.com/jrschumacher/go-actions/cli/internal/output"
	"github.com/spf13/cobra"
)

var commentCmd = &cobra.Command{
	Use:   "comment",
	Short: "Post unified CI results as a PR comment",
	Long: `Collect CI check results and post them as a unified PR comment.

Results are passed via environment variables:
  GO_ACTIONS_TEST_STATUS       - test status (pass, fail, error, skip)
  GO_ACTIONS_TEST_COVERAGE     - test coverage percentage
  GO_ACTIONS_LINT_STATUS       - lint status (pass, fail, error, skip)
  GO_ACTIONS_LINT_ISSUES       - number of lint issues
  GO_ACTIONS_SECURITY_STATUS   - security status (pass, fail, error, skip)
  GO_ACTIONS_SECURITY_VULNS    - number of vulnerabilities
  GO_ACTIONS_BENCHMARK_STATUS  - benchmark status (pass, fail, error, skip)

Requires GitHub Actions environment (GITHUB_TOKEN, GITHUB_REPOSITORY, etc).`,
	RunE: runComment,
}

func init() {
	rootCmd.AddCommand(commentCmd)
}

func runComment(cmd *cobra.Command, args []string) error {
	ghCtx := github.DetectGitHub()
	if ghCtx == nil {
		return fmt.Errorf("comment command requires GitHub Actions environment")
	}
	if ghCtx.Token == "" {
		return fmt.Errorf("GITHUB_TOKEN not set")
	}
	if ghCtx.PRNumber == 0 {
		return fmt.Errorf("not a pull request event (no PR number found)")
	}

	results := buildResultsFromEnv()

	if len(results.Checks) == 0 {
		fmt.Fprintln(os.Stderr, "No check results found in environment variables, posting empty report")
	}

	client := github.NewClient(ghCtx)
	fmt.Fprintf(os.Stderr, "Posting unified results to PR #%d...\n", ghCtx.PRNumber)
	if err := client.MergeAndUpsertComment(ghCtx.Owner, ghCtx.Repo, ghCtx.PRNumber, results, github.CommentMarker); err != nil {
		return fmt.Errorf("failed to post comment: %w", err)
	}

	fmt.Fprintln(os.Stderr, "Comment posted successfully")
	return nil
}

func buildResultsFromEnv() *output.Results {
	results := &output.Results{
		Status: "pass",
	}

	type checkDef struct {
		name       string
		statusEnv  string
		extraEnvs  map[string]string // env var name -> field name
	}

	checks := []checkDef{
		{
			name:      "test",
			statusEnv: "GO_ACTIONS_TEST_STATUS",
			extraEnvs: map[string]string{
				"GO_ACTIONS_TEST_COVERAGE": "coverage",
			},
		},
		{
			name:      "lint",
			statusEnv: "GO_ACTIONS_LINT_STATUS",
			extraEnvs: map[string]string{
				"GO_ACTIONS_LINT_ISSUES": "issues",
			},
		},
		{
			name:      "security",
			statusEnv: "GO_ACTIONS_SECURITY_STATUS",
			extraEnvs: map[string]string{
				"GO_ACTIONS_SECURITY_VULNS": "vulnerabilities",
			},
		},
		{
			name:      "benchmark",
			statusEnv: "GO_ACTIONS_BENCHMARK_STATUS",
		},
	}

	for _, def := range checks {
		status := os.Getenv(def.statusEnv)
		if status == "" {
			continue
		}

		// Normalize status
		status = strings.ToLower(status)
		if status != "pass" && status != "fail" && status != "error" && status != "skip" {
			// Map common GitHub Actions conclusions
			switch status {
			case "success":
				status = "pass"
			case "failure":
				status = "fail"
			case "cancelled", "skipped":
				status = "skip"
			default:
				status = "error"
			}
		}

		check := output.CheckResult{
			Name:   def.name,
			Status: status,
		}

		for envVar, field := range def.extraEnvs {
			val := os.Getenv(envVar)
			if val == "" {
				continue
			}
			switch field {
			case "coverage":
				if f, err := strconv.ParseFloat(val, 64); err == nil {
					check.Coverage = f
				}
			case "issues":
				if i, err := strconv.Atoi(val); err == nil {
					check.Issues = i
				}
			case "vulnerabilities":
				if i, err := strconv.Atoi(val); err == nil {
					check.Vulnerabilities = i
				}
			}
		}

		results.Checks = append(results.Checks, check)

		// Update overall status
		if status == "fail" || status == "error" {
			if results.Status == "pass" {
				results.Status = status
			}
		}
	}

	return results
}
