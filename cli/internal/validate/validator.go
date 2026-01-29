package validate

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

const (
	// WorkflowConfigSearchLines is the number of lines to search after finding an action usage
	// to find configuration options like golangci-lint-version
	WorkflowConfigSearchLines = 10
)

// Validator handles workflow and project validation
type Validator struct {
	workingDir string
}

// NewValidator creates a new Validator instance
func NewValidator(workingDir string) *Validator {
	if workingDir == "" {
		workingDir = "."
	}
	return &Validator{
		workingDir: workingDir,
	}
}

// ValidateProject validates a Go project for go-actions compatibility
func ValidateProject(dir string, workflowPaths []string) (*ValidationResult, error) {
	validator := NewValidator(dir)
	return validator.Validate(workflowPaths)
}

// Validate performs full validation of the project
func (v *Validator) Validate(workflowPaths []string) (*ValidationResult, error) {
	result := &ValidationResult{
		Valid:    true,
		Errors:   []ValidationIssue{},
		Warnings: []ValidationIssue{},
		Actions:  []DetectedAction{},
	}

	// Find workflow files
	workflowFiles, err := v.findWorkflowFiles(workflowPaths)
	if err != nil {
		return nil, fmt.Errorf("failed to find workflow files: %w", err)
	}

	if len(workflowFiles) == 0 {
		return result, nil
	}

	// Check if this is the go-actions repository itself
	if v.isGoActionsRepo() {
		return result, nil
	}

	// Track detected actions to avoid duplicates
	actionsFound := make(map[string]bool)

	// Process each workflow file
	for _, workflowFile := range workflowFiles {
		content, err := os.ReadFile(workflowFile)
		if err != nil {
			continue
		}

		workflowContent := string(content)
		workflowName := filepath.Base(workflowFile)

		// Check for CI action
		if v.detectAction(workflowContent, "ci", workflowName, actionsFound, result) {
			v.validateCIAction(workflowContent, result)
		}

		// Check for direct golangci-lint-action usage
		v.validateGolangciLintAction(workflowContent, result)

		// Check for release action
		if v.detectAction(workflowContent, "release", workflowName, actionsFound, result) {
			v.validateReleaseAction(result)
		}

		// Check for self-validate action
		v.detectAction(workflowContent, "self-validate", workflowName, actionsFound, result)
	}

	// Set overall validity
	result.Valid = len(result.Errors) == 0

	return result, nil
}

// detectAction checks if an action is used in the workflow and records it
func (v *Validator) detectAction(content, actionName, workflowName string, actionsFound map[string]bool, result *ValidationResult) bool {
	pattern := fmt.Sprintf(`jrschumacher/go-actions/%s@`, actionName)
	if !strings.Contains(content, pattern) {
		return false
	}

	// Extract version if not already recorded
	if !actionsFound[actionName] {
		version := v.extractActionVersion(content, actionName)
		result.Actions = append(result.Actions, DetectedAction{
			Name:     actionName,
			Version:  version,
			Workflow: workflowName,
		})
		actionsFound[actionName] = true
	}

	return true
}

// extractActionVersion extracts the version reference from the action usage
func (v *Validator) extractActionVersion(content, actionName string) string {
	pattern := fmt.Sprintf(`jrschumacher/go-actions/%s@([^\s\n]+)`, actionName)
	re := regexp.MustCompile(pattern)
	matches := re.FindStringSubmatch(content)
	if len(matches) > 1 {
		return matches[1]
	}
	return "unknown"
}

