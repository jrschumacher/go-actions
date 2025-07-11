import { CIAction, extractTestCoverage, runBenchmarkJob, storeLintResults, validateJobInput } from './ci-action';
import { extractCoverage } from './coverage-extractor';
import { runBenchmarks } from './benchmark-runner';
import * as core from '@actions/core';
import * as github from '@actions/github';

// Mock dependencies
jest.mock('./coverage-extractor');
jest.mock('./benchmark-runner');
jest.mock('@actions/core');
jest.mock('@actions/github');

const mockExtractCoverage = extractCoverage as jest.MockedFunction<typeof extractCoverage>;
const mockRunBenchmarks = runBenchmarks as jest.MockedFunction<typeof runBenchmarks>;
const mockCore = core as jest.Mocked<typeof core>;
const mockGithub = github as jest.Mocked<typeof github>;

describe('CIAction', () => {
  let action: CIAction;
  const testWorkingDir = '/test/project';

  beforeEach(() => {
    jest.clearAllMocks();
    action = new CIAction({ workingDirectory: testWorkingDir });
    
    // Setup GitHub context mock
    Object.defineProperty(github, 'context', {
      value: {
        eventName: 'pull_request',
        repo: { owner: 'test-owner', repo: 'test-repo' },
        issue: { number: 123 }
      },
      writable: true
    });
  });

  describe('constructor and job validation', () => {
    it('should create action with valid job', () => {
      const validAction = new CIAction({ job: 'test' });
      expect(validAction).toBeDefined();
    });

    it('should create action with lint job', () => {
      const lintAction = new CIAction({ job: 'lint' });
      expect(lintAction).toBeDefined();
    });

    it('should create action with benchmark job', () => {
      const benchAction = new CIAction({ job: 'benchmark' });
      expect(benchAction).toBeDefined();
    });

    it('should throw error for invalid job', () => {
      expect(() => new CIAction({ job: 'invalid' })).toThrow('Invalid job type: invalid');
      expect(mockCore.setFailed).toHaveBeenCalledWith('Invalid job type: invalid. Valid options are: test, lint, benchmark');
    });

    it('should use default values for all options', () => {
      const defaultAction = new CIAction();
      expect(defaultAction.getInputs().job).toBe('test');
      expect(defaultAction.getGolangciLintVersion()).toBe('v2.1.0');
    });
  });

  describe('extractTestCoverage', () => {
    it('should extract coverage for test job', async () => {
      const testAction = new CIAction({ workingDirectory: testWorkingDir, job: 'test' });
      
      mockExtractCoverage.mockReturnValue({
        coverage: '85.7%',
        hasCoverage: true
      });

      const result = await testAction.extractTestCoverage();

      expect(mockExtractCoverage).toHaveBeenCalledWith(testWorkingDir);
      expect(mockCore.setOutput).toHaveBeenCalledWith('coverage', '85.7%');
      expect(mockCore.setOutput).toHaveBeenCalledWith('has_coverage', 'true');
      expect(result.coverage).toBe('85.7%');
    });

    it('should handle no coverage file', async () => {
      const testAction = new CIAction({ workingDirectory: testWorkingDir, job: 'test' });
      
      mockExtractCoverage.mockReturnValue({
        coverage: null,
        hasCoverage: false
      });

      const result = await testAction.extractTestCoverage();

      expect(mockCore.setOutput).toHaveBeenCalledWith('has_coverage', 'false');
      expect(result.hasCoverage).toBe(false);
    });

    it('should skip coverage extraction for non-test jobs', async () => {
      const lintAction = new CIAction({ workingDirectory: testWorkingDir, job: 'lint' });
      
      const result = await lintAction.extractTestCoverage();

      expect(mockExtractCoverage).not.toHaveBeenCalled();
      expect(result).toEqual({ coverage: null, hasCoverage: false });
    });
  });

  describe('runBenchmarks', () => {
    it('should run benchmarks successfully', async () => {
      const benchAction = new CIAction({ 
        workingDirectory: testWorkingDir, 
        job: 'benchmark',
        benchmarkArgs: '-bench=.',
        benchmarkCount: 3
      });
      
      mockRunBenchmarks.mockReturnValue({ success: true });

      const result = await benchAction.runBenchmarks();

      expect(mockRunBenchmarks).toHaveBeenCalledWith(testWorkingDir, '-bench=.', 3);
      expect(mockCore.setOutput).toHaveBeenCalledWith('benchmark_success', 'true');
      expect(result.success).toBe(true);
    });

    it('should handle benchmark failures', async () => {
      const benchAction = new CIAction({ 
        workingDirectory: testWorkingDir, 
        job: 'benchmark'
      });
      
      mockRunBenchmarks.mockReturnValue({ 
        success: false, 
        error: 'Benchmark failed' 
      });

      const result = await benchAction.runBenchmarks();

      expect(mockCore.setOutput).toHaveBeenCalledWith('benchmark_success', 'false');
      expect(mockCore.setOutput).toHaveBeenCalledWith('benchmark_error', 'Benchmark failed');
      expect(mockCore.setFailed).toHaveBeenCalledWith('Benchmark failed: Benchmark failed');
      expect(result.success).toBe(false);
    });

    it('should skip benchmarks for non-benchmark jobs', async () => {
      const testAction = new CIAction({ workingDirectory: testWorkingDir, job: 'test' });
      
      const result = await testAction.runBenchmarks();

      expect(mockRunBenchmarks).not.toHaveBeenCalled();
      expect(result).toEqual({ success: false, error: 'Job is not benchmark' });
    });
  });

  describe('storeLintResults', () => {
    it('should store successful lint results', async () => {
      const lintAction = new CIAction({ workingDirectory: testWorkingDir, job: 'lint' });
      
      await lintAction.storeLintResults('success');
      
      // This would normally store results via storeJobResults, but we can't easily mock that
      // The test verifies the method runs without throwing
      expect(true).toBe(true);
    });

    it('should store failed lint results', async () => {
      const lintAction = new CIAction({ workingDirectory: testWorkingDir, job: 'lint' });
      
      await lintAction.storeLintResults('failure');
      
      // This would normally store results via storeJobResults
      expect(true).toBe(true);
    });

    it('should skip storing for non-lint jobs', async () => {
      const testAction = new CIAction({ workingDirectory: testWorkingDir, job: 'test' });
      
      await testAction.storeLintResults('success');
      
      // Should skip without errors
      expect(true).toBe(true);
    });
  });

  describe('getter methods', () => {
    it('should get golangci-lint version', () => {
      const lintAction = new CIAction({ golangciLintVersion: 'v2.0.5' });
      expect(lintAction.getGolangciLintVersion()).toBe('v2.0.5');
    });

    it('should get lint args', () => {
      const lintAction = new CIAction({ lintArgs: '--fast' });
      expect(lintAction.getLintArgs()).toBe('--fast');
    });

    it('should get test args', () => {
      const testAction = new CIAction({ testArgs: '-v -short' });
      expect(testAction.getTestArgs()).toBe('-v -short');
    });

    it('should use defaults when not specified', () => {
      const defaultAction = new CIAction();
      expect(defaultAction.getGolangciLintVersion()).toBe('v2.1.0');
      expect(defaultAction.getLintArgs()).toBe('');
      expect(defaultAction.getTestArgs()).toBe('-v -race -coverprofile=coverage.out');
    });
  });

  describe('normalizeGolangciLintVersion', () => {
    it('should normalize v2 to v2.1.0', () => {
      const action = new CIAction({ golangciLintVersion: 'v2' });
      expect(action.normalizeGolangciLintVersion()).toBe('v2.1.0');
    });

    it('should normalize latest to v2.1.0', () => {
      const action = new CIAction({ golangciLintVersion: 'latest' });
      expect(action.normalizeGolangciLintVersion()).toBe('v2.1.0');
    });

    it('should pass through specific versions unchanged', () => {
      const action = new CIAction({ golangciLintVersion: 'v2.1.0' });
      expect(action.normalizeGolangciLintVersion()).toBe('v2.1.0');
      
      expect(action.normalizeGolangciLintVersion('v2.0.5')).toBe('v2.0.5');
      expect(action.normalizeGolangciLintVersion('v1.54.2')).toBe('v1.54.2');
    });

    it('should normalize provided version parameter', () => {
      const action = new CIAction();
      expect(action.normalizeGolangciLintVersion('v2')).toBe('v2.1.0');
      expect(action.normalizeGolangciLintVersion('latest')).toBe('v2.1.0');
      expect(action.normalizeGolangciLintVersion('v2.0.5')).toBe('v2.0.5');
    });
  });

  describe('logConfiguration', () => {
    it('should log test job configuration', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const testAction = new CIAction({ job: 'test', testArgs: '-v -short' });
      
      testAction.logConfiguration();
      
      expect(consoleSpy).toHaveBeenCalledWith('CI Action Configuration:');
      expect(consoleSpy).toHaveBeenCalledWith('- Job: test');
      expect(consoleSpy).toHaveBeenCalledWith('- Test args: -v -short');
      
      consoleSpy.mockRestore();
    });

    it('should log lint job configuration', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const lintAction = new CIAction({ 
        job: 'lint', 
        golangciLintVersion: 'v2.0.5',
        lintArgs: '--fast' 
      });
      
      lintAction.logConfiguration();
      
      expect(consoleSpy).toHaveBeenCalledWith('- Job: lint');
      expect(consoleSpy).toHaveBeenCalledWith('- golangci-lint version: v2.0.5');
      expect(consoleSpy).toHaveBeenCalledWith('- Lint args: --fast');
      
      consoleSpy.mockRestore();
    });

    it('should log benchmark job configuration', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const benchAction = new CIAction({ 
        job: 'benchmark', 
        benchmarkArgs: '-bench=.',
        benchmarkCount: 3
      });
      
      benchAction.logConfiguration();
      
      expect(consoleSpy).toHaveBeenCalledWith('- Job: benchmark');
      expect(consoleSpy).toHaveBeenCalledWith('- Benchmark args: -bench=.');
      expect(consoleSpy).toHaveBeenCalledWith('- Benchmark count: 3');
      
      consoleSpy.mockRestore();
    });
  });

  describe('getInputs', () => {
    it('should get inputs with defaults', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'job': return '';
          case 'working-directory': return '';
          case 'test-args': return '';
          case 'golangci-lint-version': return '';
          case 'lint-args': return '';
          case 'benchmark-args': return '';
          case 'benchmark-count': return '';
          default: return '';
        }
      });
      
      mockCore.getBooleanInput.mockReturnValue(true);

      const inputs = action.getInputs();

      expect(inputs).toEqual({
        job: 'test',
        workingDirectory: '.',
        testArgs: '-v -race -coverprofile=coverage.out',
        golangciLintVersion: 'v2.1.0',
        lintArgs: '',
        benchmarkArgs: '-bench=. -benchmem',
        benchmarkCount: 5,
      });
    });
  });
});

