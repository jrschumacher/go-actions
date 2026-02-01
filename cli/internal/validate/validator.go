package validate

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

// Validator validates project configuration
type Validator struct {
	workingDir string
	fix        bool
	quiet      bool
}

// New creates a new Validator
func New(opts Options) *Validator {
	workingDir := opts.WorkingDir
	if workingDir == "" {
		workingDir = "."
	}
	return &Validator{
		workingDir: workingDir,
		fix:        opts.Fix,
		quiet:      opts.Quiet,
	}
}

// log prints a message if not in quiet mode
func (v *Validator) log(format string, args ...interface{}) {
	if !v.quiet {
		fmt.Printf(format+"\n", args...)
	}
}

// Validate runs all validations
func (v *Validator) Validate() Result {
	result := Result{IsValid: true}

	// Validate project structure
	v.validateProject(&result)

	// Validate golangci-lint config
	v.validateGolangciLint(&result)

	// Validate workflow files
	v.validateWorkflows(&result)

	// Validate release config (if applicable)
	v.validateReleaseConfig(&result)

	return result
}

func (v *Validator) fileExists(path string) bool {
	_, err := os.Stat(filepath.Join(v.workingDir, path))
	return err == nil
}

func (v *Validator) validateProject(result *Result) {
	v.log("🔍 Validating Go project structure...")

	// Check for go.mod
	if !v.fileExists("go.mod") {
		result.IsValid = false
		result.Errors = append(result.Errors, "Missing go.mod file")
	} else {
		v.log("  ✅ go.mod found")
	}

	// Check for Go source files
	goFiles, _ := filepath.Glob(filepath.Join(v.workingDir, "*.go"))
	subGoFiles, _ := filepath.Glob(filepath.Join(v.workingDir, "**/*.go"))
	allGoFiles := append(goFiles, subGoFiles...)
	
	if len(allGoFiles) == 0 {
		result.IsValid = false
		result.Errors = append(result.Errors, "No Go source files found")
	} else {
		v.log("  ✅ Go source files found")
	}

	// Check for test files (warning only)
	testFiles, _ := filepath.Glob(filepath.Join(v.workingDir, "*_test.go"))
	subTestFiles, _ := filepath.Glob(filepath.Join(v.workingDir, "**/*_test.go"))
	allTestFiles := append(testFiles, subTestFiles...)

	if len(allTestFiles) == 0 {
		result.Warnings = append(result.Warnings, "No test files found (recommended for test job)")
	} else {
		v.log("  ✅ Test files found")
	}
}

func (v *Validator) validateGolangciLint(result *Result) {
	v.log("\n🔍 Validating golangci-lint configuration...")

	// Find config file
	configPath := ""
	for _, name := range []string{".golangci.yml", ".golangci.yaml"} {
		if v.fileExists(name) {
			configPath = filepath.Join(v.workingDir, name)
			break
		}
	}

	if configPath == "" {
		result.Warnings = append(result.Warnings, "No .golangci.yml or .golangci.yaml found (optional but recommended)")
		return
	}

	v.log("  ✅ golangci-lint configuration found")

	// Parse config
	data, err := os.ReadFile(configPath)
	if err != nil {
		result.IsValid = false
		result.Errors = append(result.Errors, fmt.Sprintf("Failed to read golangci-lint config: %v", err))
		return
	}

	var config GolangciConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		result.IsValid = false
		result.Errors = append(result.Errors, fmt.Sprintf("Invalid YAML in golangci-lint config: %v", err))
		return
	}

	// Check version field
	if config.Version == nil {
		result.IsValid = false
		result.Errors = append(result.Errors, "golangci-lint config missing required 'version: 2' field")
		
		if v.fix {
			if v.fixGolangciVersion(configPath, data) {
				v.log("  🔧 Fixed: Added 'version: 2' to config")
				result.IsValid = true
				// Remove the error we just added
				result.Errors = result.Errors[:len(result.Errors)-1]
			}
		}
		return
	}

	// Validate version value
	versionStr := fmt.Sprintf("%v", config.Version)
	if versionStr != "2" {
		result.IsValid = false
		
		if versionStr == "v2" || versionStr == "V2" {
			result.Errors = append(result.Errors, "golangci-lint config has 'version: v2' - remove the 'v' prefix, use 'version: 2'")
		} else if versionStr == "1" || versionStr == "v1" {
			result.Errors = append(result.Errors, "golangci-lint config uses version 1 - upgrade to 'version: 2'")
		} else {
			result.Errors = append(result.Errors, fmt.Sprintf("golangci-lint config has unsupported version: %s (expected: 2)", versionStr))
		}
		return
	}

	v.log("  ✅ version: 2 present")

	// Check for v1 schema fields
	if config.LintersSettings != nil {
		result.IsValid = false
		result.Errors = append(result.Errors, "v2 schema error: 'linters-settings' is not valid in v2, use 'linters.settings' instead")
	}

	if config.Issues != nil && len(config.Issues.ExcludeRules) > 0 {
		result.IsValid = false
		result.Errors = append(result.Errors, "v2 schema error: 'issues.exclude-rules' is not valid in v2, use 'linters.exclusions.rules' instead")
	}

	// Check for deprecated settings
	if config.Linters != nil {
		if config.Linters.EnableAll {
			result.Warnings = append(result.Warnings, "'linters.enable-all' is deprecated in v2, use 'linters.preset: all' instead")
		}
		if config.Linters.DisableAll {
			result.Warnings = append(result.Warnings, "'linters.disable-all' is deprecated in v2, use 'linters.preset: none' instead")
		}
	}

	if result.IsValid {
		v.log("  ✅ golangci-lint configuration is valid")
	}
}

