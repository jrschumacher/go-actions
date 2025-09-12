package cli

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
	"github.com/jrschumacher/go-actions/internal/detect"
	"github.com/jrschumacher/go-actions/internal/template"
)

var initCmd = &cobra.Command{
	Use:   "init [directory]",
	Short: "Initialize GitHub Actions workflow for a Go project",
	Long: `Analyzes your Go project and generates an optimized GitHub Actions workflow.

This command will:
- Detect your Go version from go.mod
- Identify if you have tests and benchmarks  
- Check for existing golangci-lint configuration
- Generate a .github/workflows/ci.yml file

Examples:
  go-actions init                    # Initialize in current directory
  go-actions init ./my-project       # Initialize in specific directory
  go-actions init --force            # Overwrite existing workflow`,
	Args: cobra.MaximumNArgs(1),
	RunE: runInit,
}

var (
	force   bool
	dryRun  bool
)

func init() {
	initCmd.Flags().BoolVarP(&force, "force", "f", false, "Overwrite existing workflow file")
	initCmd.Flags().BoolVar(&dryRun, "dry-run", false, "Show what would be generated without creating files")
}

func runInit(cmd *cobra.Command, args []string) error {
	// Determine target directory
	targetDir := "."
	if len(args) > 0 {
		targetDir = args[0]
	}

	// Convert to absolute path
	absDir, err := filepath.Abs(targetDir)
	if err != nil {
		return fmt.Errorf("failed to resolve directory path: %w", err)
	}

	// Detect project configuration
	fmt.Printf("🔍 Analyzing Go project in %s...\n", absDir)
	config, err := detect.DetectProject(absDir)
	if err != nil {
		return fmt.Errorf("failed to detect project configuration: %w", err)
	}

	// Display detected configuration
	displayProjectInfo(config)

	// Generate workflow
	workflow, err := template.GenerateWorkflow(config)
	if err != nil {
		return fmt.Errorf("failed to generate workflow: %w", err)
	}

	// Determine output path
	workflowPath := filepath.Join(absDir, template.GetWorkflowPath())
	workflowDir := filepath.Join(absDir, template.GetWorkflowDir())

	if dryRun {
		fmt.Printf("\n📄 Generated workflow (dry-run):\n")
		fmt.Println("---")
		fmt.Println(workflow)
		fmt.Println("---")
		fmt.Printf("\nWould be written to: %s\n", workflowPath)
		return nil
	}

	// Check if workflow already exists
	if fileExists(workflowPath) && !force {
		return fmt.Errorf("workflow file already exists at %s (use --force to overwrite)", workflowPath)
	}

	// Create workflow directory if it doesn't exist
	if err := os.MkdirAll(workflowDir, 0755); err != nil {
		return fmt.Errorf("failed to create workflow directory: %w", err)
	}

	// Write workflow file
	if err := os.WriteFile(workflowPath, []byte(workflow), 0644); err != nil {
		return fmt.Errorf("failed to write workflow file: %w", err)
	}

	fmt.Printf("\n✅ Successfully created GitHub Actions workflow at %s\n", workflowPath)
	fmt.Println("\nNext steps:")
	fmt.Println("  1. Review the generated workflow")
	fmt.Println("  2. Commit and push to trigger CI")
	fmt.Println("  3. Use 'go-actions validate' to check for issues")

	return nil
}

func displayProjectInfo(config *detect.ProjectConfig) {
	fmt.Printf("\n📊 Project Configuration:\n")
	fmt.Printf("  Go Version: %s\n", config.GoVersion)
	
	if config.IsModule {
		fmt.Printf("  Module: %s\n", config.ModulePath)
	}

	if config.HasWorkspace {
		fmt.Printf("  Workspace: detected (go.work)\n")
	}

	fmt.Printf("  Tests: %t\n", config.HasTests)
	fmt.Printf("  Benchmarks: %t\n", config.HasBenchmarks)

	if config.HasLintConfig {
		fmt.Printf("  Lint Config: %s\n", config.LintConfigPath)
	} else {
		fmt.Printf("  Lint Config: using defaults\n")
	}

	if len(config.Frameworks) > 0 {
		fmt.Printf("  Frameworks: %v\n", config.Frameworks)
	}
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}