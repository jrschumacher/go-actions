package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"

	"gopkg.in/yaml.v3"
)

// Load reads and parses a .go-actions.yaml file
func Load(path string) (*Config, error) {
	// Start with defaults
	cfg := DefaultConfig()

	// If no config file exists, return defaults
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return cfg, nil
	}

	// Read the file
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	// Parse YAML
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// Validate version
	if cfg.Version != 1 {
		return nil, fmt.Errorf("unsupported config version: %d (expected 1)", cfg.Version)
	}

	// Apply defaults for unset boolean pointers
	if cfg.CI.Test.Enabled == nil {
		trueVal := true
		cfg.CI.Test.Enabled = &trueVal
	}
	if cfg.CI.Test.Coverage.Enabled == nil {
		trueVal := true
		cfg.CI.Test.Coverage.Enabled = &trueVal
	}

	return cfg, nil
}

// FindConfigFile searches for .go-actions.yaml in current and parent directories
func FindConfigFile() (string, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("failed to get current directory: %w", err)
	}

	// Search up the directory tree
	dir := cwd
	for {
		configPath := filepath.Join(dir, ".go-actions.yaml")
		if _, err := os.Stat(configPath); err == nil {
			return configPath, nil
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			// Reached root without finding config
			break
		}
		dir = parent
	}

	// No config found, return default path
	return filepath.Join(cwd, ".go-actions.yaml"), nil
}

// ApplyEnvOverrides applies GO_ACTIONS_* environment variable overrides to the config.
// Only non-empty env vars override config values. This establishes the precedence:
// env vars (from action inputs) > config file > defaults.
func ApplyEnvOverrides(cfg *Config) {
	if v := os.Getenv("GO_ACTIONS_TEST_ARGS"); v != "" {
		cfg.CI.Test.Args = v
	}
	if v := os.Getenv("GO_ACTIONS_LINT_ARGS"); v != "" {
		cfg.CI.Lint.Args = v
	}
	if v := os.Getenv("GO_ACTIONS_BENCHMARK_ARGS"); v != "" {
		cfg.CI.Benchmark.Args = v
	}
	if v := os.Getenv("GO_ACTIONS_BENCHMARK_COUNT"); v != "" {
		if count, err := strconv.Atoi(v); err == nil && count > 0 {
			cfg.CI.Benchmark.Count = count
		}
	}
	if v := os.Getenv("GO_ACTIONS_SECURITY_ARGS"); v != "" {
		cfg.CI.Security.Args = v
	}
}

// Save writes a config to a file
func Save(cfg *Config, path string) error {
	data, err := yaml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}
