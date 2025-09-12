package detect

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// ProjectConfig represents the detected configuration of a Go project
type ProjectConfig struct {
	GoVersion     string            `json:"go_version"`
	IsModule      bool              `json:"is_module"`
	ModulePath    string            `json:"module_path"`
	HasWorkspace  bool              `json:"has_workspace"`
	HasTests      bool              `json:"has_tests"`
	HasBenchmarks bool              `json:"has_benchmarks"`
	HasLintConfig bool              `json:"has_lint_config"`
	LintConfigPath string           `json:"lint_config_path"`
	Frameworks    []string          `json:"frameworks"`
	TestDirs      []string          `json:"test_dirs"`
}

// DetectProject analyzes the current directory and returns project configuration
func DetectProject(dir string) (*ProjectConfig, error) {
	if dir == "" {
		var err error
		dir, err = os.Getwd()
		if err != nil {
			return nil, fmt.Errorf("failed to get working directory: %w", err)
		}
	}

	config := &ProjectConfig{}

	// Check for go.mod (module)
	if goModPath := filepath.Join(dir, "go.mod"); fileExists(goModPath) {
		config.IsModule = true
		goVersion, modulePath, err := parseGoMod(goModPath)
		if err != nil {
			return nil, fmt.Errorf("failed to parse go.mod: %w", err)
		}
		config.GoVersion = goVersion
		config.ModulePath = modulePath
	} else {
		// Fallback to build.Default.GOROOT version
		config.GoVersion = "1.21" // sensible default
	}

	// Check for go.work (workspace)
	config.HasWorkspace = fileExists(filepath.Join(dir, "go.work"))

	// Detect test files
	config.HasTests, config.HasBenchmarks, config.TestDirs = detectTests(dir)

	// Detect linting configuration
	config.HasLintConfig, config.LintConfigPath = detectLintConfig(dir)

	// Detect frameworks
	config.Frameworks = detectFrameworks(dir)

	return config, nil
}

// parseGoMod extracts Go version and module path from go.mod
func parseGoMod(path string) (goVersion, modulePath string, err error) {
	file, err := os.Open(path)
	if err != nil {
		return "", "", err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	
	// Patterns to match
	modulePattern := regexp.MustCompile(`^module\s+(.+)`)
	goPattern := regexp.MustCompile(`^go\s+(\d+\.\d+)`)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		
		if matches := modulePattern.FindStringSubmatch(line); matches != nil {
			modulePath = matches[1]
		}
		
		if matches := goPattern.FindStringSubmatch(line); matches != nil {
			goVersion = matches[1]
		}
	}

	if goVersion == "" {
		goVersion = "1.21" // default fallback
	}

	return goVersion, modulePath, scanner.Err()
}

// detectTests scans for test files and benchmark files
func detectTests(dir string) (hasTests, hasBenchmarks bool, testDirs []string) {
	testDirSet := make(map[string]bool)

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // continue walking even if there are permission errors
		}

		// Skip vendor and .git directories
		if info.IsDir() && (info.Name() == "vendor" || info.Name() == ".git" || strings.HasPrefix(info.Name(), ".")) {
			return filepath.SkipDir
		}

		if strings.HasSuffix(info.Name(), "_test.go") {
			hasTests = true
			testDirSet[filepath.Dir(path)] = true

			// Check if file contains benchmarks
			if !hasBenchmarks {
				content, err := os.ReadFile(path)
				if err == nil && strings.Contains(string(content), "func Benchmark") {
					hasBenchmarks = true
				}
			}
		}

		return nil
	})

	if err == nil {
		for dir := range testDirSet {
			// Convert absolute path to relative
			if rel, err := filepath.Rel(dir, dir); err == nil {
				testDirs = append(testDirs, rel)
			} else {
				testDirs = append(testDirs, dir)
			}
		}
	}

	return hasTests, hasBenchmarks, testDirs
}

// detectLintConfig looks for golangci-lint configuration files
func detectLintConfig(dir string) (bool, string) {
	configs := []string{
		".golangci.yml",
		".golangci.yaml", 
		"golangci.yml",
		"golangci.yaml",
	}

	for _, config := range configs {
		path := filepath.Join(dir, config)
		if fileExists(path) {
			return true, config
		}
	}

	return false, ""
}

// detectFrameworks identifies popular Go frameworks in use
func detectFrameworks(dir string) []string {
	var frameworks []string

	// Check go.mod for framework dependencies
	goModPath := filepath.Join(dir, "go.mod")
	if !fileExists(goModPath) {
		return frameworks
	}

	content, err := os.ReadFile(goModPath)
	if err != nil {
		return frameworks
	}

	modContent := string(content)
	
	// Framework detection patterns
	frameworkPatterns := map[string]string{
		"gin":     "gin-gonic/gin",
		"echo":    "labstack/echo",
		"fiber":   "gofiber/fiber", 
		"chi":     "go-chi/chi",
		"cobra":   "spf13/cobra",
		"viper":   "spf13/viper",
		"gorm":    "gorm.io/gorm",
		"testify": "stretchr/testify",
	}

	for framework, pattern := range frameworkPatterns {
		if strings.Contains(modContent, pattern) {
			frameworks = append(frameworks, framework)
		}
	}

	return frameworks
}

// fileExists checks if a file exists
func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}