package lint

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestParseLintOutput(t *testing.T) {
	tests := []struct {
		name        string
		content     string
		wantErr     bool
		wantIssues  int
		description string
	}{
		{
			name: "valid output with issues",
			content: `{
				"Issues": [
					{
						"FromLinter": "errcheck",
						"Text": "Error return value not checked",
						"Pos": {
							"Filename": "main.go",
							"Line": 10,
							"Column": 5
						}
					}
				]
			}`,
			wantErr:     false,
			wantIssues:  1,
			description: "should parse valid golangci-lint output",
		},
		{
			name:        "empty file",
			content:     "",
			wantErr:     false,
			wantIssues:  0,
			description: "should handle empty file",
		},
		{
			name:        "whitespace only",
			content:     "   \n\t  \n  ",
			wantErr:     false,
			wantIssues:  0,
			description: "should handle whitespace-only file",
		},
		{
			name:        "invalid JSON",
			content:     `{"Issues": [invalid}`,
			wantErr:     true,
			description: "should return error for invalid JSON",
		},
		{
			name: "no issues",
			content: `{
				"Issues": []
			}`,
			wantErr:     false,
			wantIssues:  0,
			description: "should handle report with no issues",
		},
		{
			name: "multiple issues from different linters",
			content: `{
				"Issues": [
					{
						"FromLinter": "errcheck",
						"Text": "Error return value not checked",
						"Pos": {"Filename": "main.go", "Line": 10, "Column": 5}
					},
					{
						"FromLinter": "staticcheck",
						"Text": "Unused variable",
						"Pos": {"Filename": "utils.go", "Line": 20, "Column": 8}
					}
				]
			}`,
			wantErr:     false,
			wantIssues:  2,
			description: "should handle multiple issues from different linters",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create temp file
			tmpDir := t.TempDir()
			tmpFile := filepath.Join(tmpDir, "lint.json")

			if err := os.WriteFile(tmpFile, []byte(tt.content), 0644); err != nil {
				t.Fatalf("Failed to create temp file: %v", err)
			}

			report, err := ParseLintOutput(tmpFile)

			if tt.wantErr {
				if err == nil {
					t.Errorf("%s: expected error but got none", tt.description)
				}
				return
			}

			if err != nil {
				t.Errorf("%s: unexpected error: %v", tt.description, err)
				return
			}

			if report == nil {
				t.Errorf("%s: expected report but got nil", tt.description)
				return
			}

			if len(report.Issues) != tt.wantIssues {
				t.Errorf("%s: expected %d issues, got %d", tt.description, tt.wantIssues, len(report.Issues))
			}
		})
	}
}

func TestParseLintOutput_FileNotFound(t *testing.T) {
	_, err := ParseLintOutput("/nonexistent/file.json")
	if err == nil {
		t.Error("expected error for nonexistent file")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("expected 'not found' error, got: %v", err)
	}
}

