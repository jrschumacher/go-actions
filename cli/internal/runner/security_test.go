package runner

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jrschumacher/go-actions/cli/internal/config"
)

func TestRunSecurityScannerFailures(t *testing.T) {
	for _, tc := range []struct{ name, args, script, status, diagnostic string }{
		{"flag ordering", "-tags=integration ./...", `for arg in "$@"; do
 if [ "$arg" = -json ] && [ "$1" != -json ]; then echo 'malformed import path "-json"' >&2; exit 1; fi
done
printf '{"config":{}}\n'`, "pass", ""},
		{"vulnerabilities", "", `if [ "$1" = -json ]; then echo '{"finding":{"osv":"GO-2026-1234"}}'; else echo 'vulnerability detected'; exit 3; fi`, "fail", "vulnerability detected"},
		{"text exit 3 without JSON findings", "", `if [ "$1" = -json ]; then echo '{"config":{}}'; else exit 3; fi`, "error", ""},
		{"JSON failure", "", `echo 'scanner failed' >&2; exit 1`, "error", "scanner failed"},
		{"empty JSON", "", `exit 0`, "error", ""},
		{"invalid JSON", "", `echo broken`, "error", ""},
		{"text failure", "", `if [ "$1" = -json ]; then echo '{"config":{}}'; else echo 'text failed' >&2; exit 1; fi`, "error", "text failed"},
		{"JSON failure with valid output", "", `echo '{"config":{}}'; echo 'partial scan' >&2; exit 1`, "error", "partial scan"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			dir := t.TempDir()
			old, err := os.Getwd()
			if err != nil {
				t.Fatal(err)
			}
			if err = os.Chdir(dir); err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { _ = os.Chdir(old) })
			if err = os.WriteFile(filepath.Join(dir, "govulncheck"), []byte("#!/bin/sh\n"+tc.script+"\n"), 0755); err != nil {
				t.Fatal(err)
			}
			t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))
			cfg := config.DefaultConfig()
			cfg.CI.Security.Args = tc.args
			result, err := New(cfg).RunSecurity()
			if result.Status != tc.status || (err != nil) != (tc.status == "error") {
				t.Fatalf("status=%s err=%v; want %s", result.Status, err, tc.status)
			}
			if tc.status == "pass" {
				report, readErr := os.ReadFile("govulncheck-report.json")
				if readErr != nil || !strings.Contains(string(report), "config") {
					t.Fatalf("JSON command did not produce a valid report: %q, %v", report, readErr)
				}
			}
			if tc.status == "fail" && result.Vulnerabilities != 1 {
				t.Errorf("got %d findings", result.Vulnerabilities)
			}
			if !strings.Contains(result.Output, tc.diagnostic) {
				t.Errorf("output=%q missing %q", result.Output, tc.diagnostic)
			}
		})
	}
}

func TestParseSecurityOutputStream(t *testing.T) {
	for _, tc := range []struct {
		name, input string
		count       int
		wantErr     bool
	}{
		{"pretty real findings", "{\n \"config\": {}\n}\n{\n \"finding\": {\"osv\": \"GO-2026-1234\"}\n}", 1, false},
		{"truncated report", `{"config":{}} {"finding":`, 0, true},
		{"unknown message", `{}`, 0, true},
		{"null message", `null`, 0, true},
		{"missing finding ID", `{"finding":{}}`, 0, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			vulns, err := parseSecurityOutput([]byte(tc.input))
			if (err != nil) != tc.wantErr || len(vulns) != tc.count {
				t.Fatalf("got %d findings, %v", len(vulns), err)
			}
		})
	}
}