// validateCIAction validates CI action requirements
func (v *Validator) validateCIAction(workflowContent string, result *ValidationResult) {
	// Validate go.mod exists
	if !v.fileExists("go.mod") {
		result.Errors = append(result.Errors, ValidationIssue{
			File:     "go.mod",
			Message:  "go.mod (required for CI actions)",
			Code:     IssueTypeMissingFile,
			Severity: SeverityError,
		})
	}

	// Check golangci-lint version
	config := v.extractWorkflowConfig(workflowContent, "ci")
	expectedVersion := config.GolangciLintVersion
	if expectedVersion == "" {
		expectedVersion = "v2.1.0"
	}

	// Default 'latest' to v2.1.0
	if expectedVersion == "latest" {
		expectedVersion = "v2.1.0"
	}

	// Check if the specified version is compatible
	if strings.HasPrefix(expectedVersion, "v1") || strings.HasPrefix(expectedVersion, "1.") {
		result.Errors = append(result.Errors, ValidationIssue{
			Message:  fmt.Sprintf("go-actions/ci uses golangci-lint-action@v8 internally, which doesn't support golangci-lint %s. Use golangci-lint-version: v2.1.0 or later", expectedVersion),
			Code:     IssueTypeIncompatibleVersions,
			Expected: "v2.x.x",
			Actual:   expectedVersion,
			Severity: SeverityError,
		})
	}

	// Check golangci config version compatibility
	v.validateGolangciConfig(expectedVersion, result)
}

// validateGolangciConfig checks if golangci-lint config file version matches workflow version
func (v *Validator) validateGolangciConfig(expectedVersion string, result *ValidationResult) {
	var configFile string
	if v.fileExists(".golangci.yml") {
		configFile = ".golangci.yml"
	} else if v.fileExists(".golangci.yaml") {
		configFile = ".golangci.yaml"
	}

	if configFile == "" {
		return
	}

	configVersion := v.extractConfigVersion(configFile)
	if configVersion == "" {
		return
	}

	expectedMajor := v.getMajorVersion(expectedVersion)
	actualMajor := v.getMajorVersion(configVersion)

	if expectedMajor != "" && actualMajor != "" && expectedMajor != actualMajor {
		result.Errors = append(result.Errors, ValidationIssue{
			File:     configFile,
			Message:  fmt.Sprintf("%s has version %s but workflow expects version v%s", configFile, configVersion, expectedMajor),
			Code:     IssueTypeVersionMismatch,
			Expected: fmt.Sprintf("v%s", expectedMajor),
			Actual:   configVersion,
			Severity: SeverityError,
		})
	}
}

// validateGolangciLintAction validates direct golangci-lint-action usage
func (v *Validator) validateGolangciLintAction(content string, result *ValidationResult) {
	re := regexp.MustCompile(`uses:\s*golangci/golangci-lint-action@v(\d+)`)
	matches := re.FindAllStringSubmatch(content, -1)

	for _, match := range matches {
		if len(match) < 2 {
			continue
		}

		actionVersion, err := strconv.Atoi(match[1])
		if err != nil {
			continue
		}

		// Find the action block to extract version configuration
		actionIndex := strings.Index(content, match[0])
		if actionIndex == -1 {
			continue
		}

		// Extract the action block
		nextActionIndex := strings.Index(content[actionIndex+1:], "- uses:")
		var actionBlock string
		if nextActionIndex == -1 {
			actionBlock = content[actionIndex:]
		} else {
			actionBlock = content[actionIndex : actionIndex+1+nextActionIndex]
		}

		// Extract golangci-lint version
		versionRe := regexp.MustCompile(`version:\s*["']?([^"'\s\n]+)["']?`)
		versionMatch := versionRe.FindStringSubmatch(actionBlock)
		if len(versionMatch) < 2 {
			continue
		}

		golangciVersion := versionMatch[1]

		// Check for incompatible combinations
		if actionVersion >= 7 && (strings.HasPrefix(golangciVersion, "v1") || strings.HasPrefix(golangciVersion, "1.")) {
			var message string
			if actionVersion >= 8 {
				message = fmt.Sprintf("golangci-lint-action@v%d requires golangci-lint v2+. Found: %s", actionVersion, golangciVersion)
			} else {
				message = fmt.Sprintf("golangci-lint-action@v%d doesn't support golangci-lint %s. Use golangci-lint v2+ or downgrade to golangci-lint-action@v6", actionVersion, golangciVersion)
			}

			result.Errors = append(result.Errors, ValidationIssue{
				Message:  message,
				Code:     IssueTypeIncompatibleVersions,
				Expected: "v2.x.x",
				Actual:   golangciVersion,
				Severity: SeverityError,
			})
		}
	}
}

