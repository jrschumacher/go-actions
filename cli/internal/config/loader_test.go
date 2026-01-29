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
