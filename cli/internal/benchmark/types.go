package benchmark

import "time"

// Result represents a single benchmark run result
type Result struct {
	Name        string  `json:"name"`
	Iterations  int     `json:"iterations"`
	NsPerOp     float64 `json:"nsPerOp"`
	BytesPerOp  int64   `json:"bytesPerOp,omitempty"`
	AllocsPerOp int64   `json:"allocsPerOp,omitempty"`
}

// Stats represents aggregated statistics across multiple benchmark runs
type Stats struct {
	Name    string   `json:"name"`
	Runs    []Result `json:"runs"`
	Min     float64  `json:"min"`
	Max     float64  `json:"max"`
	Mean    float64  `json:"mean"`
	StdDev  float64  `json:"stdDev"`
	RunCount int     `json:"runCount"`
}

// Output represents the complete benchmark output with all results and metadata
type Output struct {
	Results  []Stats       `json:"results"`
	Duration time.Duration `json:"duration"`
	RunCount int           `json:"runCount"`
	Success  bool          `json:"success"`
	Error    string        `json:"error,omitempty"`
}
