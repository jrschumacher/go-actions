package github

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestDetectGitHub(t *testing.T) {
	tests := []struct {
		name      string
		env       map[string]string
		eventJSON string
		wantNil   bool
		checkFunc func(*testing.T, *GitHubContext)
	}{
		{
			name:    "not in GitHub Actions",
			env:     map[string]string{},
			wantNil: true,
		},
		{
			name: "GITHUB_ACTIONS not true",
			env: map[string]string{
				"GITHUB_ACTIONS": "false",
			},
			wantNil: true,
		},
		{
			name: "minimal GitHub Actions environment",
			env: map[string]string{
				"GITHUB_ACTIONS": "true",
			},
			wantNil: false,
			checkFunc: func(t *testing.T, ctx *GitHubContext) {
				if !ctx.IsGitHubActions {
					t.Error("expected IsGitHubActions to be true")
				}
				if ctx.ServerURL != "https://github.com" {
					t.Errorf("expected default ServerURL, got %s", ctx.ServerURL)
				}
				if ctx.APIURL != "https://api.github.com" {
					t.Errorf("expected default APIURL, got %s", ctx.APIURL)
				}
			},
		},
		{
			name: "full GitHub Actions environment",
			env: map[string]string{
				"GITHUB_ACTIONS":    "true",
				"GITHUB_EVENT_NAME": "pull_request",
				"GITHUB_TOKEN":      "ghp_test123",
				"GITHUB_REPOSITORY": "owner/repo",
				"GITHUB_RUN_ID":     "12345",
			},
			wantNil: false,
			checkFunc: func(t *testing.T, ctx *GitHubContext) {
				if !ctx.IsGitHubActions {
					t.Error("expected IsGitHubActions to be true")
				}
				if ctx.EventName != "pull_request" {
					t.Errorf("expected EventName pull_request, got %s", ctx.EventName)
				}
				if ctx.Token != "ghp_test123" {
					t.Errorf("expected Token ghp_test123, got %s", ctx.Token)
				}
				if ctx.Repository != "owner/repo" {
					t.Errorf("expected Repository owner/repo, got %s", ctx.Repository)
				}
				if ctx.Owner != "owner" {
					t.Errorf("expected Owner owner, got %s", ctx.Owner)
				}
				if ctx.Repo != "repo" {
					t.Errorf("expected Repo repo, got %s", ctx.Repo)
				}
				if ctx.RunID != 12345 {
					t.Errorf("expected RunID 12345, got %d", ctx.RunID)
				}
			},
		},
		{
			name: "GitHub Enterprise Server URLs",
			env: map[string]string{
				"GITHUB_ACTIONS":    "true",
				"GITHUB_SERVER_URL": "https://github.example.com",
				"GITHUB_API_URL":    "https://github.example.com/api/v3",
			},
			wantNil: false,
			checkFunc: func(t *testing.T, ctx *GitHubContext) {
				if ctx.ServerURL != "https://github.example.com" {
					t.Errorf("expected ServerURL https://github.example.com, got %s", ctx.ServerURL)
				}
				if ctx.APIURL != "https://github.example.com/api/v3" {
					t.Errorf("expected APIURL https://github.example.com/api/v3, got %s", ctx.APIURL)
				}
			},
		},
		{
			name: "invalid repository format",
			env: map[string]string{
				"GITHUB_ACTIONS":    "true",
				"GITHUB_REPOSITORY": "invalid",
			},
			wantNil: false,
			checkFunc: func(t *testing.T, ctx *GitHubContext) {
				if ctx.Repository != "invalid" {
					t.Errorf("expected Repository invalid, got %s", ctx.Repository)
				}
				if ctx.Owner != "" {
					t.Errorf("expected Owner to be empty, got %s", ctx.Owner)
				}
				if ctx.Repo != "" {
					t.Errorf("expected Repo to be empty, got %s", ctx.Repo)
				}
			},
		},
		{
			name: "invalid run ID",
			env: map[string]string{
				"GITHUB_ACTIONS": "true",
				"GITHUB_RUN_ID":  "invalid",
			},
			wantNil: false,
			checkFunc: func(t *testing.T, ctx *GitHubContext) {
				if ctx.RunID != 0 {
					t.Errorf("expected RunID 0 for invalid input, got %d", ctx.RunID)
				}
			},
		},
		{
			name: "pull_request event with .number",
			env: map[string]string{
				"GITHUB_ACTIONS": "true",
			},
			eventJSON: `{"number": 42}`,
			wantNil:   false,
			checkFunc: func(t *testing.T, ctx *GitHubContext) {
				if ctx.PRNumber != 42 {
					t.Errorf("expected PRNumber 42, got %d", ctx.PRNumber)
				}
			},
		},
		{
			name: "push event with .pull_request.number",
			env: map[string]string{
				"GITHUB_ACTIONS": "true",
			},
			eventJSON: `{"pull_request": {"number": 99}}`,
			wantNil:   false,
			checkFunc: func(t *testing.T, ctx *GitHubContext) {
				if ctx.PRNumber != 99 {
					t.Errorf("expected PRNumber 99, got %d", ctx.PRNumber)
				}
			},
		},
		{
			name: "event with both numbers prefers .pull_request.number",
			env: map[string]string{
				"GITHUB_ACTIONS": "true",
			},
			eventJSON: `{"number": 10, "pull_request": {"number": 20}}`,
			wantNil:   false,
			checkFunc: func(t *testing.T, ctx *GitHubContext) {
				if ctx.PRNumber != 20 {
					t.Errorf("expected PRNumber 20, got %d", ctx.PRNumber)
				}
			},
		},
		{
			name: "event with no PR number",
			env: map[string]string{
				"GITHUB_ACTIONS": "true",
			},
			eventJSON: `{"ref": "refs/heads/main"}`,
			wantNil:   false,
			checkFunc: func(t *testing.T, ctx *GitHubContext) {
				if ctx.PRNumber != 0 {
					t.Errorf("expected PRNumber 0, got %d", ctx.PRNumber)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clear all GITHUB_* environment variables first
			clearGitHubEnv(t)

			// Set test environment variables
			for k, v := range tt.env {
				t.Setenv(k, v)
			}

			// Create event file if needed
			if tt.eventJSON != "" {
				tmpDir := t.TempDir()
				eventPath := filepath.Join(tmpDir, "event.json")
				if err := os.WriteFile(eventPath, []byte(tt.eventJSON), 0644); err != nil {
					t.Fatalf("failed to create event file: %v", err)
				}
				t.Setenv("GITHUB_EVENT_PATH", eventPath)
			}

			ctx := DetectGitHub()

			if tt.wantNil {
				if ctx != nil {
					t.Errorf("expected nil context, got %+v", ctx)
				}
				return
			}

			if ctx == nil {
				t.Fatal("expected non-nil context, got nil")
			}

			if tt.checkFunc != nil {
				tt.checkFunc(t, ctx)
			}
		})
	}
}

func TestParsePRNumberFromEvent(t *testing.T) {
	tests := []struct {
		name      string
		eventJSON string
		wantPR    int
		wantErr   bool
	}{
		{
			name:      "pull_request event",
			eventJSON: `{"number": 42}`,
			wantPR:    42,
			wantErr:   false,
		},
		{
			name:      "push event with PR",
			eventJSON: `{"pull_request": {"number": 99}}`,
			wantPR:    99,
			wantErr:   false,
		},
		{
			name:      "prefers pull_request.number",
			eventJSON: `{"number": 10, "pull_request": {"number": 20}}`,
			wantPR:    20,
			wantErr:   false,
		},
		{
			name:      "no PR number",
			eventJSON: `{"ref": "refs/heads/main"}`,
			wantPR:    0,
			wantErr:   true,
		},
		{
			name:      "invalid JSON",
			eventJSON: `{invalid json`,
			wantPR:    0,
			wantErr:   true,
		},
		{
			name:      "empty file",
			eventJSON: ``,
			wantPR:    0,
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tmpDir := t.TempDir()
			eventPath := filepath.Join(tmpDir, "event.json")

			if err := os.WriteFile(eventPath, []byte(tt.eventJSON), 0644); err != nil {
				t.Fatalf("failed to create event file: %v", err)
			}

			prNum, err := parsePRNumberFromEvent(eventPath)

			if (err != nil) != tt.wantErr {
				t.Errorf("parsePRNumberFromEvent() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if prNum != tt.wantPR {
				t.Errorf("parsePRNumberFromEvent() = %d, want %d", prNum, tt.wantPR)
			}
		})
	}
}

func TestParsePRNumberFromEventFileErrors(t *testing.T) {
	t.Run("non-existent file", func(t *testing.T) {
		_, err := parsePRNumberFromEvent("/nonexistent/path/event.json")
		if err == nil {
			t.Error("expected error for non-existent file, got nil")
		}
	})
}

// clearGitHubEnv clears all GITHUB_* environment variables to avoid test pollution
func clearGitHubEnv(t *testing.T) {
	// List of known GITHUB_* variables
	ghVars := []string{
		"GITHUB_ACTIONS",
		"GITHUB_EVENT_NAME",
		"GITHUB_TOKEN",
		"GITHUB_REPOSITORY",
		"GITHUB_RUN_ID",
		"GITHUB_SERVER_URL",
		"GITHUB_API_URL",
		"GITHUB_EVENT_PATH",
	}

	for _, v := range ghVars {
		if val := os.Getenv(v); val != "" {
			// Store original value and restore after test
			t.Setenv(v, "")
		}
	}
}

func TestGetEnvOrDefault(t *testing.T) {
	tests := []struct {
		name         string
		key          string
		defaultValue string
		envValue     string
		want         string
	}{
		{
			name:         "env var set",
			key:          "TEST_VAR",
			defaultValue: "default",
			envValue:     "custom",
			want:         "custom",
		},
		{
			name:         "env var not set",
			key:          "TEST_VAR",
			defaultValue: "default",
			envValue:     "",
			want:         "default",
		},
		{
			name:         "env var empty string",
			key:          "TEST_VAR",
			defaultValue: "default",
			envValue:     "",
			want:         "default",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.envValue != "" {
				t.Setenv(tt.key, tt.envValue)
			}

			got := getEnvOrDefault(tt.key, tt.defaultValue)
			if got != tt.want {
				t.Errorf("getEnvOrDefault() = %v, want %v", got, tt.want)
			}
		})
	}
}

