package validate

// ValidationResult represents the overall validation result
type ValidationResult struct {
	Valid    bool               `json:"valid"`
	Errors   []ValidationIssue  `json:"errors"`
	Warnings []ValidationIssue  `json:"warnings"`
	Actions  []DetectedAction   `json:"actions"`
}

// ValidationIssue represents a validation error or warning
type ValidationIssue struct {
	File     string `json:"file"`
	Line     int    `json:"line,omitempty"`
	Message  string `json:"message"`
	Code     string `json:"code"`
	Severity string `json:"severity,omitempty"` // "error" or "warning"
	Expected string `json:"expected,omitempty"`
	Actual   string `json:"actual,omitempty"`
}

// DetectedAction represents a go-action found in a workflow
type DetectedAction struct {
	Name     string `json:"name"`     // ci, release, self-validate
	Version  string `json:"version"`  // e.g., v1, main
	Workflow string `json:"workflow"` // workflow file name
}

// WorkflowConfig represents configuration extracted from a workflow file
type WorkflowConfig struct {
	GolangciLintVersion string
}

// IssueType constants for validation issues
const (
	IssueTypeMissingFile           = "missing_file"
	IssueTypeVersionMismatch       = "version_mismatch"
	IssueTypeIncompatibleVersions  = "incompatible_versions"
	IssueTypeGoReleaserConfig      = "goreleaser_config"
	IssueTypeReleasePleaseConfig   = "release_please_config"
)

// Severity constants
const (
	SeverityError   = "error"
	SeverityWarning = "warning"
)
