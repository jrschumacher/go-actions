package validate

import (
	"os"
	"path/filepath"
	"testing"
)

func TestValidateProject(t *testing.T) {
	// Create temp directory
	tmpDir := t.TempDir()

	// Test missing go.mod
	v := New(Options{WorkingDir: tmpDir})
	result := v.Validate()

	if result.IsValid {
		t.Error("Expected validation to fail without go.mod")
	}

	hasGoModError := false
	for _, err := range result.Errors {
		if err == "Missing go.mod file" {
			hasGoModError = true
			break
		}
	}
	if !hasGoModError {
		t.Error("Expected 'Missing go.mod file' error")
	}

	// Create go.mod
	if err := os.WriteFile(filepath.Join(tmpDir, "go.mod"), []byte("module test\n\ngo 1.21\n"), 0644); err != nil {
		t.Fatal(err)
	}

	// Create a Go file
	if err := os.WriteFile(filepath.Join(tmpDir, "main.go"), []byte("package main\n\nfunc main() {}\n"), 0644); err != nil {
		t.Fatal(err)
	}

	// Test with go.mod present
	result = v.Validate()
	if !result.IsValid {
		t.Errorf("Expected validation to pass with go.mod and source files, got errors: %v", result.Errors)
	}
}

func TestValidateGolangciLint(t *testing.T) {
	tmpDir := t.TempDir()

	// Create required project files
	os.WriteFile(filepath.Join(tmpDir, "go.mod"), []byte("module test\n\ngo 1.21\n"), 0644)
	os.WriteFile(filepath.Join(tmpDir, "main.go"), []byte("package main\n\nfunc main() {}\n"), 0644)

	// Test without config (should pass with warning)
	v := New(Options{WorkingDir: tmpDir})
	result := v.Validate()
	if !result.IsValid {
		t.Errorf("Expected validation to pass without golangci config, got errors: %v", result.Errors)
	}

	// Test with missing version
	os.WriteFile(filepath.Join(tmpDir, ".golangci.yml"), []byte("linters:\n  enable:\n    - gofmt\n"), 0644)
	result = v.Validate()
	if result.IsValid {
		t.Error("Expected validation to fail without version field")
	}

	// Test with valid config
	os.WriteFile(filepath.Join(tmpDir, ".golangci.yml"), []byte("version: 2\n\nlinters:\n  enable:\n    - gofmt\n"), 0644)
	result = v.Validate()
	if !result.IsValid {
		t.Errorf("Expected validation to pass with valid config, got errors: %v", result.Errors)
	}

	// Test with v1 schema fields
	os.WriteFile(filepath.Join(tmpDir, ".golangci.yml"), []byte("version: 2\n\nlinters-settings:\n  gofmt:\n    simplify: true\n"), 0644)
	result = v.Validate()
	if result.IsValid {
		t.Error("Expected validation to fail with v1 schema fields")
	}
}

func TestValidateGolangciLintFix(t *testing.T) {
	tmpDir := t.TempDir()

	// Create required project files
	os.WriteFile(filepath.Join(tmpDir, "go.mod"), []byte("module test\n\ngo 1.21\n"), 0644)
	os.WriteFile(filepath.Join(tmpDir, "main.go"), []byte("package main\n\nfunc main() {}\n"), 0644)

	// Create config without version
	configPath := filepath.Join(tmpDir, ".golangci.yml")
	os.WriteFile(configPath, []byte("linters:\n  enable:\n    - gofmt\n"), 0644)

	// Validate with fix
	v := New(Options{WorkingDir: tmpDir, Fix: true})
	result := v.Validate()

	if !result.IsValid {
		t.Errorf("Expected validation to pass after fix, got errors: %v", result.Errors)
	}

	// Check that version was added
	data, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatal(err)
	}

	if string(data[:10]) != "version: 2" {
		t.Errorf("Expected 'version: 2' at start of file, got: %s", string(data[:20]))
	}
}
