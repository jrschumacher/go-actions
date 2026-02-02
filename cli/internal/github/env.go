package github

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
)

// GitHubContext contains GitHub Actions environment information
type GitHubContext struct {
	IsGitHubActions bool
	EventName       string // pull_request, push, etc.
	Token           string
	Repository      string // owner/repo format
	Owner           string
	Repo            string
	PRNumber        int
	RunID           int64
	ServerURL       string // For GHES support
	APIURL          string // For GHES support
}

// DetectGitHub parses GITHUB_* environment variables
// Returns nil if not running in GitHub Actions
func DetectGitHub() *GitHubContext {
	// Check if running in GitHub Actions
	if os.Getenv("GITHUB_ACTIONS") != "true" {
		return nil
	}

	ctx := &GitHubContext{
		IsGitHubActions: true,
		EventName:       os.Getenv("GITHUB_EVENT_NAME"),
		Token:           os.Getenv("GITHUB_TOKEN"),
		Repository:      os.Getenv("GITHUB_REPOSITORY"),
		ServerURL:       getEnvOrDefault("GITHUB_SERVER_URL", "https://github.com"),
		APIURL:          getEnvOrDefault("GITHUB_API_URL", "https://api.github.com"),
	}

	// Parse repository into owner and repo
	if ctx.Repository != "" {
		parts := strings.SplitN(ctx.Repository, "/", 2)
		if len(parts) == 2 {
			ctx.Owner = parts[0]
			ctx.Repo = parts[1]
		}
	}

	// Parse PR number from event file
	if eventPath := os.Getenv("GITHUB_EVENT_PATH"); eventPath != "" {
		if prNum, err := parsePRNumberFromEvent(eventPath); err == nil {
			ctx.PRNumber = prNum
		}
	}

	// Parse run ID
	if runIDStr := os.Getenv("GITHUB_RUN_ID"); runIDStr != "" {
		if runID, err := strconv.ParseInt(runIDStr, 10, 64); err == nil {
			ctx.RunID = runID
		}
	}

	return ctx
}

// getEnvOrDefault returns the environment variable value or a default if not set
func getEnvOrDefault(key, defaultValue string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultValue
}

// parsePRNumberFromEvent reads the GitHub event JSON file and extracts the PR number
func parsePRNumberFromEvent(eventPath string) (int, error) {
	data, err := os.ReadFile(eventPath)
	if err != nil {
		return 0, fmt.Errorf("failed to read event file: %w", err)
	}

	var event struct {
		Number      int `json:"number"`
		PullRequest *struct {
			Number int `json:"number"`
		} `json:"pull_request"`
	}

	if err := json.Unmarshal(data, &event); err != nil {
		return 0, fmt.Errorf("failed to parse event JSON: %w", err)
	}

	// Try .pull_request.number first (for push events referencing a PR)
	if event.PullRequest != nil && event.PullRequest.Number > 0 {
		return event.PullRequest.Number, nil
	}

	// Fall back to .number (for pull_request events)
	if event.Number > 0 {
		return event.Number, nil
	}

	return 0, fmt.Errorf("no PR number found in event")
}