func TestGroupIssuesByLinter(t *testing.T) {
	tests := []struct {
		name        string
		issues      []Issue
		wantGroups  int
		description string
	}{
		{
			name:        "empty issues",
			issues:      []Issue{},
			wantGroups:  0,
			description: "should return empty slice for no issues",
		},
		{
			name: "single linter",
			issues: []Issue{
				{
					FromLinter: "errcheck",
					Text:       "Error 1",
					Pos:        Position{Filename: "a.go", Line: 10, Column: 5},
				},
				{
					FromLinter: "errcheck",
					Text:       "Error 2",
					Pos:        Position{Filename: "b.go", Line: 20, Column: 3},
				},
			},
			wantGroups:  1,
			description: "should group issues from same linter",
		},
		{
			name: "multiple linters",
			issues: []Issue{
				{
					FromLinter: "errcheck",
					Text:       "Error 1",
					Pos:        Position{Filename: "a.go", Line: 10, Column: 5},
				},
				{
					FromLinter: "staticcheck",
					Text:       "Warning 1",
					Pos:        Position{Filename: "b.go", Line: 20, Column: 3},
				},
				{
					FromLinter: "errcheck",
					Text:       "Error 2",
					Pos:        Position{Filename: "c.go", Line: 15, Column: 8},
				},
			},
			wantGroups:  2,
			description: "should group issues by linter",
		},
		{
			name: "unknown linter",
			issues: []Issue{
				{
					FromLinter: "",
					Text:       "Some error",
					Pos:        Position{Filename: "a.go", Line: 10, Column: 5},
				},
			},
			wantGroups:  1,
			description: "should handle empty linter name as 'unknown'",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			groups := GroupIssuesByLinter(tt.issues)

			if len(groups) != tt.wantGroups {
				t.Errorf("%s: expected %d groups, got %d", tt.description, tt.wantGroups, len(groups))
			}

			// Verify sorting by count (descending)
			for i := 1; i < len(groups); i++ {
				if groups[i-1].Count < groups[i].Count {
					t.Errorf("%s: groups not sorted by count descending", tt.description)
				}
			}

			// Verify issues within each group are sorted by file, then line
			for _, group := range groups {
				for i := 1; i < len(group.Issues); i++ {
					prev := group.Issues[i-1]
					curr := group.Issues[i]
					if prev.File == curr.File && prev.Line > curr.Line {
						t.Errorf("%s: issues not sorted by line within group %s", tt.description, group.Name)
					}
				}
			}
		})
	}
}

func TestFormatGroupedIssues(t *testing.T) {
	tests := []struct {
		name        string
		groups      []LinterGroup
		options     FormatOptions
		wantContain []string
		wantNotContain []string
		description string
	}{
		{
			name:        "empty groups",
			groups:      []LinterGroup{},
			options:     DefaultOptions(),
			wantContain: []string{},
			description: "should return empty string for no groups",
		},
		{
			name: "single group with collapsible",
			groups: []LinterGroup{
				{
					Name:  "errcheck",
					Count: 1,
					Issues: []GroupedIssue{
						{File: "main.go", Line: 10, Column: 5, Message: "Error not checked"},
					},
				},
			},
			options: FormatOptions{
				MaxIssuesPerLinter: 10,
				MaxTotalIssues:     50,
				UseCollapsible:     true,
			},
			wantContain:    []string{"<details open>", "**errcheck**", "main.go:10:5", "Error not checked"},
			description:    "should format single group with collapsible section open",
		},
		{
			name: "multiple groups with collapsible",
			groups: []LinterGroup{
				{
					Name:  "errcheck",
					Count: 2,
					Issues: []GroupedIssue{
						{File: "main.go", Line: 10, Column: 5, Message: "Error 1"},
						{File: "utils.go", Line: 20, Column: 3, Message: "Error 2"},
					},
				},
				{
					Name:  "staticcheck",
					Count: 1,
					Issues: []GroupedIssue{
						{File: "app.go", Line: 15, Column: 8, Message: "Warning 1"},
					},
				},
			},
			options: FormatOptions{
				MaxIssuesPerLinter: 10,
				MaxTotalIssues:     50,
				UseCollapsible:     true,
			},
			wantContain:    []string{"<details open>", "<details>", "**errcheck**", "**staticcheck**"},
			description:    "should format multiple groups with first open",
		},
		{
			name: "truncate per linter",
			groups: []LinterGroup{
				{
					Name:  "errcheck",
					Count: 5,
					Issues: []GroupedIssue{
						{File: "a.go", Line: 1, Column: 1, Message: "Error 1"},
						{File: "b.go", Line: 2, Column: 2, Message: "Error 2"},
						{File: "c.go", Line: 3, Column: 3, Message: "Error 3"},
					},
				},
			},
			options: FormatOptions{
				MaxIssuesPerLinter: 2,
				MaxTotalIssues:     50,
				UseCollapsible:     true,
			},
			wantContain:    []string{"a.go:1:1", "b.go:2:2", "...and 1 more from errcheck"},
			wantNotContain: []string{"c.go:3:3"},
			description:    "should truncate issues per linter",
		},
		{
			name: "truncate total issues",
			groups: []LinterGroup{
				{
					Name:  "errcheck",
					Count: 3,
					Issues: []GroupedIssue{
						{File: "a.go", Line: 1, Column: 1, Message: "Error 1"},
						{File: "b.go", Line: 2, Column: 2, Message: "Error 2"},
						{File: "c.go", Line: 3, Column: 3, Message: "Error 3"},
					},
				},
				{
					Name:  "staticcheck",
					Count: 2,
					Issues: []GroupedIssue{
						{File: "d.go", Line: 4, Column: 4, Message: "Warning 1"},
						{File: "e.go", Line: 5, Column: 5, Message: "Warning 2"},
					},
				},
			},
			options: FormatOptions{
				MaxIssuesPerLinter: 10,
				MaxTotalIssues:     3,
				UseCollapsible:     true,
			},
			wantContain:    []string{"a.go:1:1", "b.go:2:2", "c.go:3:3", "...and 2 more issue"},
			wantNotContain: []string{"d.go:4:4", "e.go:5:5"},
			description:    "should truncate at total issues limit",
		},
		{
			name: "without collapsible",
			groups: []LinterGroup{
				{
					Name:  "errcheck",
					Count: 1,
					Issues: []GroupedIssue{
						{File: "main.go", Line: 10, Column: 5, Message: "Error not checked"},
					},
				},
			},
			options: FormatOptions{
				MaxIssuesPerLinter: 10,
				MaxTotalIssues:     50,
				UseCollapsible:     false,
			},
			wantContain:    []string{"**errcheck**", "main.go:10:5"},
			wantNotContain: []string{"<details>"},
			description:    "should format without collapsible sections",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			output := FormatGroupedIssues(tt.groups, tt.options)

			for _, want := range tt.wantContain {
				if !strings.Contains(output, want) {
					t.Errorf("%s: output should contain %q\nGot: %s", tt.description, want, output)
				}
			}

			for _, notWant := range tt.wantNotContain {
				if strings.Contains(output, notWant) {
					t.Errorf("%s: output should not contain %q\nGot: %s", tt.description, notWant, output)
				}
			}
		})
	}
}

