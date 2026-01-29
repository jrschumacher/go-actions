package lint

// Issue represents a single golangci-lint issue
type Issue struct {
	FromLinter  string       `json:"FromLinter"`
	Text        string       `json:"Text"`
	Severity    string       `json:"Severity,omitempty"`
	SourceLines []string     `json:"SourceLines,omitempty"`
	Pos         Position     `json:"Pos"`
	Replacement *Replacement `json:"Replacement,omitempty"`
}

// Position represents the position of an issue in a file
type Position struct {
	Filename string `json:"Filename"`
	Offset   int    `json:"Offset"`
	Line     int    `json:"Line"`
	Column   int    `json:"Column"`
}

// Replacement represents suggested code replacement
type Replacement struct {
	NeedOnlyDelete bool     `json:"NeedOnlyDelete,omitempty"`
	NewLines       []string `json:"NewLines,omitempty"`
	Inline         *Inline  `json:"Inline,omitempty"`
}

// Inline represents inline replacement details
type Inline struct {
	StartCol int `json:"StartCol"`
	Length   int `json:"Length"`
}

// Report represents the complete golangci-lint JSON output
type Report struct {
	Issues []Issue        `json:"Issues"`
	Report *ReportDetails `json:"Report,omitempty"`
}

// ReportDetails contains additional report information
type ReportDetails struct {
	Warnings []string               `json:"Warnings,omitempty"`
	Linters  map[string]interface{} `json:"Linters,omitempty"`
}

// GroupedIssue represents an issue formatted for display
type GroupedIssue struct {
	File    string
	Line    int
	Column  int
	Message string
}

// LinterGroup represents all issues for a specific linter
type LinterGroup struct {
	Name   string
	Count  int
	Issues []GroupedIssue
}

// FormatOptions configures output formatting
type FormatOptions struct {
	// MaxIssuesPerLinter is the maximum number of issues to show per linter before truncating
	MaxIssuesPerLinter int

	// MaxTotalIssues is the maximum total number of issues to show before truncating entirely
	MaxTotalIssues int

	// UseCollapsible determines whether to use collapsible sections for each linter
	UseCollapsible bool

	// WorkflowLogsURL is a link to full workflow logs
	WorkflowLogsURL string
}

// DefaultOptions returns default formatting options
func DefaultOptions() FormatOptions {
	return FormatOptions{
		MaxIssuesPerLinter: 10,
		MaxTotalIssues:     50,
		UseCollapsible:     true,
	}
}

// FormattedOutput represents the final formatted output
type FormattedOutput struct {
	Markdown    string
	IssueCount  int
	LinterCount int
	Truncated   bool
}