// validateReleaseAction validates release action requirements
func (v *Validator) validateReleaseAction(result *ValidationResult) {
	// Check for Release Please config files
	v.validateReleasePleaseConfig(result)

	// Check for GoReleaser config
	if !v.fileExists(".goreleaser.yaml") && !v.fileExists(".goreleaser.yml") {
		result.Errors = append(result.Errors, ValidationIssue{
			File:     ".goreleaser.yaml",
			Message:  ".goreleaser.yaml or .goreleaser.yml (required for release action)",
			Code:     IssueTypeMissingFile,
			Severity: SeverityError,
		})
	} else {
		v.validateGoReleaserConfig(result)
	}
}

// validateReleasePleaseConfig checks Release Please configuration files
func (v *Validator) validateReleasePleaseConfig(result *ValidationResult) {
	hasConfig := v.fileExists("release-please-config.json")
	hasManifest := v.fileExists(".release-please-manifest.json")

	if !hasConfig {
		result.Errors = append(result.Errors, ValidationIssue{
			File:     "release-please-config.json",
			Message:  "release-please-config.json is required for release action",
			Code:     IssueTypeReleasePleaseConfig,
			Severity: SeverityError,
		})
	}

	if !hasManifest {
		result.Errors = append(result.Errors, ValidationIssue{
			File:     ".release-please-manifest.json",
			Message:  ".release-please-manifest.json is required for release action",
			Code:     IssueTypeReleasePleaseConfig,
			Severity: SeverityError,
		})
	}
}

// validateGoReleaserConfig validates GoReleaser configuration content
func (v *Validator) validateGoReleaserConfig(result *ValidationResult) {
	var configPath string
	if v.fileExists(".goreleaser.yaml") {
		configPath = ".goreleaser.yaml"
	} else if v.fileExists(".goreleaser.yml") {
		configPath = ".goreleaser.yml"
	} else {
		return
	}

	content, err := os.ReadFile(filepath.Join(v.workingDir, configPath))
	if err != nil {
		result.Errors = append(result.Errors, ValidationIssue{
			File:     configPath,
			Message:  fmt.Sprintf("Invalid GoReleaser configuration: %v", err),
			Code:     IssueTypeGoReleaserConfig,
			Severity: SeverityError,
		})
		return
	}

	yamlContent := strings.ToLower(string(content))

	// Check for common misconfigurations
	if !strings.Contains(yamlContent, "builds:") && !strings.Contains(yamlContent, "builds ") {
		result.Errors = append(result.Errors, ValidationIssue{
			File:     configPath,
			Message:  "GoReleaser config missing required \"builds\" section",
			Code:     IssueTypeGoReleaserConfig,
			Severity: SeverityError,
		})
	}

	// Check for binary naming issues (only if binary is explicitly set without ProjectName)
	if strings.Contains(yamlContent, "binary:") {
		// Look for the binary value
		binaryRe := regexp.MustCompile(`binary:\s*["\']?([^"\'\n]+)["\']?`)
		binaryMatch := binaryRe.FindStringSubmatch(string(content))
		if len(binaryMatch) > 1 {
			binaryValue := strings.TrimSpace(binaryMatch[1])
			// Only warn if binary is set to a static value (not using ProjectName)
			if !strings.Contains(binaryValue, "ProjectName") {
				result.Warnings = append(result.Warnings, ValidationIssue{
					File:     configPath,
					Message:  "GoReleaser binary naming may cause issues. Consider using \"{{ .ProjectName }}\"",
					Code:     IssueTypeGoReleaserConfig,
					Severity: SeverityWarning,
				})
			}
		}
	}

	// Check for archive format compatibility
	if strings.Contains(yamlContent, "format: zip") && strings.Contains(yamlContent, "goos: linux") {
		result.Warnings = append(result.Warnings, ValidationIssue{
			File:     configPath,
			Message:  "ZIP format for Linux archives may cause compatibility issues. Consider tar.gz",
			Code:     IssueTypeGoReleaserConfig,
			Severity: SeverityWarning,
		})
	}
}

