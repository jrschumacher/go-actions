package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoad(t *testing.T) {
	tests := []struct {
		name      string
		content   string
		wantErr   bool
		checkFunc func(*testing.T, *Config)
	}{
		{
			name:    "non-existent file returns defaults",
			content: "",
			wantErr: false,
			checkFunc: func(t *testing.T, cfg *Config) {
				if cfg.Version != 1 {
					t.Errorf("expected version 1, got %d", cfg.Version)
				}
				if cfg.CI.Test.Enabled == nil || !*cfg.CI.Test.Enabled {
					t.Error("expected test to be enabled by default")
				}
			},
		},
		{
			name: "valid config file",
			content: `version: 1
ci:
  test:
    enabled: true
    coverage:
      threshold: 90
  lint:
    enabled: true
    version: v2.0.2
`,
			wantErr: false,
			checkFunc: func(t *testing.T, cfg *Config) {
				if cfg.CI.Test.Coverage.Threshold != 90 {
					t.Errorf("expected threshold 90, got %f", cfg.CI.Test.Coverage.Threshold)
				}
				if cfg.CI.Lint.Version != "v2.0.2" {
					t.Errorf("expected lint version v2.0.2, got %s", cfg.CI.Lint.Version)
				}
			},
		},
		{
			name: "invalid version",
			content: `version: 2
ci:
  test:
    enabled: true
`,
			wantErr: true,
		},
		{
			name:    "invalid yaml",
			content: "invalid: yaml: content: [",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var path string
			if tt.content != "" {
				// Create temp file
				tmpDir := t.TempDir()
				path = filepath.Join(tmpDir, ".go-actions.yaml")
				if err := os.WriteFile(path, []byte(tt.content), 0644); err != nil {
					t.Fatalf("failed to create test file: %v", err)
				}
			} else {
				path = filepath.Join(t.TempDir(), "nonexistent.yaml")
			}

			cfg, err := Load(path)
			if (err != nil) != tt.wantErr {
				t.Errorf("Load() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr && tt.checkFunc != nil {
				tt.checkFunc(t, cfg)
			}
		})
	}
}

func TestSave(t *testing.T) {
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, ".go-actions.yaml")

	cfg := DefaultConfig()
	cfg.CI.Test.Coverage.Threshold = 95

	if err := Save(cfg, path); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	// Load it back
	loaded, err := Load(path)
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if loaded.CI.Test.Coverage.Threshold != 95 {
		t.Errorf("expected threshold 95, got %f", loaded.CI.Test.Coverage.Threshold)
	}
}

