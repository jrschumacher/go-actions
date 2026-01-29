import {
  parseGovulncheckJson,
  parseGovulncheckText,
  formatSecurityOutputForPR,
  ParsedVulnerability,
} from './security-formatter';
import * as fs from 'fs';

jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('security-formatter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseGovulncheckJson', () => {
    it('should parse valid govulncheck JSON output', () => {
      const jsonContent = `{"config":{"protocol_version":"v1.0.0","scanner_name":"govulncheck","scanner_version":"v1.0.0"}}
{"osv":{"id":"GO-2023-1234","aliases":["CVE-2023-12345"],"summary":"Example vulnerability","severity":[{"type":"CVSS_V3","score":"7.5"}],"references":[{"type":"WEB","url":"https://pkg.go.dev/vuln/GO-2023-1234"}]}}
{"finding":{"osv":"GO-2023-1234","fixed_version":"v1.2.4","trace":[{"module":"example.com/vuln","version":"v1.2.3","package":"example.com/vuln/pkg","function":"BadFunc"}]}}`;

      const result = parseGovulncheckJson(jsonContent);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'GO-2023-1234',
        aliases: ['CVE-2023-12345'],
        summary: 'Example vulnerability',
        severity: '7.5',
        module: 'example.com/vuln',
        foundVersion: 'v1.2.3',
        fixedVersion: 'v1.2.4',
        referenceUrl: 'https://pkg.go.dev/vuln/GO-2023-1234',
        callstackSummary: 'example.com/vuln/pkg.BadFunc',
      });
    });

    it('should handle multiple vulnerabilities', () => {
      const jsonContent = `{"osv":{"id":"GO-2023-0001","summary":"First vuln"}}
{"finding":{"osv":"GO-2023-0001","trace":[{"module":"mod1","version":"v1.0.0","package":"mod1/pkg"}]}}
{"osv":{"id":"GO-2023-0002","summary":"Second vuln","severity":[{"type":"CVSS_V3","score":"9.8"}]}}
{"finding":{"osv":"GO-2023-0002","trace":[{"module":"mod2","version":"v2.0.0","package":"mod2/pkg"}]}}`;

      const result = parseGovulncheckJson(jsonContent);

      expect(result).toHaveLength(2);
      // Should be sorted by severity (highest first)
      expect(result[0].id).toBe('GO-2023-0002');
      expect(result[0].severity).toBe('9.8');
      expect(result[1].id).toBe('GO-2023-0001');
    });

    it('should handle missing optional fields', () => {
      const jsonContent = `{"osv":{"id":"GO-2023-5678","summary":"Minimal vuln"}}
{"finding":{"osv":"GO-2023-5678","trace":[{"module":"example.com/minimal","version":"v1.0.0","package":"example.com/minimal"}]}}`;

      const result = parseGovulncheckJson(jsonContent);

      expect(result).toHaveLength(1);
      expect(result[0].aliases).toEqual([]);
      expect(result[0].severity).toBeUndefined();
      expect(result[0].fixedVersion).toBeUndefined();
      expect(result[0].referenceUrl).toBe('https://pkg.go.dev/vuln/GO-2023-5678');
    });

    it('should handle malformed JSON lines gracefully', () => {
      const jsonContent = `{"osv":{"id":"GO-2023-1234","summary":"Good vuln"}}
this is not json
{"finding":{"osv":"GO-2023-1234","trace":[{"module":"mod","version":"v1.0.0","package":"mod/pkg"}]}}`;

      const result = parseGovulncheckJson(jsonContent);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('GO-2023-1234');
    });

    it('should return empty array for empty input', () => {
      const result = parseGovulncheckJson('');
      expect(result).toHaveLength(0);
    });

    it('should return empty array when no findings match OSV entries', () => {
      const jsonContent = `{"osv":{"id":"GO-2023-1234","summary":"Orphan vuln"}}
{"finding":{"osv":"GO-2023-DIFFERENT","trace":[{"module":"mod","version":"v1.0.0","package":"mod/pkg"}]}}`;

      const result = parseGovulncheckJson(jsonContent);
      expect(result).toHaveLength(0);
    });

    it('should build callstack summary from trace', () => {
      // JSON must be on single lines (newline-delimited JSON format)
      const jsonContent = `{"osv":{"id":"GO-2023-1234","summary":"Vuln with callstack"}}
{"finding":{"osv":"GO-2023-1234","trace":[{"module":"vuln-mod","version":"v1.0.0","package":"vuln-mod/pkg","function":"VulnFunc"},{"module":"mid-mod","version":"v2.0.0","package":"mid-mod/pkg","function":"MiddleFunc","position":{"filename":"middle.go","line":42,"column":10}},{"module":"app","version":"v1.0.0","package":"app/main","function":"main","position":{"filename":"main.go","line":10,"column":5}}]}}`;

      const result = parseGovulncheckJson(jsonContent);

      expect(result).toHaveLength(1);
      expect(result[0].callstackSummary).toContain('vuln-mod/pkg.VulnFunc');
      expect(result[0].callstackSummary).toContain('mid-mod/pkg.MiddleFunc (middle.go:42)');
    });
  });

  describe('parseGovulncheckText', () => {
    it('should parse govulncheck text output', () => {
      const textContent = `Scanning your code and 42 packages across 5 modules for known vulnerabilities...

Vulnerability #1: GO-2023-1234
    Example vulnerability description
    Found in: example.com/vuln@v1.2.3
    Fixed in: example.com/vuln@v1.2.4
    More info: https://pkg.go.dev/vuln/GO-2023-1234

Vulnerability #2: GO-2023-5678
    Another vulnerability
    Found in: another.com/pkg@v2.0.0
    More info: https://pkg.go.dev/vuln/GO-2023-5678

Your code is affected by 2 vulnerabilities.`;

      const result = parseGovulncheckText(textContent);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('GO-2023-1234');
      expect(result[0].summary).toBe('Example vulnerability description');
      expect(result[0].module).toBe('example.com/vuln');
      expect(result[0].foundVersion).toBe('v1.2.3');
    });

    it('should return empty array for no vulnerabilities', () => {
      const textContent = `Scanning your code and 10 packages across 2 modules for known vulnerabilities...

No vulnerabilities found.`;

      const result = parseGovulncheckText(textContent);
      expect(result).toHaveLength(0);
    });
  });

  describe('formatSecurityOutputForPR', () => {
    beforeEach(() => {
      // Reset environment
      delete process.env.GITHUB_SERVER_URL;
      delete process.env.GITHUB_REPOSITORY;
      delete process.env.GITHUB_RUN_ID;
    });

    it('should format vulnerabilities as markdown', () => {
      const jsonContent = `{"osv":{"id":"GO-2023-1234","aliases":["CVE-2023-12345"],"summary":"Critical security issue","severity":[{"type":"CVSS_V3","score":"9.8"}]}}
{"finding":{"osv":"GO-2023-1234","fixed_version":"v1.2.4","trace":[{"module":"example.com/vuln","version":"v1.2.3","package":"example.com/vuln/pkg"}]}}`;

      mockFs.existsSync.mockImplementation((path: fs.PathLike) => {
        return path.toString().includes('json');
      });
      mockFs.readFileSync.mockReturnValue(jsonContent);

      const result = formatSecurityOutputForPR('/path/to/json', '/path/to/text', {
        maxVulnerabilities: 10,
      });

      expect(result).not.toBeNull();
      expect(result!.count).toBe(1);
      expect(result!.markdown).toContain('GO-2023-1234');
      expect(result!.markdown).toContain('CRITICAL');
      expect(result!.markdown).toContain('CVE-2023-12345');
      expect(result!.markdown).toContain('example.com/vuln@v1.2.3');
      expect(result!.markdown).toContain('v1.2.4');
    });

    it('should fall back to text output when JSON fails', () => {
      const textContent = `Vulnerability #1: GO-2023-9999
    Fallback vulnerability
    Found in: fallback.com/pkg@v1.0.0`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation((path: fs.PathOrFileDescriptor) => {
        if (path.toString().includes('json')) {
          return ''; // Empty JSON
        }
        return textContent;
      });

      const result = formatSecurityOutputForPR('/path/to/json', '/path/to/text');

      expect(result).not.toBeNull();
      expect(result!.count).toBe(1);
      expect(result!.markdown).toContain('GO-2023-9999');
    });

    it('should return null when no vulnerabilities found', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('');

      const result = formatSecurityOutputForPR('/path/to/json', '/path/to/text');

      expect(result).toBeNull();
    });

    it('should return null when files do not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = formatSecurityOutputForPR('/path/to/json', '/path/to/text');

      expect(result).toBeNull();
    });

    it('should truncate output when exceeding max vulnerabilities', () => {
      // Create JSON with 5 vulnerabilities
      const vulns = [];
      for (let i = 1; i <= 5; i++) {
        vulns.push(`{"osv":{"id":"GO-2023-000${i}","summary":"Vuln ${i}"}}`);
        vulns.push(`{"finding":{"osv":"GO-2023-000${i}","trace":[{"module":"mod${i}","version":"v1.0.0","package":"mod${i}/pkg"}]}}`);
      }
      const jsonContent = vulns.join('\n');

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(jsonContent);

      const result = formatSecurityOutputForPR('/path/to/json', '/path/to/text', {
        maxVulnerabilities: 3,
      });

      expect(result).not.toBeNull();
      expect(result!.count).toBe(5);
      expect(result!.markdown).toContain('GO-2023-0001');
      expect(result!.markdown).toContain('GO-2023-0002');
      expect(result!.markdown).toContain('GO-2023-0003');
      expect(result!.markdown).toContain('and 2 more vulnerabilities');
    });

    it('should include severity summary table', () => {
      const jsonContent = `{"osv":{"id":"GO-2023-0001","summary":"Critical","severity":[{"type":"CVSS_V3","score":"9.5"}]}}
{"finding":{"osv":"GO-2023-0001","trace":[{"module":"mod1","version":"v1.0.0","package":"mod1/pkg"}]}}
{"osv":{"id":"GO-2023-0002","summary":"High","severity":[{"type":"CVSS_V3","score":"7.5"}]}}
{"finding":{"osv":"GO-2023-0002","trace":[{"module":"mod2","version":"v1.0.0","package":"mod2/pkg"}]}}`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(jsonContent);

      const result = formatSecurityOutputForPR('/path/to/json', '/path/to/text');

      expect(result).not.toBeNull();
      expect(result!.markdown).toContain('Critical');
      expect(result!.markdown).toContain('High');
    });

    it('should include workflow logs URL when provided', () => {
      const jsonContent = `{"osv":{"id":"GO-2023-1234","summary":"Test vuln"}}
{"finding":{"osv":"GO-2023-1234","trace":[{"module":"mod","version":"v1.0.0","package":"mod/pkg"}]}}`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(jsonContent);

      const result = formatSecurityOutputForPR('/path/to/json', '/path/to/text', {
        workflowLogsUrl: 'https://github.com/owner/repo/actions/runs/12345',
      });

      expect(result).not.toBeNull();
      expect(result!.markdown).toContain('https://github.com/owner/repo/actions/runs/12345');
      expect(result!.markdown).toContain('View full scan output');
    });

    it('should include remediation hint', () => {
      const jsonContent = `{"osv":{"id":"GO-2023-1234","summary":"Test vuln"}}
{"finding":{"osv":"GO-2023-1234","trace":[{"module":"mod","version":"v1.0.0","package":"mod/pkg"}]}}`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(jsonContent);

      const result = formatSecurityOutputForPR('/path/to/json', '/path/to/text');

      expect(result).not.toBeNull();
      expect(result!.markdown).toContain('go get -u');
    });
  });
});