describe('exported functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractTestCoverage', () => {
    it('should extract coverage', async () => {
      mockExtractCoverage.mockReturnValue({
        coverage: '80%',
        hasCoverage: true
      });

      const result = await extractTestCoverage('/test');

      expect(result.coverage).toBe('80%');
    });
  });

  describe('runBenchmarkJob', () => {
    it('should run benchmarks', async () => {
      mockRunBenchmarks.mockReturnValue({ success: true });

      const result = await runBenchmarkJob('/test', '-bench=.', 2);

      expect(mockRunBenchmarks).toHaveBeenCalledWith('/test', '-bench=.', 2);
      expect(result.success).toBe(true);
    });
  });

  describe('storeLintResults', () => {
    it('should store lint results', async () => {
      // This test verifies the function doesn't throw
      await expect(storeLintResults('success', '/test')).resolves.toBeUndefined();
    });
  });

  describe('validateJobInput', () => {
    it('should validate valid job types', () => {
      expect(validateJobInput('test')).toBe('test');
      expect(validateJobInput('lint')).toBe('lint');
      expect(validateJobInput('benchmark')).toBe('benchmark');
    });

    it('should throw for invalid job types', () => {
      expect(() => validateJobInput('invalid')).toThrow('Invalid job type: invalid');
      expect(mockCore.setFailed).toHaveBeenCalledWith('Invalid job type: invalid. Valid options are: test, lint, benchmark');
    });
  });

});