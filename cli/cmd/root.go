package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var (
	cfgFile string
	version = "dev" // Will be set by goreleaser
)

// rootCmd represents the base command
var rootCmd = &cobra.Command{
	Use:   "go-actions",
	Short: "Local CLI for go-actions CI checks",
	Long: `go-actions is a CLI tool that runs the same checks as your CI pipeline locally.

This enables local/CI parity and reduces wasted CI minutes by catching issues before pushing.`,
}

// Execute runs the root command
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is .go-actions.yaml)")
}