func (v *Validator) fixGolangciVersion(configPath string, data []byte) bool {
	// Prepend version: 2 to the file
	newContent := "version: 2\n\n" + string(data)
	if err := os.WriteFile(configPath, []byte(newContent), 0644); err != nil {
		fmt.Printf("  ❌ Failed to fix config: %v\n", err)
		return false
	}
	return true
}

func (v *Validator) validateWorkflows(result *Result) {
	v.log("\n🔍 Validating GitHub workflow files...")

	workflowDir := filepath.Join(v.workingDir, ".github", "workflows")
	if !v.fileExists(".github/workflows") {
		result.Warnings = append(result.Warnings, "No .github/workflows directory found")
		return
	}

	// Find workflow files
	yamlFiles, _ := filepath.Glob(filepath.Join(workflowDir, "*.yaml"))
	ymlFiles, _ := filepath.Glob(filepath.Join(workflowDir, "*.yml"))
	workflowFiles := append(yamlFiles, ymlFiles...)

	if len(workflowFiles) == 0 {
		result.Warnings = append(result.Warnings, "No workflow files found in .github/workflows")
		return
	}

	v.log("  Found %d workflow file(s)", len(workflowFiles))

	// Check for go-actions usage
	goActionsPattern := regexp.MustCompile(`uses:\s*jrschumacher/go-actions/(ci|release|self-validate)@`)
	actionsFound := make(map[string]bool)

	for _, wf := range workflowFiles {
		data, err := os.ReadFile(wf)
		if err != nil {
			continue
		}

		matches := goActionsPattern.FindAllStringSubmatch(string(data), -1)
		for _, match := range matches {
			if len(match) > 1 {
				actionsFound[match[1]] = true
			}
		}
	}

	if len(actionsFound) == 0 {
		v.log("  ℹ️  No go-actions usage detected in workflows")
		return
	}

	actions := make([]string, 0, len(actionsFound))
	for action := range actionsFound {
		actions = append(actions, action)
	}
	v.log("  ✅ go-actions detected: %s", strings.Join(actions, ", "))

	// If release action is used, check for required files
	if actionsFound["release"] {
		v.validateReleaseConfig(result)
	}
}

func (v *Validator) validateReleaseConfig(result *Result) {
	v.log("\n🔍 Validating release configuration...")

	// Check Release Please config
	if !v.fileExists(".release-please-config.json") {
		result.Warnings = append(result.Warnings, "Missing .release-please-config.json (required for release action)")
	} else {
		v.log("  ✅ .release-please-config.json found")
	}

	if !v.fileExists(".release-please-manifest.json") {
		result.Warnings = append(result.Warnings, "Missing .release-please-manifest.json (required for release action)")
	} else {
		v.log("  ✅ .release-please-manifest.json found")
	}

	// Check GoReleaser config
	if !v.fileExists(".goreleaser.yaml") && !v.fileExists(".goreleaser.yml") {
		result.Warnings = append(result.Warnings, "Missing .goreleaser.yaml (required for release action)")
	} else {
		v.log("  ✅ GoReleaser configuration found")
	}
}