func TestFormatLintOutput(t *testing.T) {
	tests := []struct {
		name        string
		content     string
		options     FormatOptions
		wantNil     bool
		wantErr     bool
		wantContain []string
		description string
	}{
		{
			name: "complete output with header",
			content: `{
				"Issues": [
					{
						"FromLinter": "errcheck",
						"Text": "Error return value not checked",
						"Pos": {"Filename": "main.go", "Line": 10, "Column": 5}
					}
				]
			}`,
			options: FormatOptions{
				MaxIssuesPerLinter: 10,
				MaxTotalIssues:     50,
				UseCollapsible:     true,
				WorkflowLogsURL:    "https://github.com/user/repo/actions/runs/123",
			},
			wantNil:     false,
			wantErr:     false,
			wantContain: []string{"### 🚨 Lint Issues Found (1 issue)", "View full logs", "**errcheck**"},
			description: "should format complete output with header and logs link",
		},
		{
			name:        "no issues",
			content:     `{"Issues": []}`,
			options:     DefaultOptions(),
			wantNil:     true,
			wantErr:     false,
			description: "should return nil for no issues",
		},
		{
			name: "pluralization",
			content: `{
				"Issues": [
					{
						"FromLinter": "errcheck",
						"Text": "Error 1",
						"Pos": {"Filename": "a.go", "Line": 1, "Column": 1}
					},
					{
						"FromLinter": "errcheck",
						"Text": "Error 2",
						"Pos": {"Filename": "b.go", "Line": 2, "Column": 2}
					}
				]
			}`,
			options:     DefaultOptions(),
			wantNil:     false,
			wantErr:     false,
			wantContain: []string{"### 🚨 Lint Issues Found (2 issues)", "**errcheck** (2 issues)"},
			description: "should pluralize issue counts correctly",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create temp file
			tmpDir := t.TempDir()
			tmpFile := filepath.Join(tmpDir, "lint.json")

			if err := os.WriteFile(tmpFile, []byte(tt.content), 0644); err != nil {
				t.Fatalf("Failed to create temp file: %v", err)
			}

			output, err := FormatLintOutput(tmpFile, tt.options)

			if tt.wantErr {
				if err == nil {
					t.Errorf("%s: expected error but got none", tt.description)
				}
				return
			}

			if err != nil {
				t.Errorf("%s: unexpected error: %v", tt.description, err)
				return
			}

			if tt.wantNil {
				if output != nil {
					t.Errorf("%s: expected nil output but got: %v", tt.description, output)
				}
				return
			}

			if output == nil {
				t.Errorf("%s: expected output but got nil", tt.description)
				return
			}

			for _, want := range tt.wantContain {
				if !strings.Contains(output.Markdown, want) {
					t.Errorf("%s: markdown should contain %q\nGot: %s", tt.description, want, output.Markdown)
				}
			}
		})
	}
}

