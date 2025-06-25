import { CIAction, extractTestCoverage, runBenchmarkJob } from './ci-action';
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


  describe('getInputs', () => {
    it('should get inputs with defaults', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        switch (name) {
          case 'job': return '';
          case 'working-directory': return '';
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
        benchmarkArgs: '-bench=. -benchmem',
        benchmarkCount: 1,
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

});