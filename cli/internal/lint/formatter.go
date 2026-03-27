package lint

import (
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"
)

// ParseLintOutput parses golangci-lint JSON output from a file
func ParseLintOutput(jsonFilePath string) (*Report, error) {
	data, err := os.ReadFile(jsonFilePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("lint output file not found: %s", jsonFilePath)
		}
		return nil, fmt.Errorf("failed to read lint output file: %w", err)
	}

	// Handle empty file
	if len(strings.TrimSpace(string(data))) == 0 {
		return &Report{Issues: []Issue{}}, nil
	}

	var report Report
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("failed to parse lint output JSON: %w", err)
	}

	return &report, nil
}

// GroupIssuesByLinter groups lint issues by linter name
func GroupIssuesByLinter(issues []Issue) []LinterGroup {
	grouped := make(map[string]*LinterGroup)

	for _, issue := range issues {
		linterName := issue.FromLinter
		if linterName == "" {
			linterName = "unknown"
		}

		if _, exists := grouped[linterName]; !exists {
			grouped[linterName] = &LinterGroup{
				Name:   linterName,
				Count:  0,
				Issues: []GroupedIssue{},
			}
		}

		group := grouped[linterName]
		group.Count++
		group.Issues = append(group.Issues, GroupedIssue{
			File:    issue.Pos.Filename,
			Line:    issue.Pos.Line,
			Column:  issue.Pos.Column,
			Message: issue.Text,
		})
	}

	// Convert map to slice
	var groups []LinterGroup
	for _, group := range grouped {
		// Sort issues within each group by file, then line
		sort.Slice(group.Issues, func(i, j int) bool {
			if group.Issues[i].File != group.Issues[j].File {
				return group.Issues[i].File < group.Issues[j].File
			}
			return group.Issues[i].Line < group.Issues[j].Line
		})
		groups = append(groups, *group)
	}

	// Sort linters by issue count (descending) for better visibility
	sort.Slice(groups, func(i, j int) bool {
		return groups[i].Count > groups[j].Count
	})

	return groups
}

// FormatGroupedIssues formats grouped lint issues into markdown for PR comments
func FormatGroupedIssues(groups []LinterGroup, options FormatOptions) string {
	if len(groups) == 0 {
		return ""
	}

	var output strings.Builder
	issuesShown := 0
	lintersShown := 0
	totalLinters := len(groups)

	// Calculate total issues
	totalIssues := 0
	for _, group := range groups {
		totalIssues += group.Count
	}

	for _, group := range groups {
		// Check if we've hit the total issues limit
		if issuesShown >= options.MaxTotalIssues {
			remaining := totalIssues - issuesShown
			remainingLinters := totalLinters - lintersShown
			fmt.Fprintf(&output, "\n*...and %d more issue%s from %d linter%s*\n",
				remaining,
				pluralize(remaining),
				remainingLinters,
				pluralize(remainingLinters))
			break
		}

		lintersShown++

		// Format linter section
		linterTitle := fmt.Sprintf("**%s** (%d issue%s)", group.Name, group.Count, pluralize(group.Count))

		if options.UseCollapsible {
			// Use collapsible section for each linter
			isOpen := lintersShown == 1 // First linter is open by default
			if isOpen {
				fmt.Fprintf(&output, "\n<details open>\n<summary>%s</summary>\n\n", linterTitle)
			} else {
				fmt.Fprintf(&output, "\n<details>\n<summary>%s</summary>\n\n", linterTitle)
			}
		} else {
			fmt.Fprintf(&output, "\n%s\n", linterTitle)
		}

		// Show issues up to limit
		issuesToShow := min(len(group.Issues), options.MaxIssuesPerLinter)
		remainingSpace := options.MaxTotalIssues - issuesShown
		actualIssuesToShow := min(issuesToShow, remainingSpace)

		for i := 0; i < actualIssuesToShow; i++ {
			issue := group.Issues[i]
			fmt.Fprintf(&output, "- `%s:%d:%d` - %s\n",
				issue.File, issue.Line, issue.Column, issue.Message)
			issuesShown++
		}

		// Show truncation message if needed
		if len(group.Issues) > actualIssuesToShow {
			remaining := len(group.Issues) - actualIssuesToShow
			fmt.Fprintf(&output, "\n*...and %d more from %s*\n", remaining, group.Name)
		}

		if options.UseCollapsible {
			output.WriteString("\n</details>\n")
		}
	}

	return strings.TrimSpace(output.String())
}

// FormatLintOutput is the main function to format lint output for PR comments
func FormatLintOutput(jsonFilePath string, options FormatOptions) (*FormattedOutput, error) {
	report, err := ParseLintOutput(jsonFilePath)
	if err != nil {
		return nil, err
	}

	if len(report.Issues) == 0 {
		return nil, nil
	}

	groups := GroupIssuesByLinter(report.Issues)
	formattedIssues := FormatGroupedIssues(groups, options)

	if formattedIssues == "" {
		return nil, nil
	}

	// Build header with total count
	totalIssues := len(report.Issues)
	var header strings.Builder
	fmt.Fprintf(&header, "### 🚨 Lint Issues Found (%d issue%s)\n\n",
		totalIssues, pluralize(totalIssues))

	// Add workflow logs link if provided
	if options.WorkflowLogsURL != "" {
		fmt.Fprintf(&header, "[📋 View full logs](%s)\n\n", options.WorkflowLogsURL)
	}

	markdown := header.String() + formattedIssues

	// Determine if output was truncated
	truncated := false
	issueCount := 0
	for _, group := range groups {
		issueCount += min(len(group.Issues), options.MaxIssuesPerLinter)
		if issueCount >= options.MaxTotalIssues {
			truncated = true
			break
		}
	}

	return &FormattedOutput{
		Markdown:    markdown,
		IssueCount:  totalIssues,
		LinterCount: len(groups),
		Truncated:   truncated,
	}, nil
}

// GetWorkflowLogsURL extracts GitHub Actions workflow run URL for linking to logs
func GetWorkflowLogsURL() string {
	serverURL := os.Getenv("GITHUB_SERVER_URL")
	repository := os.Getenv("GITHUB_REPOSITORY")
	runID := os.Getenv("GITHUB_RUN_ID")

	if serverURL != "" && repository != "" && runID != "" {
		return fmt.Sprintf("%s/%s/actions/runs/%s", serverURL, repository, runID)
	}

	return ""
}

// pluralize returns "s" if count is not 1, empty string otherwise
func pluralize(count int) string {
	if count == 1 {
		return ""
	}
	return "s"
}

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
