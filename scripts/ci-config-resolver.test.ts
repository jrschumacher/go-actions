import * as fs from 'fs';
import * as path from 'path';
import { CIConfigResolver, resolveCIConfig, isJobEnabled } from './ci-config-resolver';

// Mock the file system
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('CIConfigResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('with no config file', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(false);
    });

    it('should use default values', () => {
      const resolver = new CIConfigResolver('/test');
      const config = resolver.resolve();

      expect(config.goVersion).toBe('');
      expect(config.goVersionFile).toBe('go.mod');
      expect(config.testEnabled).toBe(true);
      expect(config.testArgs).toBe('-v -race -coverprofile=coverage.out ./...');
      expect(config.coverageThreshold).toBe(0);
      expect(config.lintEnabled).toBe(true);
      expect(config.lintVersion).toBe('v2.0.2');
      expect(config.lintArgs).toBe('');
      expect(config.benchmarkEnabled).toBe(false);
      expect(config.benchmarkArgs).toBe('-bench=. -benchmem');
      expect(config.benchmarkCount).toBe(5);
      expect(config.securityEnabled).toBe(true);
      expect(config.securityVersion).toBe('latest');
      expect(config.securityArgs).toBe('');
      expect(config.securityFailOn).toBe('high');
    });

    it('should respect workflow input overrides', () => {
      const resolver = new CIConfigResolver('/test', {
        goVersion: '1.21',
        goVersionFile: 'go.work',
        testArgs: '-v ./...',
        golangciLintVersion: 'v2.1.0',
        lintArgs: '--fast',
        benchmarkArgs: '-bench=BenchmarkFoo',
        benchmarkCount: 10,
        govulncheckVersion: 'v1.0.0',
        securityArgs: '-test',
      });
      const config = resolver.resolve();

      expect(config.goVersion).toBe('1.21');
      expect(config.goVersionFile).toBe('go.work');
      expect(config.testArgs).toBe('-v ./...');
      expect(config.lintVersion).toBe('v2.1.0');
      expect(config.lintArgs).toBe('--fast');
      expect(config.benchmarkArgs).toBe('-bench=BenchmarkFoo');
      expect(config.benchmarkCount).toBe(10);
      expect(config.securityVersion).toBe('v1.0.0');
      expect(config.securityArgs).toBe('-test');
    });

    it('should handle string benchmark count', () => {
      const resolver = new CIConfigResolver('/test', {
        benchmarkCount: '15',
      });
      const config = resolver.resolve();

      expect(config.benchmarkCount).toBe(15);
    });

    it('should ignore invalid benchmark count', () => {
      const resolver = new CIConfigResolver('/test', {
        benchmarkCount: 'invalid',
      });
      const config = resolver.resolve();

      expect(config.benchmarkCount).toBe(5); // Default value
    });

    it('should ignore empty string overrides', () => {
      const resolver = new CIConfigResolver('/test', {
        goVersion: '',
        testArgs: '',
        lintArgs: '',
      });
      const config = resolver.resolve();

      expect(config.goVersion).toBe('');
      expect(config.testArgs).toBe('-v -race -coverprofile=coverage.out ./...');
      expect(config.lintArgs).toBe('');
    });
  });

  describe('with config file', () => {
    beforeEach(() => {
      mockFs.existsSync.mockImplementation((filePath: any) => {
        return filePath === '/test/.go-actions.yaml';
      });
    });

    it('should merge config file with defaults', () => {
      mockFs.readFileSync.mockReturnValue(`
version: 1
ci:
  go:
    version: "1.22"
  test:
    args: "-v ./..."
    coverage:
      threshold: 80
  lint:
    version: "v2.1.0"
  benchmark:
    enabled: true
    count: 10
  security:
    fail-on: "critical"
`);

      const resolver = new CIConfigResolver('/test');
      const config = resolver.resolve();

      expect(config.goVersion).toBe('1.22');
      expect(config.goVersionFile).toBe('go.mod'); // Default
      expect(config.testArgs).toBe('-v ./...');
      expect(config.coverageThreshold).toBe(80);
      expect(config.lintVersion).toBe('v2.1.0');
      expect(config.benchmarkEnabled).toBe(true);
      expect(config.benchmarkCount).toBe(10);
      expect(config.securityFailOn).toBe('critical');
    });

    it('should allow workflow inputs to override config file', () => {
      mockFs.readFileSync.mockReturnValue(`
version: 1
ci:
  go:
    version: "1.22"
  test:
    args: "-v ./..."
`);

      const resolver = new CIConfigResolver('/test', {
        goVersion: '1.23',
        testArgs: '-v -short ./...',
      });
      const config = resolver.resolve();

      expect(config.goVersion).toBe('1.23');
      expect(config.testArgs).toBe('-v -short ./...');
    });

    it('should respect enabled flags from config', () => {
      mockFs.readFileSync.mockReturnValue(`
version: 1
ci:
  test:
    enabled: false
  lint:
    enabled: false
  benchmark:
    enabled: true
  security:
    enabled: false
`);

      const resolver = new CIConfigResolver('/test');
      const config = resolver.resolve();

      expect(config.testEnabled).toBe(false);
      expect(config.lintEnabled).toBe(false);
      expect(config.benchmarkEnabled).toBe(true);
      expect(config.securityEnabled).toBe(false);
    });

    it('should handle partial config', () => {
      mockFs.readFileSync.mockReturnValue(`
version: 1
ci:
  test:
    coverage:
      threshold: 90
`);

      const resolver = new CIConfigResolver('/test');
      const config = resolver.resolve();

      expect(config.testEnabled).toBe(true);
      expect(config.testArgs).toBe('-v -race -coverprofile=coverage.out ./...');
      expect(config.coverageThreshold).toBe(90);
    });
  });

  describe('isJobEnabled', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(false);
    });

    it('should return correct enabled state for each job with defaults', () => {
      const resolver = new CIConfigResolver('/test');

      expect(resolver.isJobEnabled('test')).toBe(true);
      expect(resolver.isJobEnabled('lint')).toBe(true);
      expect(resolver.isJobEnabled('benchmark')).toBe(false);
      expect(resolver.isJobEnabled('security')).toBe(true);
    });

    it('should respect config file enabled flags', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
version: 1
ci:
  test:
    enabled: false
  benchmark:
    enabled: true
`);

      const resolver = new CIConfigResolver('/test');

      expect(resolver.isJobEnabled('test')).toBe(false);
      expect(resolver.isJobEnabled('lint')).toBe(true);
      expect(resolver.isJobEnabled('benchmark')).toBe(true);
      expect(resolver.isJobEnabled('security')).toBe(true);
    });
  });

  describe('getCoverageThreshold', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(false);
    });

    it('should return default threshold of 0', () => {
      const resolver = new CIConfigResolver('/test');
      expect(resolver.getCoverageThreshold()).toBe(0);
    });

    it('should return configured threshold', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
version: 1
ci:
  test:
    coverage:
      threshold: 75
`);

      const resolver = new CIConfigResolver('/test');
      expect(resolver.getCoverageThreshold()).toBe(75);
    });
  });

  describe('convenience functions', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(false);
    });

    it('should resolve config via convenience function', () => {
      const config = resolveCIConfig('/test', {
        goVersion: '1.21',
      });

      expect(config.goVersion).toBe('1.21');
      expect(config.testEnabled).toBe(true);
    });

    it('should check job enabled via convenience function', () => {
      expect(isJobEnabled('/test', 'test')).toBe(true);
      expect(isJobEnabled('/test', 'benchmark')).toBe(false);
    });

    it('should handle workflow inputs in convenience functions', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
version: 1
ci:
  test:
    enabled: false
`);

      expect(isJobEnabled('/test', 'test')).toBe(false);

      const config = resolveCIConfig('/test', {
        testArgs: '-v -short ./...',
      });
      expect(config.testArgs).toBe('-v -short ./...');
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(false);
    });

    it('should handle undefined workflow inputs', () => {
      const resolver = new CIConfigResolver('/test', {
        goVersion: undefined,
        testArgs: undefined,
      });
      const config = resolver.resolve();

      expect(config.goVersion).toBe('');
      expect(config.testArgs).toBe('-v -race -coverprofile=coverage.out ./...');
    });

    it('should handle zero threshold', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
version: 1
ci:
  test:
    coverage:
      threshold: 0
`);

      const resolver = new CIConfigResolver('/test');
      expect(resolver.getCoverageThreshold()).toBe(0);
    });

    it('should handle missing ci section in config', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(`
version: 1
`);

      const resolver = new CIConfigResolver('/test');
      const config = resolver.resolve();

      expect(config.testEnabled).toBe(true);
      expect(config.lintEnabled).toBe(true);
    });
  });
});
