package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/jrschumacher/go-actions/cli/internal/validate"
	"github.com/spf13/cobra"
)

var (
	validateFixFlag    bool
	validateFormatFlag string
	validateQuietFlag  bool
)

var validateCmd = &cobra.Command{
	Use:   "validate",
	Short: "Validate project configuration",
	Long: `Validate project structure and configuration for go-actions.

Checks:
  - Go project structure (go.mod, source files)
  - golangci-lint configuration (version: 2, schema)
  - Workflow files for go-actions usage
  - Release Please configuration (if release action used)
  - GoReleaser configuration (if release action used)

Use --fix to auto-fix issues where possible (e.g., add version: 2 to golangci-lint config).`,
	RunE: runValidate,
}

func init() {
	rootCmd.AddCommand(validateCmd)
	validateCmd.Flags().BoolVar(&validateFixFlag, "fix", false, "auto-fix issues where possible")
	validateCmd.Flags().StringVar(&validateFormatFlag, "format", "text", "output format (text, json)")
	validateCmd.Flags().BoolVarP(&validateQuietFlag, "quiet", "q", false, "suppress progress output")
}

func runValidate(cmd *cobra.Command, args []string) error {
	v := validate.New(validate.Options{
		WorkingDir: ".",
		Fix:        validateFixFlag,
		Quiet:      validateQuietFlag || validateFormatFlag == "json",
	})

	result := v.Validate()

	// JSON output
	if validateFormatFlag == "json" {
		output := map[string]interface{}{
			"valid":    result.IsValid,
			"errors":   result.Errors,
			"warnings": result.Warnings,
		}
		data, _ := json.Marshal(output)
		fmt.Println(string(data))
		if !result.IsValid {
			os.Exit(1)
		}
		return nil
	}

	// Text output
	if result.IsValid {
		fmt.Println("✅ All validations passed!")
		return nil
	}

	fmt.Printf("❌ Validation failed with %d error(s):\n", len(result.Errors))
	for _, err := range result.Errors {
		fmt.Printf("  - %s\n", err)
	}

	if len(result.Warnings) > 0 {
		fmt.Printf("\n⚠️  %d warning(s):\n", len(result.Warnings))
		for _, warn := range result.Warnings {
			fmt.Printf("  - %s\n", warn)
		}
	}

	os.Exit(1)
	return nil
}
