package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var hooksCmd = &cobra.Command{
	Use:   "hooks",
	Short: "Manage git hooks (stub for future implementation)",
	Long: `Manage git hooks for running checks automatically.

This command is a stub and will be implemented in a future version.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		return fmt.Errorf("hooks command not yet implemented")
	},
}

func init() {
	rootCmd.AddCommand(hooksCmd)
}