func TestApplyEnvOverrides(t *testing.T) {
	// Helper to clear all GO_ACTIONS_* env vars
	envKeys := []string{
		"GO_ACTIONS_TEST_ARGS",
		"GO_ACTIONS_LINT_ARGS",
		"GO_ACTIONS_BENCHMARK_ARGS",
		"GO_ACTIONS_BENCHMARK_COUNT",
		"GO_ACTIONS_SECURITY_ARGS",
	}

	tests := []struct {
		name    string
		envVars map[string]string
		initial func() *Config
		check   func(*testing.T, *Config)
	}{
		{
			name:    "no env vars set leaves config unchanged",
			envVars: map[string]string{},
			initial: DefaultConfig,
			check: func(t *testing.T, cfg *Config) {
				if cfg.CI.Test.Args != "-v -race ./..." {
					t.Errorf("expected default test args, got %s", cfg.CI.Test.Args)
				}
				if cfg.CI.Benchmark.Count != 5 {
					t.Errorf("expected default benchmark count 5, got %d", cfg.CI.Benchmark.Count)
				}
			},
		},
		{
			name: "test args override",
			envVars: map[string]string{
				"GO_ACTIONS_TEST_ARGS": "-v -count=2 ./...",
			},
			initial: DefaultConfig,
			check: func(t *testing.T, cfg *Config) {
				if cfg.CI.Test.Args != "-v -count=2 ./..." {
					t.Errorf("expected overridden test args, got %s", cfg.CI.Test.Args)
				}
			},
		},
		{
			name: "lint args override",
			envVars: map[string]string{
				"GO_ACTIONS_LINT_ARGS": "run --timeout=10m ./...",
			},
			initial: DefaultConfig,
			check: func(t *testing.T, cfg *Config) {
				if cfg.CI.Lint.Args != "run --timeout=10m ./..." {
					t.Errorf("expected overridden lint args, got %s", cfg.CI.Lint.Args)
				}
			},
		},
		{
			name: "benchmark count valid integer",
			envVars: map[string]string{
				"GO_ACTIONS_BENCHMARK_COUNT": "10",
			},
			initial: DefaultConfig,
			check: func(t *testing.T, cfg *Config) {
				if cfg.CI.Benchmark.Count != 10 {
					t.Errorf("expected count 10, got %d", cfg.CI.Benchmark.Count)
				}
			},
		},
		{
			name: "benchmark count invalid string ignored",
			envVars: map[string]string{
				"GO_ACTIONS_BENCHMARK_COUNT": "not-a-number",
			},
			initial: DefaultConfig,
			check: func(t *testing.T, cfg *Config) {
				if cfg.CI.Benchmark.Count != 5 {
					t.Errorf("invalid count should not override default, got %d", cfg.CI.Benchmark.Count)
				}
			},
		},
		{
			name: "benchmark count zero ignored",
			envVars: map[string]string{
				"GO_ACTIONS_BENCHMARK_COUNT": "0",
			},
			initial: DefaultConfig,
			check: func(t *testing.T, cfg *Config) {
				if cfg.CI.Benchmark.Count != 5 {
					t.Errorf("zero count should not override default, got %d", cfg.CI.Benchmark.Count)
				}
			},
		},
		{
			name: "benchmark count negative ignored",
			envVars: map[string]string{
				"GO_ACTIONS_BENCHMARK_COUNT": "-3",
			},
			initial: DefaultConfig,
			check: func(t *testing.T, cfg *Config) {
				if cfg.CI.Benchmark.Count != 5 {
					t.Errorf("negative count should not override default, got %d", cfg.CI.Benchmark.Count)
				}
			},
		},
		{
			name: "env vars override config file values",
			envVars: map[string]string{
				"GO_ACTIONS_SECURITY_ARGS": "-tags integration ./cmd/...",
			},
			initial: func() *Config {
				cfg := DefaultConfig()
				cfg.CI.Security.Args = "./internal/..." // simulate config file value
				return cfg
			},
			check: func(t *testing.T, cfg *Config) {
				if cfg.CI.Security.Args != "-tags integration ./cmd/..." {
					t.Errorf("env should override config file, got %s", cfg.CI.Security.Args)
				}
			},
		},
		{
			name: "all overrides at once",
			envVars: map[string]string{
				"GO_ACTIONS_TEST_ARGS":       "-short ./...",
				"GO_ACTIONS_LINT_ARGS":       "run ./cmd/...",
				"GO_ACTIONS_BENCHMARK_ARGS":  "-bench=BenchmarkFoo -benchmem",
				"GO_ACTIONS_BENCHMARK_COUNT": "3",
				"GO_ACTIONS_SECURITY_ARGS":   "./pkg/...",
			},
			initial: DefaultConfig,
			check: func(t *testing.T, cfg *Config) {
				if cfg.CI.Test.Args != "-short ./..." {
					t.Errorf("test args: got %s", cfg.CI.Test.Args)
				}
				if cfg.CI.Lint.Args != "run ./cmd/..." {
					t.Errorf("lint args: got %s", cfg.CI.Lint.Args)
				}
				if cfg.CI.Benchmark.Args != "-bench=BenchmarkFoo -benchmem" {
					t.Errorf("benchmark args: got %s", cfg.CI.Benchmark.Args)
				}
				if cfg.CI.Benchmark.Count != 3 {
					t.Errorf("benchmark count: got %d", cfg.CI.Benchmark.Count)
				}
				if cfg.CI.Security.Args != "./pkg/..." {
					t.Errorf("security args: got %s", cfg.CI.Security.Args)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Clear all env vars
			for _, key := range envKeys {
				os.Unsetenv(key)
			}
			// Set test-specific env vars
			for k, v := range tt.envVars {
				t.Setenv(k, v)
			}

			cfg := tt.initial()
			ApplyEnvOverrides(cfg)
			tt.check(t, cfg)
		})
	}
}
