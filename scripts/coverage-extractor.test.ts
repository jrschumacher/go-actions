import { CoverageExtractor } from './coverage-extractor';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync, SpawnSyncReturns } from 'child_process';

// Mock fs and spawnSync
jest.mock('fs');
jest.mock('child_process');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockSpawnSync = spawnSync as jest.MockedFunction<typeof spawnSync>;

describe('CoverageExtractor', () => {
  let extractor: CoverageExtractor;
  const testWorkingDir = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    extractor = new CoverageExtractor({ workingDirectory: testWorkingDir });
  });

  describe('constructor validation', () => {
    it('should accept valid coverage file names', () => {
      expect(() => new CoverageExtractor({
        workingDirectory: testWorkingDir,
        coverageFile: 'coverage.out'
      })).not.toThrow();

      expect(() => new CoverageExtractor({
        workingDirectory: testWorkingDir,
        coverageFile: 'my-coverage_file.out'
      })).not.toThrow();
    });

    it('should reject coverage file names with path traversal', () => {
      expect(() => new CoverageExtractor({
        workingDirectory: testWorkingDir,
        coverageFile: '../../../etc/passwd'
      })).toThrow('Invalid coverage file name');

      expect(() => new CoverageExtractor({
        workingDirectory: testWorkingDir,
        coverageFile: 'path/to/coverage.out'
      })).toThrow('Invalid coverage file name');
    });

    it('should reject coverage file names with shell injection characters', () => {
      expect(() => new CoverageExtractor({
        workingDirectory: testWorkingDir,
        coverageFile: 'coverage.out; rm -rf /'
      })).toThrow('Invalid coverage file name');

      expect(() => new CoverageExtractor({
        workingDirectory: testWorkingDir,
        coverageFile: 'coverage.out && malicious'
      })).toThrow('Invalid coverage file name');

      expect(() => new CoverageExtractor({
        workingDirectory: testWorkingDir,
        coverageFile: '$(whoami).out'
      })).toThrow('Invalid coverage file name');

      expect(() => new CoverageExtractor({
        workingDirectory: testWorkingDir,
        coverageFile: '`whoami`.out'
      })).toThrow('Invalid coverage file name');
    });
  });

  describe('extractCoverage', () => {
    it('should return no coverage when coverage file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = extractor.extractCoverage();

      expect(result).toEqual({
        coverage: null,
        hasCoverage: false
      });
      expect(mockFs.existsSync).toHaveBeenCalledWith(
        path.join(testWorkingDir, 'coverage.out')
      );
    });

    it('should extract coverage when coverage file exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockSpawnSync.mockReturnValue({
        stdout: 'github.com/user/repo/main.go:10:\tfunction1\t\t80.0%\ngithub.com/user/repo/main.go:20:\tfunction2\t\t90.0%\ntotal:\t\t\t(statements)\t85.7%\n',
        stderr: '',
        status: 0,
        signal: null,
        pid: 12345,
        output: ['', '', ''],
        error: undefined
      } as SpawnSyncReturns<string>);

      const result = extractor.extractCoverage();

      expect(result).toEqual({
        coverage: '85.7%',
        hasCoverage: true
      });
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'go',
        ['tool', 'cover', '-func=coverage.out'],
        {
          cwd: testWorkingDir,
          encoding: 'utf8'
        }
      );
    });

    it('should handle spawnSync errors gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockSpawnSync.mockReturnValue({
        stdout: '',
        stderr: '',
        status: 0,
        signal: null,
        pid: 12345,
        output: ['', '', ''],
        error: new Error('Command failed')
      } as SpawnSyncReturns<string>);

      const result = extractor.extractCoverage();

      expect(result).toEqual({
        coverage: null,
        hasCoverage: false
      });
    });

    it('should handle non-zero exit status', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockSpawnSync.mockReturnValue({
        stdout: '',
        stderr: 'go tool cover: cannot find main module',
        status: 1,
        signal: null,
        pid: 12345,
        output: ['', '', ''],
        error: undefined
      } as SpawnSyncReturns<string>);

      const result = extractor.extractCoverage();

      expect(result).toEqual({
        coverage: null,
        hasCoverage: false
      });
    });

    it('should use custom coverage file name', () => {
      const customExtractor = new CoverageExtractor({
        workingDirectory: testWorkingDir,
        coverageFile: 'custom-coverage.out'
      });

      mockFs.existsSync.mockReturnValue(false);

      customExtractor.extractCoverage();

      expect(mockFs.existsSync).toHaveBeenCalledWith(
        path.join(testWorkingDir, 'custom-coverage.out')
      );
    });

    it('should handle empty output from go tool cover', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockSpawnSync.mockReturnValue({
        stdout: '   \n',
        stderr: '',
        status: 0,
        signal: null,
        pid: 12345,
        output: ['', '', ''],
        error: undefined
      } as SpawnSyncReturns<string>);

      const result = extractor.extractCoverage();

      expect(result).toEqual({
        coverage: '',
        hasCoverage: true
      });
    });

    it('should handle output without total line', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockSpawnSync.mockReturnValue({
        stdout: 'some random output\nwithout total',
        stderr: '',
        status: 0,
        signal: null,
        pid: 12345,
        output: ['', '', ''],
        error: undefined
      } as SpawnSyncReturns<string>);

      const result = extractor.extractCoverage();

      expect(result).toEqual({
        coverage: 'some random output\nwithout total',
        hasCoverage: true
      });
    });

    it('should handle different coverage formats', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockSpawnSync.mockReturnValue({
        stdout: 'total:\t\t\t(statements)\t92.3%\n',
        stderr: '',
        status: 0,
        signal: null,
        pid: 12345,
        output: ['', '', ''],
        error: undefined
      } as SpawnSyncReturns<string>);

      const result = extractor.extractCoverage();

      expect(result).toEqual({
        coverage: '92.3%',
        hasCoverage: true
      });
    });

    it('should extract percentage from complex output', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockSpawnSync.mockReturnValue({
        stdout: `github.com/user/repo/pkg/util.go:15:	Helper		100.0%
github.com/user/repo/pkg/util.go:25:	Process		75.0%
github.com/user/repo/main.go:10:	main		50.0%
total:					(statements)	75.0%
`,
        stderr: '',
        status: 0,
        signal: null,
        pid: 12345,
        output: ['', '', ''],
        error: undefined
      } as SpawnSyncReturns<string>);

      const result = extractor.extractCoverage();

      expect(result).toEqual({
        coverage: '75.0%',
        hasCoverage: true
      });
    });
  });

  describe('extractCoverage function export', () => {
    it('should work with default parameters', () => {
      const { extractCoverage } = require('./coverage-extractor');

      mockFs.existsSync.mockReturnValue(false);

      const result = extractCoverage();

      expect(result.hasCoverage).toBe(false);
      expect(mockFs.existsSync).toHaveBeenCalledWith(
        path.join('.', 'coverage.out')
      );
    });

    it('should work with custom parameters', () => {
      const { extractCoverage } = require('./coverage-extractor');

      mockFs.existsSync.mockReturnValue(true);
      mockSpawnSync.mockReturnValue({
        stdout: 'total:\t\t\t(statements)\t75.0%\n',
        stderr: '',
        status: 0,
        signal: null,
        pid: 12345,
        output: ['', '', ''],
        error: undefined
      } as SpawnSyncReturns<string>);

      const result = extractCoverage('/custom/dir', 'custom.out');

      expect(result).toEqual({
        coverage: '75.0%',
        hasCoverage: true
      });
    });

    it('should throw on invalid coverage file name in function export', () => {
      const { extractCoverage } = require('./coverage-extractor');

      expect(() => extractCoverage('.', '../malicious.out')).toThrow('Invalid coverage file name');
    });
  });
});
