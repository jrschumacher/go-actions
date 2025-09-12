package cli

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
	"github.com/jrschumacher/go-actions/internal/validate"
)

var validateCmd = &cobra.Command{
	Use:   "validate [workflow-file]",
	Short: "Validate GitHub Actions workflow for Go projects",
	Long: `Validates your GitHub Actions workflow file for common issues and best practices.

This command checks for:
- Proper go-actions usage
- Common configuration mistakes
- Missing required inputs
- Deprecated patterns

Examples:
  go-actions validate                              # Validate .github/workflows/ci.yml
  go-actions validate .github/workflows/ci.yml     # Validate specific file
  go-actions validate --all                       # Validate all workflow files`,
	Args: cobra.MaximumNArgs(1),
	RunE: runValidate,
}

var validateAll bool

func init() {
	validateCmd.Flags().BoolVar(&validateAll, "all", false, "Validate all workflow files in .github/workflows/")
}

func runValidate(cmd *cobra.Command, args []string) error {
	var filesToValidate []string

	if validateAll {
		// Find all workflow files
		workflowDir := ".github/workflows"
		if !fileExists(workflowDir) {
			return fmt.Errorf("no .github/workflows directory found")
		}

		entries, err := os.ReadDir(workflowDir)
		if err != nil {
			return fmt.Errorf("failed to read workflows directory: %w", err)
		}

		for _, entry := range entries {
			if !entry.IsDir() && (strings.HasSuffix(entry.Name(), ".yml") || strings.HasSuffix(entry.Name(), ".yaml")) {
				filesToValidate = append(filesToValidate, filepath.Join(workflowDir, entry.Name()))
			}
		}

		if len(filesToValidate) == 0 {
			return fmt.Errorf("no workflow files found in .github/workflows/")
		}
	} else {
		// Validate specific file or default
		workflowFile := ".github/workflows/ci.yml"
		if len(args) > 0 {
			workflowFile = args[0]
		}

		if !fileExists(workflowFile) {
			// Try .yaml extension
			if workflowFile == ".github/workflows/ci.yml" {
				altFile := ".github/workflows/ci.yaml"
				if fileExists(altFile) {
					workflowFile = altFile
				} else {
					return fmt.Errorf("no workflow file found at %s (did you run 'go-actions init' first?)", workflowFile)
				}
			} else {
				return fmt.Errorf("workflow file not found: %s", workflowFile)
			}
		}

		filesToValidate = append(filesToValidate, workflowFile)
	}

	// Validate each file
	var hasErrors bool
	for _, file := range filesToValidate {
		fmt.Printf("🔍 Validating %s...\n", file)
		
		errors := validateWorkflowFile(file)
		if len(errors) == 0 {
			fmt.Printf("✅ %s is valid\n\n", file)
		} else {
			fmt.Printf("❌ Found %d issue(s) in %s:\n", len(errors), file)
			for _, err := range errors {
				fmt.Printf("  • %s\n", err)
			}
			fmt.Println()
			hasErrors = true
		}
	}

	if hasErrors {
		return fmt.Errorf("validation failed - see issues above")
	}

	fmt.Println("🎉 All workflow files are valid!")
	return nil
}

func validateWorkflowFile(path string) []string {
	content, err := os.ReadFile(path)
	if err != nil {
		return []string{fmt.Sprintf("failed to read file: %v", err)}
	}

	var workflow validate.GitHubWorkflow
	if err := yaml.Unmarshal(content, &workflow); err != nil {
		return []string{fmt.Sprintf("invalid YAML: %v", err)}
	}

	return validate.ValidateWorkflow(&workflow)
}