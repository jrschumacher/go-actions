package coverage

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

// CoverageResult represents the extracted coverage information
type CoverageResult struct {
	Percentage     float64 `json:"percentage"`
	Threshold      float64 `json:"threshold"`
	MeetsThreshold bool    `json:"meetsThreshold"`
	Error          string  `json:"error,omitempty"`
}

// validateCoverageFileName checks if a coverage file name is safe
// Prevents path traversal and shell injection attacks
func validateCoverageFileName(fileName string) error {
	// Only allow alphanumeric, dots, hyphens, and underscores
	safePattern := regexp.MustCompile(`^[\w.-]+$`)

	// Prevent path traversal
	if strings.Contains(fileName, "..") || strings.Contains(fileName, "/") || strings.Contains(fileName, "\\") {
		return fmt.Errorf("invalid coverage file name: %s. Path separators not allowed", fileName)
	}

	if !safePattern.MatchString(fileName) {
		return fmt.Errorf("invalid coverage file name: %s. Only alphanumeric characters, dots, hyphens, and underscores are allowed", fileName)
	}

	return nil
}

// ExtractCoverage extracts coverage percentage from a Go coverage file
func ExtractCoverage(coverageFile string, threshold float64) (*CoverageResult, error) {
	// Validate coverage file name
	fileName := filepath.Base(coverageFile)
	if err := validateCoverageFileName(fileName); err != nil {
		return &CoverageResult{
			Percentage: 0,
			Threshold:  threshold,
			MeetsThreshold: false,
			Error:      err.Error(),
		}, err
	}

	// Check if coverage file exists
	if _, err := os.Stat(coverageFile); os.IsNotExist(err) {
		return &CoverageResult{
			Percentage: 0,
			Threshold:  threshold,
			MeetsThreshold: false,
			Error:      "coverage file not found",
		}, fmt.Errorf("coverage file not found: %s", coverageFile)
	}

	// Get absolute path for working directory
	workingDir := filepath.Dir(coverageFile)

	// Execute go tool cover with safe arguments
	cmd := exec.Command("go", "tool", "cover", fmt.Sprintf("-func=%s", fileName))
	cmd.Dir = workingDir

	output, err := cmd.CombinedOutput()
	if err != nil {
		errMsg := fmt.Sprintf("go tool cover failed: %v", err)
		if len(output) > 0 {
			errMsg = fmt.Sprintf("go tool cover failed: %s", string(output))
		}
		return &CoverageResult{
			Percentage: 0,
			Threshold:  threshold,
			MeetsThreshold: false,
			Error:      errMsg,
		}, fmt.Errorf("%s", errMsg)
	}

	// Extract coverage percentage from output
	percentage, err := extractCoverageFromOutput(string(output))
	if err != nil {
		return &CoverageResult{
			Percentage: 0,
			Threshold:  threshold,
			MeetsThreshold: false,
			Error:      err.Error(),
		}, err
	}

	// Check threshold
	meetsThreshold := true
	if threshold > 0 {
		meetsThreshold = percentage >= threshold
	}

	return &CoverageResult{
		Percentage:     percentage,
		Threshold:      threshold,
		MeetsThreshold: meetsThreshold,
		Error:          "",
	}, nil
}

// extractCoverageFromOutput parses go tool cover output to extract total coverage percentage
// Looking for line like: "total:                                (statements)    85.3%"
func extractCoverageFromOutput(output string) (float64, error) {
	if output == "" {
		return 0, fmt.Errorf("empty coverage output")
	}

	scanner := bufio.NewScanner(strings.NewReader(output))
	for scanner.Scan() {
		line := scanner.Text()

		// Look for the line containing "total:"
		if strings.Contains(line, "total:") {
			// Extract the last field which should be the percentage
			fields := strings.Fields(line)
			if len(fields) == 0 {
				continue
			}

			// Get the last field (percentage)
			percentageStr := fields[len(fields)-1]
			return parseCoveragePercentage(percentageStr)
		}
	}

	if err := scanner.Err(); err != nil {
		return 0, fmt.Errorf("error reading coverage output: %w", err)
	}

	return 0, fmt.Errorf("total coverage line not found in output")
}

// parseCoveragePercentage converts a percentage string like "85.3%" to float64
func parseCoveragePercentage(coverage string) (float64, error) {
	// Remove the % sign if present
	coverage = strings.TrimSpace(coverage)
	coverage = strings.TrimSuffix(coverage, "%")

	// Parse as float
	percentage, err := strconv.ParseFloat(coverage, 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse coverage percentage '%s': %w", coverage, err)
	}

	// Validate range
	if percentage < 0 || percentage > 100 {
		return 0, fmt.Errorf("invalid coverage percentage: %.2f (must be between 0 and 100)", percentage)
	}

	return percentage, nil
}
