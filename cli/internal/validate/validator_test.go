package validate

import (
	"os"
	"path/filepath"
	"strings"
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
	if err := os.WriteFile(filepath.Join(tmpDir, "go.mod"), []byte("module test\n\ngo 1.21\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(tmpDir, "main.go"), []byte("package main\n\nfunc main() {}\n"), 0644); err != nil {
		t.Fatal(err)
	}

	// Test without config (should pass with warning)
	v := New(Options{WorkingDir: tmpDir})
	result := v.Validate()
	if !result.IsValid {
		t.Errorf("Expected validation to pass without golangci config, got errors: %v", result.Errors)
	}

	// Test with missing version
	if err := os.WriteFile(filepath.Join(tmpDir, ".golangci.yml"), []byte("linters:\n  enable:\n    - gofmt\n"), 0644); err != nil {
		t.Fatal(err)
	}
	result = v.Validate()
	if result.IsValid {
		t.Error("Expected validation to fail without version field")
	}

	// Test with valid config
	if err := os.WriteFile(filepath.Join(tmpDir, ".golangci.yml"), []byte("version: 2\n\nlinters:\n  enable:\n    - gofmt\n"), 0644); err != nil {
		t.Fatal(err)
	}
	result = v.Validate()
	if !result.IsValid {
		t.Errorf("Expected validation to pass with valid config, got errors: %v", result.Errors)
	}

	// Test with v1 schema fields
	if err := os.WriteFile(filepath.Join(tmpDir, ".golangci.yml"), []byte("version: 2\n\nlinters-settings:\n  gofmt:\n    simplify: true\n"), 0644); err != nil {
		t.Fatal(err)
	}
	result = v.Validate()
	if result.IsValid {
		t.Error("Expected validation to fail with v1 schema fields")
	}
}

func TestValidateGolangciLintFix(t *testing.T) {
	tmpDir := t.TempDir()

	// Create required project files
	if err := os.WriteFile(filepath.Join(tmpDir, "go.mod"), []byte("module test\n\ngo 1.21\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(tmpDir, "main.go"), []byte("package main\n\nfunc main() {}\n"), 0644); err != nil {
		t.Fatal(err)
	}

	// Create config without version
	configPath := filepath.Join(tmpDir, ".golangci.yml")
	if err := os.WriteFile(configPath, []byte("linters:\n  enable:\n    - gofmt\n"), 0644); err != nil {
		t.Fatal(err)
	}

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

func TestValidateReleaseConfigAcceptsStandardFilename(t *testing.T) {
	tmpDir := t.TempDir()

	writeReleaseValidationProject(t, tmpDir)

	if err := os.WriteFile(filepath.Join(tmpDir, "release-please-config.json"), []byte(`{
  "packages": {
    ".": {
      "release-type": "simple",
      "component": "go-actions",
      "package-name": "go-actions"
    }
  }
}`), 0644); err != nil {
		t.Fatal(err)
	}

	v := New(Options{WorkingDir: tmpDir})
	result := v.Validate()

	for _, warning := range result.Warnings {
		if strings.Contains(warning, "release-please-config.json") && strings.Contains(warning, "Missing") {
			t.Fatalf("expected standard release-please-config.json filename to be accepted, got warning: %s", warning)
		}
	}
}

func TestValidateReleaseConfigRejectsMixedRootDefaultsAndComponent(t *testing.T) {
	tmpDir := t.TempDir()

	writeReleaseValidationProject(t, tmpDir)

	if err := os.WriteFile(filepath.Join(tmpDir, "release-please-config.json"), []byte(`{
  "release-type": "simple",
  "package-name": "go-actions",
  "packages": {
    ".": {
      "component": "go-actions"
    }
  }
}`), 0644); err != nil {
		t.Fatal(err)
	}

	v := New(Options{WorkingDir: tmpDir})
	result := v.Validate()

	if result.IsValid {
		t.Fatal("expected mixed release-please config to fail validation")
	}

	found := false
	for _, err := range result.Errors {
		if strings.Contains(err, "duplicate release tracks") {
			found = true
			break
		}
	}

	if !found {
		t.Fatalf("expected duplicate release track error, got: %v", result.Errors)
	}
}

func writeReleaseValidationProject(t *testing.T, dir string) {
	t.Helper()

	files := map[string]string{
		"go.mod":                        "module test\n\ngo 1.21\n",
		"main.go":                       "package main\n\nfunc main() {}\n",
		".release-please-manifest.json": "{\n  \".\": \"3.0.1\"\n}\n",
		".goreleaser.yaml":              "project_name: test\n",
	}

	for name, content := range files {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0644); err != nil {
			t.Fatal(err)
		}
	}
}