// extractWorkflowConfig extracts configuration from workflow content
func (v *Validator) extractWorkflowConfig(workflowContent, actionName string) WorkflowConfig {
	config := WorkflowConfig{}

	// Find the action usage
	pattern := fmt.Sprintf(`uses:\s*jrschumacher/go-actions/%s@`, actionName)
	re := regexp.MustCompile(pattern)
	actionMatch := re.FindStringIndex(workflowContent)
	if actionMatch == nil {
		return config
	}

	actionIndex := actionMatch[0]

	// Look for golangci-lint-version in the next several lines
	lines := strings.Split(workflowContent[actionIndex:], "\n")
	searchLines := WorkflowConfigSearchLines
	if len(lines) < searchLines {
		searchLines = len(lines)
	}
	relevantContent := strings.Join(lines[:searchLines], "\n")

	// Extract golangci-lint-version - handle both quoted and unquoted values
	versionRe := regexp.MustCompile(`golangci-lint-version:\s*["']?([^"'\s\n]+)["']?`)
	versionMatch := versionRe.FindStringSubmatch(relevantContent)
	if len(versionMatch) > 1 {
		version := versionMatch[1]
		// Remove any trailing quotes
		version = strings.Trim(version, `"'`)
		config.GolangciLintVersion = version
	}

	return config
}

// extractConfigVersion extracts the version field from a config file
func (v *Validator) extractConfigVersion(configFile string) string {
	content, err := os.ReadFile(filepath.Join(v.workingDir, configFile))
	if err != nil {
		return ""
	}

	re := regexp.MustCompile(`(?m)^version:\s*(.+)$`)
	match := re.FindStringSubmatch(string(content))
	if len(match) > 1 {
		return strings.TrimSpace(match[1])
	}

	return ""
}

// getMajorVersion extracts the major version number
func (v *Validator) getMajorVersion(version string) string {
	// Handle versions like v2, v1.54.2, 2, 1.54.2
	re := regexp.MustCompile(`^v?(\d+)`)
	match := re.FindStringSubmatch(version)
	if len(match) > 1 {
		return match[1]
	}
	return ""
}

// CheckGolangciVersion checks compatibility between workflow and config golangci-lint versions
func CheckGolangciVersion(workflowVersion, configVersion string) *ValidationIssue {
	if workflowVersion == "" || configVersion == "" {
		return nil
	}

	validator := NewValidator(".")
	workflowMajor := validator.getMajorVersion(workflowVersion)
	configMajor := validator.getMajorVersion(configVersion)

	if workflowMajor != "" && configMajor != "" && workflowMajor != configMajor {
		return &ValidationIssue{
			Message:  fmt.Sprintf("golangci-lint version mismatch: workflow expects v%s but config has version %s", workflowMajor, configVersion),
			Code:     IssueTypeVersionMismatch,
			Expected: fmt.Sprintf("v%s", workflowMajor),
			Actual:   configVersion,
			Severity: SeverityError,
		}
	}

	return nil
}

// findWorkflowFiles finds all workflow files matching the patterns
func (v *Validator) findWorkflowFiles(patterns []string) ([]string, error) {
	if len(patterns) == 0 {
		patterns = []string{".github/workflows/*.yaml", ".github/workflows/*.yml"}
	}

	var files []string
	seen := make(map[string]bool)

	for _, pattern := range patterns {
		// Convert to absolute path
		absPattern := pattern
		if !filepath.IsAbs(pattern) {
			absPattern = filepath.Join(v.workingDir, pattern)
		}

		matches, err := filepath.Glob(absPattern)
		if err != nil {
			return nil, fmt.Errorf("failed to glob pattern %s: %w", pattern, err)
		}

		for _, match := range matches {
			if !seen[match] {
				files = append(files, match)
				seen[match] = true
			}
		}
	}

	return files, nil
}

// fileExists checks if a file exists in the working directory
func (v *Validator) fileExists(filePath string) bool {
	fullPath := filepath.Join(v.workingDir, filePath)
	_, err := os.Stat(fullPath)
	return err == nil
}

// isGoActionsRepo checks if this is the go-actions repository itself
func (v *Validator) isGoActionsRepo() bool {
	return v.fileExists("ci/action.yaml") &&
		v.fileExists("release/action.yaml") &&
		v.fileExists("self-validate/action.yaml")
}
