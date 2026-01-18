import * as fs from 'fs';
import {
  parseLintOutput,
  groupIssuesByLinter,
  formatGroupedIssues,
  formatLintOutputForPR,
  getWorkflowLogsUrl,
  GolangciLintIssue,
  GolangciLintReport,
} from './lint-formatter';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('lint-formatter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear environment variables
    delete process.env.GITHUB_SERVER_URL;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_RUN_ID;
  });

  describe('parseLintOutput', () => {
    it('should parse valid JSON output', () => {
      const mockReport: GolangciLintReport = {
        Issues: [
          {
            FromLinter: 'errcheck',
            Text: 'Error return value is not checked',
            Pos: {
              Filename: 'main.go',
              Line: 10,
              Column: 5,
              Offset: 100,
            },
          },
        ],
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockReport));

      const result = parseLintOutput('lint-output.json');

      expect(result).toEqual(mockReport);
      expect(mockFs.existsSync).toHaveBeenCalledWith('lint-output.json');
      expect(mockFs.readFileSync).toHaveBeenCalledWith('lint-output.json', 'utf8');
    });

    it('should return null if file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = parseLintOutput('nonexistent.json');

      expect(result).toBeNull();
      expect(mockFs.readFileSync).not.toHaveBeenCalled();
    });

    it('should handle empty file', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('   \n  ');

      const result = parseLintOutput('empty.json');

      expect(result).toEqual({ Issues: null });
    });

    it('should return null on parse error', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('invalid json {');

      const result = parseLintOutput('invalid.json');

      expect(result).toBeNull();
    });

    it('should handle report with no issues', () => {
      const mockReport: GolangciLintReport = {
        Issues: [],
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockReport));

      const result = parseLintOutput('no-issues.json');

      expect(result).toEqual(mockReport);
    });

    it('should handle report with null issues', () => {
      const mockReport: GolangciLintReport = {
        Issues: null,
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockReport));

      const result = parseLintOutput('null-issues.json');

      expect(result).toEqual(mockReport);
    });
  });

  describe('groupIssuesByLinter', () => {
    it('should group issues by linter name', () => {
      const issues: GolangciLintIssue[] = [
        {
          FromLinter: 'errcheck',
          Text: 'Error 1',
          Pos: { Filename: 'a.go', Line: 10, Column: 5, Offset: 100 },
        },
        {
          FromLinter: 'staticcheck',
          Text: 'Error 2',
          Pos: { Filename: 'b.go', Line: 20, Column: 3, Offset: 200 },
        },
        {
          FromLinter: 'errcheck',
          Text: 'Error 3',
          Pos: { Filename: 'c.go', Line: 30, Column: 1, Offset: 300 },
        },
      ];

      const grouped = groupIssuesByLinter(issues);

      expect(grouped.size).toBe(2);
      expect(grouped.get('errcheck')).toEqual({
        linterName: 'errcheck',
        count: 2,
        issues: [
          { file: 'a.go', line: 10, column: 5, message: 'Error 1' },
          { file: 'c.go', line: 30, column: 1, message: 'Error 3' },
        ],
      });
      expect(grouped.get('staticcheck')).toEqual({
        linterName: 'staticcheck',
        count: 1,
        issues: [
          { file: 'b.go', line: 20, column: 3, message: 'Error 2' },
        ],
      });
    });

    it('should sort issues within groups by file and line', () => {
      const issues: GolangciLintIssue[] = [
        {
          FromLinter: 'errcheck',
          Text: 'Error at line 30',
          Pos: { Filename: 'main.go', Line: 30, Column: 1, Offset: 300 },
        },
        {
          FromLinter: 'errcheck',
          Text: 'Error at line 10',
          Pos: { Filename: 'main.go', Line: 10, Column: 1, Offset: 100 },
        },
        {
          FromLinter: 'errcheck',
          Text: 'Error in other.go',
          Pos: { Filename: 'other.go', Line: 5, Column: 1, Offset: 50 },
        },
      ];

      const grouped = groupIssuesByLinter(issues);
      const errcheckGroup = grouped.get('errcheck')!;

      expect(errcheckGroup.issues[0].file).toBe('main.go');
      expect(errcheckGroup.issues[0].line).toBe(10);
      expect(errcheckGroup.issues[1].file).toBe('main.go');
      expect(errcheckGroup.issues[1].line).toBe(30);
      expect(errcheckGroup.issues[2].file).toBe('other.go');
      expect(errcheckGroup.issues[2].line).toBe(5);
    });

    it('should handle unknown linter', () => {
      const issues: GolangciLintIssue[] = [
        {
          FromLinter: '',
          Text: 'Unknown error',
          Pos: { Filename: 'test.go', Line: 1, Column: 1, Offset: 0 },
        },
      ];

      const grouped = groupIssuesByLinter(issues);

      expect(grouped.has('unknown')).toBe(true);
      expect(grouped.get('unknown')?.count).toBe(1);
    });

    it('should handle empty issues array', () => {
      const grouped = groupIssuesByLinter([]);

      expect(grouped.size).toBe(0);
    });
  });

  describe('formatGroupedIssues', () => {
    it('should format issues with collapsible sections', () => {
      const grouped = new Map([
        [
          'errcheck',
          {
            linterName: 'errcheck',
            count: 2,
            issues: [
              { file: 'main.go', line: 10, column: 5, message: 'Error 1' },
              { file: 'test.go', line: 20, column: 3, message: 'Error 2' },
            ],
          },
        ],
      ]);

      const output = formatGroupedIssues(grouped);

      expect(output).toContain('**errcheck** (2 issues)');
      expect(output).toContain('<details open>');
      expect(output).toContain('`main.go:10:5` - Error 1');
      expect(output).toContain('`test.go:20:3` - Error 2');
      expect(output).toContain('</details>');
    });

    it('should truncate issues per linter', () => {
      const issues = Array.from({ length: 15 }, (_, i) => ({
        file: `file${i}.go`,
        line: i + 1,
        column: 1,
        message: `Error ${i + 1}`,
      }));

      const grouped = new Map([
        [
          'errcheck',
          {
            linterName: 'errcheck',
            count: 15,
            issues,
          },
        ],
      ]);

      const output = formatGroupedIssues(grouped, { maxIssuesPerLinter: 5 });

      // Should show only 5 issues
      expect((output.match(/`file\d+\.go:\d+:\d+`/g) || []).length).toBe(5);
      expect(output).toContain('...and 10 more from errcheck');
    });

    it('should truncate total issues across all linters', () => {
      const grouped = new Map([
        [
          'errcheck',
          {
            linterName: 'errcheck',
            count: 30,
            issues: Array.from({ length: 30 }, (_, i) => ({
              file: `file${i}.go`,
              line: i + 1,
              column: 1,
              message: `Error ${i + 1}`,
            })),
          },
        ],
        [
          'staticcheck',
          {
            linterName: 'staticcheck',
            count: 30,
            issues: Array.from({ length: 30 }, (_, i) => ({
              file: `file${i}.go`,
              line: i + 1,
              column: 1,
              message: `Error ${i + 1}`,
            })),
          },
        ],
      ]);

      const output = formatGroupedIssues(grouped, {
        maxTotalIssues: 15,
        maxIssuesPerLinter: 20,
      });

      // Should show 15 total issues (10 from first linter, 5 from second)
      expect((output.match(/`file\d+\.go:\d+:\d+`/g) || []).length).toBe(15);
      expect(output).toContain('...and 45 more issue');
    });

    it('should sort linters by issue count descending', () => {
      const grouped = new Map([
        [
          'linter-a',
          {
            linterName: 'linter-a',
            count: 5,
            issues: Array.from({ length: 5 }, (_, i) => ({
              file: 'a.go',
              line: i,
              column: 1,
              message: 'Error',
            })),
          },
        ],
        [
          'linter-b',
          {
            linterName: 'linter-b',
            count: 20,
            issues: Array.from({ length: 20 }, (_, i) => ({
              file: 'b.go',
              line: i,
              column: 1,
              message: 'Error',
            })),
          },
        ],
        [
          'linter-c',
          {
            linterName: 'linter-c',
            count: 10,
            issues: Array.from({ length: 10 }, (_, i) => ({
              file: 'c.go',
              line: i,
              column: 1,
              message: 'Error',
            })),
          },
        ],
      ]);

      const output = formatGroupedIssues(grouped);

      const linterBIndex = output.indexOf('linter-b');
      const linterCIndex = output.indexOf('linter-c');
      const linterAIndex = output.indexOf('linter-a');

      expect(linterBIndex).toBeLessThan(linterCIndex);
      expect(linterCIndex).toBeLessThan(linterAIndex);
    });

    it('should handle non-collapsible format', () => {
      const grouped = new Map([
        [
          'errcheck',
          {
            linterName: 'errcheck',
            count: 1,
            issues: [
              { file: 'main.go', line: 10, column: 5, message: 'Error 1' },
            ],
          },
        ],
      ]);

      const output = formatGroupedIssues(grouped, { useCollapsible: false });

      expect(output).not.toContain('<details>');
      expect(output).toContain('**errcheck** (1 issue)');
      expect(output).toContain('`main.go:10:5` - Error 1');
    });

    it('should return empty string for empty map', () => {
      const output = formatGroupedIssues(new Map());

      expect(output).toBe('');
    });

    it('should use singular "issue" for count of 1', () => {
      const grouped = new Map([
        [
          'errcheck',
          {
            linterName: 'errcheck',
            count: 1,
            issues: [
              { file: 'main.go', line: 10, column: 5, message: 'Error' },
            ],
          },
        ],
      ]);

      const output = formatGroupedIssues(grouped);

      expect(output).toContain('(1 issue)');
      expect(output).not.toContain('(1 issues)');
    });

    it('should open first linter by default', () => {
      const grouped = new Map([
        [
          'linter-a',
          {
            linterName: 'linter-a',
            count: 10,
            issues: [{ file: 'a.go', line: 1, column: 1, message: 'Error' }],
          },
        ],
        [
          'linter-b',
          {
            linterName: 'linter-b',
            count: 5,
            issues: [{ file: 'b.go', line: 1, column: 1, message: 'Error' }],
          },
        ],
      ]);

      const output = formatGroupedIssues(grouped);

      // First occurrence should be open
      const firstDetails = output.indexOf('<details');
      const openAttr = output.indexOf('open', firstDetails);
      const nextDetails = output.indexOf('<details', firstDetails + 1);

      expect(openAttr).toBeGreaterThan(-1);
      expect(openAttr).toBeLessThan(nextDetails);
    });
  });

  describe('formatLintOutputForPR', () => {
    it('should format complete output with header', () => {
      const mockReport: GolangciLintReport = {
        Issues: [
          {
            FromLinter: 'errcheck',
            Text: 'Error return value is not checked',
            Pos: { Filename: 'main.go', Line: 10, Column: 5, Offset: 100 },
          },
          {
            FromLinter: 'staticcheck',
            Text: 'Unused variable',
            Pos: { Filename: 'test.go', Line: 20, Column: 3, Offset: 200 },
          },
        ],
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockReport));

      const output = formatLintOutputForPR('lint.json');

      expect(output).toContain('### 🚨 Lint Issues Found (2 issues)');
      expect(output).toContain('**errcheck**');
      expect(output).toContain('**staticcheck**');
      expect(output).toContain('`main.go:10:5`');
      expect(output).toContain('`test.go:20:3`');
    });

    it('should include workflow logs URL when provided', () => {
      const mockReport: GolangciLintReport = {
        Issues: [
          {
            FromLinter: 'errcheck',
            Text: 'Error',
            Pos: { Filename: 'main.go', Line: 10, Column: 5, Offset: 100 },
          },
        ],
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockReport));

      const output = formatLintOutputForPR('lint.json', {
        workflowLogsUrl: 'https://github.com/owner/repo/actions/runs/123',
      });

      expect(output).toContain('[📋 View full logs](https://github.com/owner/repo/actions/runs/123)');
    });

    it('should return null when no issues found', () => {
      const mockReport: GolangciLintReport = {
        Issues: [],
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockReport));

      const output = formatLintOutputForPR('lint.json');

      expect(output).toBeNull();
    });

    it('should return null when file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const output = formatLintOutputForPR('nonexistent.json');

      expect(output).toBeNull();
    });

    it('should return null when issues is null', () => {
      const mockReport: GolangciLintReport = {
        Issues: null,
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockReport));

      const output = formatLintOutputForPR('lint.json');

      expect(output).toBeNull();
    });

    it('should use singular "issue" for count of 1', () => {
      const mockReport: GolangciLintReport = {
        Issues: [
          {
            FromLinter: 'errcheck',
            Text: 'Error',
            Pos: { Filename: 'main.go', Line: 10, Column: 5, Offset: 100 },
          },
        ],
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(mockReport));

      const output = formatLintOutputForPR('lint.json');

      expect(output).toContain('(1 issue)');
      expect(output).not.toContain('(1 issues)');
    });
  });

  describe('getWorkflowLogsUrl', () => {
    it('should construct URL from environment variables', () => {
      process.env.GITHUB_SERVER_URL = 'https://github.com';
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      process.env.GITHUB_RUN_ID = '123456';

      const url = getWorkflowLogsUrl();

      expect(url).toBe('https://github.com/owner/repo/actions/runs/123456');
    });

    it('should return undefined when environment variables are missing', () => {
      const url = getWorkflowLogsUrl();

      expect(url).toBeUndefined();
    });

    it('should return undefined when only some variables are set', () => {
      process.env.GITHUB_SERVER_URL = 'https://github.com';
      process.env.GITHUB_REPOSITORY = 'owner/repo';
      // Missing GITHUB_RUN_ID

      const url = getWorkflowLogsUrl();

      expect(url).toBeUndefined();
    });
  });
});