func TestGetWorkflowLogsURL(t *testing.T) {
	tests := []struct {
		name        string
		envVars     map[string]string
		want        string
		description string
	}{
		{
			name: "all env vars set",
			envVars: map[string]string{
				"GITHUB_SERVER_URL": "https://github.com",
				"GITHUB_REPOSITORY": "user/repo",
				"GITHUB_RUN_ID":     "123456",
			},
			want:        "https://github.com/user/repo/actions/runs/123456",
			description: "should construct URL when all env vars present",
		},
		{
			name:        "no env vars",
			envVars:     map[string]string{},
			want:        "",
			description: "should return empty string when env vars missing",
		},
		{
			name: "missing run ID",
			envVars: map[string]string{
				"GITHUB_SERVER_URL": "https://github.com",
				"GITHUB_REPOSITORY": "user/repo",
			},
			want:        "",
			description: "should return empty string when run ID missing",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clear and set env vars
			os.Clearenv()
			for k, v := range tt.envVars {
				os.Setenv(k, v)
			}

			got := GetWorkflowLogsURL()

			if got != tt.want {
				t.Errorf("%s: expected %q, got %q", tt.description, tt.want, got)
			}
		})
	}
}

func TestDefaultOptions(t *testing.T) {
	opts := DefaultOptions()

	if opts.MaxIssuesPerLinter != 10 {
		t.Errorf("expected MaxIssuesPerLinter=10, got %d", opts.MaxIssuesPerLinter)
	}

	if opts.MaxTotalIssues != 50 {
		t.Errorf("expected MaxTotalIssues=50, got %d", opts.MaxTotalIssues)
	}

	if !opts.UseCollapsible {
		t.Error("expected UseCollapsible=true")
	}
}

func TestPluralize(t *testing.T) {
	tests := []struct {
		count int
		want  string
	}{
		{0, "s"},
		{1, ""},
		{2, "s"},
		{100, "s"},
	}

	for _, tt := range tests {
		t.Run(string(rune(tt.count)), func(t *testing.T) {
			got := pluralize(tt.count)
			if got != tt.want {
				t.Errorf("pluralize(%d) = %q, want %q", tt.count, got, tt.want)
			}
		})
	}
}

