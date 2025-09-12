package cli

import (
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "go-actions",
	Short: "Go Actions CLI - Generate and validate GitHub Actions workflows for Go projects",
	Long: `go-actions is a CLI tool that helps you set up and maintain GitHub Actions workflows
for Go projects. It can detect your project structure and generate optimized CI configurations.

Examples:
  go-actions init               # Generate workflow for current project
  go-actions validate           # Validate existing workflow
  go-actions run test           # Run tests locally
  go-actions run lint           # Run linting locally`,
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.AddCommand(initCmd)
	rootCmd.AddCommand(validateCmd)
	rootCmd.AddCommand(runCmd)
}