// TestDetectGitHubIntegration tests DetectGitHub with a realistic event file
func TestDetectGitHubIntegration(t *testing.T) {
	// Create a realistic GitHub event JSON
	event := map[string]interface{}{
		"action": "opened",
		"number": 123,
		"pull_request": map[string]interface{}{
			"number": 123,
			"title":  "Test PR",
			"state":  "open",
		},
	}

	eventJSON, err := json.Marshal(event)
	if err != nil {
		t.Fatalf("failed to marshal event JSON: %v", err)
	}

	tmpDir := t.TempDir()
	eventPath := filepath.Join(tmpDir, "event.json")
	if err := os.WriteFile(eventPath, eventJSON, 0644); err != nil {
		t.Fatalf("failed to create event file: %v", err)
	}

	// Clear environment
	clearGitHubEnv(t)

	// Set up realistic environment
	t.Setenv("GITHUB_ACTIONS", "true")
	t.Setenv("GITHUB_EVENT_NAME", "pull_request")
	t.Setenv("GITHUB_TOKEN", "ghp_test_token_123")
	t.Setenv("GITHUB_REPOSITORY", "jrschumacher/go-actions")
	t.Setenv("GITHUB_RUN_ID", "9876543210")
	t.Setenv("GITHUB_EVENT_PATH", eventPath)

	ctx := DetectGitHub()
	if ctx == nil {
		t.Fatal("expected non-nil context")
	}

	// Validate all fields
	if !ctx.IsGitHubActions {
		t.Error("expected IsGitHubActions to be true")
	}
	if ctx.EventName != "pull_request" {
		t.Errorf("expected EventName pull_request, got %s", ctx.EventName)
	}
	if ctx.Token != "ghp_test_token_123" {
		t.Errorf("expected Token ghp_test_token_123, got %s", ctx.Token)
	}
	if ctx.Repository != "jrschumacher/go-actions" {
		t.Errorf("expected Repository jrschumacher/go-actions, got %s", ctx.Repository)
	}
	if ctx.Owner != "jrschumacher" {
		t.Errorf("expected Owner jrschumacher, got %s", ctx.Owner)
	}
	if ctx.Repo != "go-actions" {
		t.Errorf("expected Repo go-actions, got %s", ctx.Repo)
	}
	if ctx.PRNumber != 123 {
		t.Errorf("expected PRNumber 123, got %d", ctx.PRNumber)
	}
	if ctx.RunID != 9876543210 {
		t.Errorf("expected RunID 9876543210, got %d", ctx.RunID)
	}
	if ctx.ServerURL != "https://github.com" {
		t.Errorf("expected ServerURL https://github.com, got %s", ctx.ServerURL)
	}
	if ctx.APIURL != "https://api.github.com" {
		t.Errorf("expected APIURL https://api.github.com, got %s", ctx.APIURL)
	}
}