func TestMin(t *testing.T) {
	tests := []struct {
		a, b int
		want int
	}{
		{1, 2, 1},
		{2, 1, 1},
		{5, 5, 5},
		{0, 10, 0},
		{-1, 1, -1},
	}

	for _, tt := range tests {
		t.Run("", func(t *testing.T) {
			got := min(tt.a, tt.b)
			if got != tt.want {
				t.Errorf("min(%d, %d) = %d, want %d", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

// TestIntegration verifies end-to-end functionality
func TestIntegration(t *testing.T) {
	lintOutput := `{
		"Issues": [
			{
				"FromLinter": "errcheck",
				"Text": "Error return value of 'fmt.Println' not checked",
				"Pos": {"Filename": "main.go", "Line": 10, "Column": 5}
			},
			{
				"FromLinter": "errcheck",
				"Text": "Error return value of 'os.Open' not checked",
				"Pos": {"Filename": "file.go", "Line": 25, "Column": 10}
			},
			{
				"FromLinter": "staticcheck",
				"Text": "this value of err is never used (SA4006)",
				"Pos": {"Filename": "utils.go", "Line": 15, "Column": 8}
			},
			{
				"FromLinter": "unused",
				"Text": "func 'helper' is unused (U1000)",
				"Pos": {"Filename": "helpers.go", "Line": 42, "Column": 1}
			}
		]
	}`

	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "lint.json")

	if err := os.WriteFile(tmpFile, []byte(lintOutput), 0644); err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}

	// Test with default options
	output, err := FormatLintOutput(tmpFile, DefaultOptions())
	if err != nil {
		t.Fatalf("FormatLintOutput failed: %v", err)
	}

	if output == nil {
		t.Fatal("expected output but got nil")
	}

	// Verify output metadata
	if output.IssueCount != 4 {
		t.Errorf("expected 4 issues, got %d", output.IssueCount)
	}

	if output.LinterCount != 3 {
		t.Errorf("expected 3 linters, got %d", output.LinterCount)
	}

	// Verify markdown contains expected elements
	expected := []string{
		"### 🚨 Lint Issues Found (4 issues)",
		"**errcheck** (2 issues)",
		"**staticcheck** (1 issue)",
		"**unused** (1 issue)",
		"main.go:10:5",
		"file.go:25:10",
		"utils.go:15:8",
		"helpers.go:42:1",
		"<details open>",
		"<details>",
	}

	for _, exp := range expected {
		if !strings.Contains(output.Markdown, exp) {
			t.Errorf("markdown should contain %q\nGot: %s", exp, output.Markdown)
		}
	}
}

// TestJSONUnmarshal verifies type definitions match golangci-lint output
func TestJSONUnmarshal(t *testing.T) {
	jsonData := `{
		"Issues": [
			{
				"FromLinter": "errcheck",
				"Text": "Error not checked",
				"Severity": "warning",
				"SourceLines": ["line1", "line2"],
				"Pos": {
					"Filename": "main.go",
					"Offset": 150,
					"Line": 10,
					"Column": 5
				},
				"Replacement": {
					"NeedOnlyDelete": false,
					"NewLines": ["fixed line"],
					"Inline": {
						"StartCol": 5,
						"Length": 10
					}
				}
			}
		],
		"Report": {
			"Warnings": ["some warning"],
			"Linters": {"enabled": ["errcheck", "staticcheck"]}
		}
	}`

	var report Report
	err := json.Unmarshal([]byte(jsonData), &report)
	if err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	if len(report.Issues) != 1 {
		t.Errorf("expected 1 issue, got %d", len(report.Issues))
	}

	issue := report.Issues[0]
	if issue.FromLinter != "errcheck" {
		t.Errorf("expected FromLinter=errcheck, got %s", issue.FromLinter)
	}

	if issue.Pos.Line != 10 {
		t.Errorf("expected Line=10, got %d", issue.Pos.Line)
	}

	if issue.Replacement == nil {
		t.Fatal("expected Replacement to be set")
	}

	if issue.Replacement.Inline == nil {
		t.Fatal("expected Inline to be set")
	}

	if issue.Replacement.Inline.StartCol != 5 {
		t.Errorf("expected StartCol=5, got %d", issue.Replacement.Inline.StartCol)
	}
}
