import { CoverageExtractor } from './coverage-extractor';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Mock fs and execSync
jest.mock('fs');
jest.mock('child_process');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('CoverageExtractor', () => {
  let extractor: CoverageExtractor;
  const testWorkingDir = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    extractor = new CoverageExtractor({ workingDirectory: testWorkingDir });
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
      mockExecSync.mockReturnValue('85.7%\n');

      const result = extractor.extractCoverage();

      expect(result).toEqual({
        coverage: '85.7%',
        hasCoverage: true
      });
      expect(mockExecSync).toHaveBeenCalledWith(
        'go tool cover -func=coverage.out | grep total | awk \'{print $3}\'',
        {
          cwd: testWorkingDir,
          encoding: 'utf8'
        }
      );
    });

    it('should handle execSync errors gracefully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockExecSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

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
      mockExecSync.mockReturnValue('   \n');

      const result = extractor.extractCoverage();

      expect(result).toEqual({
        coverage: '',
        hasCoverage: true
      });
    });

    it('should handle different coverage formats', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockExecSync.mockReturnValue('total:\t\t\t(statements)\t92.3%\n');

      const result = extractor.extractCoverage();

      expect(result).toEqual({
        coverage: 'total:\t\t\t(statements)\t92.3%',
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
      mockExecSync.mockReturnValue('75.0%\n');
      
      const result = extractCoverage('/custom/dir', 'custom.out');
      
      expect(result).toEqual({
        coverage: '75.0%',
        hasCoverage: true
      });
    });
  });
});