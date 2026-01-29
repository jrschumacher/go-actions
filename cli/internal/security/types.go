package security

// Severity represents the severity level of a vulnerability
type Severity string

const (
	SeverityCritical Severity = "CRITICAL"
	SeverityHigh     Severity = "HIGH"
	SeverityMedium   Severity = "MEDIUM"
	SeverityLow      Severity = "LOW"
	SeverityUnknown  Severity = "UNKNOWN"
)

// GovulncheckMessage represents a single JSON message from govulncheck
type GovulncheckMessage struct {
	Config   *Config   `json:"config,omitempty"`
	Progress *Progress `json:"progress,omitempty"`
	OSV      *OSV      `json:"osv,omitempty"`
	Finding  *Finding  `json:"finding,omitempty"`
}

// Config contains scanner configuration information
type Config struct {
	ProtocolVersion string `json:"protocol_version"`
	ScannerName     string `json:"scanner_name"`
	ScannerVersion  string `json:"scanner_version"`
}

// Progress contains scan progress messages
type Progress struct {
	Message string `json:"message"`
}

// OSV contains vulnerability information from the Open Source Vulnerabilities database
type OSV struct {
	ID         string              `json:"id"`
	Aliases    []string            `json:"aliases,omitempty"`
	Summary    string              `json:"summary"`
	Details    string              `json:"details,omitempty"`
	Severity   []SeverityScore     `json:"severity,omitempty"`
	References []VulnReference     `json:"references,omitempty"`
}

// SeverityScore represents a severity rating with type and score
type SeverityScore struct {
	Type  string `json:"type"`
	Score string `json:"score"`
}

// VulnReference represents a reference URL for a vulnerability
type VulnReference struct {
	Type string `json:"type"`
	URL  string `json:"url"`
}

// Finding represents a vulnerability finding with trace information
type Finding struct {
	OSV          string       `json:"osv"`
	FixedVersion string       `json:"fixed_version,omitempty"`
	Trace        []TraceEntry `json:"trace"`
}

// TraceEntry represents a single entry in the call trace
type TraceEntry struct {
	Module   string    `json:"module"`
	Version  string    `json:"version"`
	Package  string    `json:"package"`
	Function string    `json:"function,omitempty"`
	Position *Position `json:"position,omitempty"`
}

// Position represents a source code location
type Position struct {
	Filename string `json:"filename"`
	Line     int    `json:"line"`
	Column   int    `json:"column"`
}

// Vulnerability represents a parsed vulnerability with all relevant information
type Vulnerability struct {
	ID               string
	Aliases          []string
	Summary          string
	Severity         Severity
	CVSSScore        float64
	Module           string
	FoundVersion     string
	FixedVersion     string
	ReferenceURL     string
	CallstackSummary string
}

// SecurityResult represents the complete result of security scanning
type SecurityResult struct {
	Vulnerabilities []Vulnerability
	BySeverity      map[Severity][]Vulnerability
	TotalCount      int
	FailsThreshold  bool
}

// FormatOptions controls the formatting of security output
type FormatOptions struct {
	MaxVulnerabilities int
	WorkflowLogsURL    string
	FailOnSeverity     Severity
}
